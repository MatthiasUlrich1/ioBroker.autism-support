import { resolveItemImageUrl } from "./schedule";

export interface CustomPictogram {
	id: string;
	filename: string;
	path: string;
	label: string;
	tags: string[];
	originalName: string;
	mime: string;
	uploadedAt: number;
}

export interface PictogramLibrary {
	version: 1;
	items: CustomPictogram[];
}

export function matchesPictogramQuery(item: CustomPictogram, query: string): boolean {
	const q = query.trim().toLowerCase();
	if (!q) {
		return true;
	}
	const haystack = [item.label, item.originalName, item.filename, ...(item.tags || [])].join(" ").toLowerCase();
	return q.split(/\s+/).every(part => haystack.includes(part));
}

export function customPictogramUrl(item: CustomPictogram, adapterInstance: string): string {
	return (
		resolveItemImageUrl(
			{ id: item.id, label: item.label, start: "00:00", end: "00:01", source: "custom", customRef: item.path },
			adapterInstance,
		) || ""
	);
}

export function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = String(reader.result || "");
			const comma = result.indexOf(",");
			resolve(comma >= 0 ? result.slice(comma + 1) : result);
		};
		reader.onerror = () => reject(new Error("Could not read file"));
		reader.readAsDataURL(file);
	});
}

export function sendToAdapter<T>(
	socket: { sendTo?: (instance: string, command: string, message: unknown, callback?: (result: T) => void) => unknown },
	instance: string,
	command: string,
	message: unknown,
	timeoutMs = 20000,
): Promise<T> {
	const sendTo = socket.sendTo;
	if (!sendTo) {
		return Promise.reject(new Error("socket.sendTo is not available"));
	}
	return new Promise((resolve, reject) => {
		let settled = false;
		const timer = setTimeout(() => {
			if (!settled) {
				settled = true;
				reject(new Error("Adapter did not answer (timeout). Is autism-support running?"));
			}
		}, timeoutMs);
		const finish = (result: T): void => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			resolve(result);
		};
		try {
			const maybePromise = sendTo(instance, command, message, finish);
			if (maybePromise && typeof (maybePromise as Promise<T>).then === "function") {
				void (maybePromise as Promise<T>).then(result => {
					if (result !== undefined && result !== null) {
						finish(result);
					}
				}, error => {
					if (!settled) {
						settled = true;
						clearTimeout(timer);
						reject(error);
					}
				});
			}
		} catch (error) {
			settled = true;
			clearTimeout(timer);
			reject(error);
		}
	});
}

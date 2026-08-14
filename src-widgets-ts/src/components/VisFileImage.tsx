import React from "react";

export function visFileUrlCandidates(src: string): string[] {
	if (!src) {
		return [];
	}
	if (/^https?:\/\//i.test(src) || src.startsWith("data:")) {
		return [src];
	}
	const encoded = src.startsWith("/") ? src : `/${src}`;
	const withFiles = encoded.startsWith("/files/") ? encoded : `/files${encoded}`;
	return encoded === withFiles ? [encoded] : [encoded, withFiles];
}

export default function VisFileImage(props: React.ImgHTMLAttributes<HTMLImageElement>): React.JSX.Element {
	const { src = "", onError, ...rest } = props;
	const candidates = visFileUrlCandidates(src);
	const [index, setIndex] = React.useState(0);

	React.useEffect(() => {
		setIndex(0);
	}, [src]);

	const current = candidates[Math.min(index, Math.max(0, candidates.length - 1))] || "";

	return (
		<img
			{...rest}
			src={current}
			onError={event => {
				if (index + 1 < candidates.length) {
					setIndex(index + 1);
					return;
				}
				onError?.(event);
			}}
		/>
	);
}

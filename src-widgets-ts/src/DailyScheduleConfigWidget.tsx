import React from "react";
import {
	Box,
	Button,
	Checkbox,
	FormControl,
	FormControlLabel,
	FormGroup,
	InputLabel,
	MenuItem,
	Select,
	Stack,
	TextField,
	Typography,
} from "@mui/material";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps, VisRxWidgetState } from "@iobroker/types-vis-2";
import type VisRxWidget from "@iobroker/types-vis-2/visRxWidget";

import DailyScheduleVisual from "./components/DailyScheduleVisual";
import PeriodIcon from "./components/PeriodIcon";
import VisFileImage from "./components/VisFileImage";
import { arasaacImageUrl, searchArasaac, type ArasaacSearchHit } from "./lib/arasaac";
import {
	customPictogramUrl,
	matchesPictogramQuery,
	parseLibrary,
	type CustomPictogram,
	type PictogramLibrary,
} from "./lib/custom-pictograms";
import {
	applyPeriodOverrides,
	parseDayPeriods,
	parsePeriodOverrides,
	parseSchedulePlan,
	resolveItemImageUrl,
	type DayPeriodDefinition,
	type ScheduleItem,
	type SchedulePlan,
} from "./lib/schedule";

interface DailyScheduleConfigRxData {
	oidPlan: string;
	oidPeriods: string;
	oidPeriodOverrides: string;
	oidClearAfterLast: string;
	oidNowMinutes: string;
	oidCurrentItemIndex: string;
	oidLibrary: string;
	adapterInstance: string;
	arasaacLanguage: string;
	pictogramSize: number;
}

interface DailyScheduleConfigState extends VisRxWidgetState {
	draft: SchedulePlan;
	selectedIndex: number;
	searchQuery: string;
	searchHits: ArasaacSearchHit[];
	searchError: string;
	busy: boolean;
	library: PictogramLibrary;
	/** Optimistic day-period on/off until ioBroker state catches up. */
	localPeriodOverrides: Record<string, boolean>;
	/** Optimistic clear-after-last toggle until ioBroker state catches up. */
	localClearAfterLast?: boolean;
}

function newItem(): ScheduleItem {
	return {
		id: `item-${Date.now()}`,
		label: "",
		start: "08:00",
		end: "09:00",
		source: "arasaac",
		arasaacId: undefined,
		customRef: "",
	};
}

export default class DailyScheduleConfigWidget extends (window.visRxWidget as typeof VisRxWidget)<
	DailyScheduleConfigRxData,
	DailyScheduleConfigState
> {
	static adapter: string;

	static getWidgetInfo(): RxWidgetInfo {
		return {
			id: "asDailyScheduleConfig",
			visSet: "autism-support",
			visSetIcon: "widgets/autism-support/img/autism-support.svg",
			visSetLabel: "autism_support_widgets",
			visSetColor: "#FF8A00",
			visName: "DailyScheduleConfig",
			visAttrs: [
				{
					name: "schedule",
					label: "schedule_states",
					fields: [
						{
							name: "oidPlan",
							type: "id",
							label: "oid_schedule_plan",
							default: "autism-support.0.schedule.plan",
						},
						{
							name: "oidPeriods",
							type: "id",
							label: "oid_schedule_periods",
							default: "autism-support.0.schedule.periods",
						},
						{
							name: "oidPeriodOverrides",
							type: "id",
							label: "oid_schedule_period_overrides",
							default: "autism-support.0.schedule.periodOverrides",
						},
						{
							name: "oidClearAfterLast",
							type: "id",
							label: "oid_schedule_clear_after_last",
							default: "autism-support.0.schedule.clearAfterLast",
						},
						{
							name: "oidNowMinutes",
							type: "id",
							label: "oid_schedule_now",
							default: "autism-support.0.schedule.nowMinutes",
						},
						{
							name: "oidCurrentItemIndex",
							type: "id",
							label: "oid_schedule_current_item",
							default: "autism-support.0.schedule.currentItemIndex",
						},
						{
							name: "oidLibrary",
							type: "id",
							label: "oid_schedule_library",
							default: "autism-support.0.schedule.pictogramLibrary",
						},
						{
							name: "adapterInstance",
							type: "text",
							label: "adapter_instance",
							default: "autism-support.0",
						},
						{
							name: "arasaacLanguage",
							type: "text",
							label: "arasaac_language",
							default: "de",
						},
						{
							name: "pictogramSize",
							type: "number",
							label: "pictogram_size",
							default: 64,
							min: 32,
							max: 200,
							step: 8,
						},
					],
				},
			],
			visPrev: "widgets/autism-support/img/daily-schedule-config.png",
		};
	}

	constructor(props: VisRxWidgetProps) {
		super(props);
		this.state = {
			...this.state,
			draft: { version: 1, items: [] },
			selectedIndex: -1,
			searchQuery: "",
			searchHits: [],
			searchError: "",
			busy: false,
			library: { version: 1, items: [] },
			localPeriodOverrides: {},
		};
	}

	getWidgetInfo(): RxWidgetInfo {
		return DailyScheduleConfigWidget.getWidgetInfo();
	}

	static getI18nPrefix(): string {
		return `${DailyScheduleConfigWidget.adapter}_`;
	}

	componentDidMount(): void {
		super.componentDidMount();
		this.syncDraftFromState();
		void this.bootstrapClearAfterLast();
		this.syncLibraryFromState();
		void this.bootstrapLibrary();
	}

	onStateUpdated(id: string, state: ioBroker.State | null | undefined): void {
		if (id === this.state.rxData.oidPlan) {
			// Mid-save: keep the draft we just wrote; this.state.values may still be stale.
			if (this.state.busy) {
				return;
			}
			// Prefer callback state.val — this.state.values can lag behind the event.
			this.syncDraftFromState(state?.val);
		}
		if (id === this.libraryOid()) {
			this.syncLibraryFromState();
		}
		const overridesOid = this.getPeriodOverridesOid();
		if (id === overridesOid) {
			// Server state is source of truth; drop optimistic keys that match.
			const server = parsePeriodOverrides(this.state.values[`${overridesOid}.val`]);
			this.setState(prev => {
				const nextLocal = { ...prev.localPeriodOverrides };
				for (const key of Object.keys(nextLocal)) {
					if (server[key] === nextLocal[key]) {
						delete nextLocal[key];
					}
				}
				return { localPeriodOverrides: nextLocal };
			});
		}
		const clearAfterLastOid = this.getClearAfterLastOid();
		if (id === clearAfterLastOid) {
			const server = Boolean(this.state.values[`${clearAfterLastOid}.val`]);
			this.setState(prev => ({
				localClearAfterLast: prev.localClearAfterLast === server ? undefined : prev.localClearAfterLast,
			}));
		}
	}

	private getPeriodOverridesOid(): string {
		return (
			this.state.rxData.oidPeriodOverrides ||
			`${this.state.rxData.adapterInstance || "autism-support.0"}.schedule.periodOverrides`
		);
	}

	private getMergedPeriodOverrides(): Record<string, boolean> {
		const oid = this.getPeriodOverridesOid();
		const fromState = parsePeriodOverrides(this.state.values[`${oid}.val`]);
		return { ...fromState, ...this.state.localPeriodOverrides };
	}

	private syncDraftFromState(raw?: unknown): void {
		const plan = parseSchedulePlan(
			raw !== undefined ? raw : this.state.values[`${this.state.rxData.oidPlan}.val`],
		);
		this.setState(prev => {
			const nextIndex =
				plan.items.length === 0
					? -1
					: prev.selectedIndex >= 0 && prev.selectedIndex < plan.items.length
						? prev.selectedIndex
						: 0;
			return { draft: plan, selectedIndex: nextIndex };
		});
	}

	private updateItem(index: number, patch: Partial<ScheduleItem>): void {
		this.setState(prev => {
			const items = prev.draft.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
			return { draft: { version: 1, items } };
		});
	}

	private async savePlan(): Promise<void> {
		const oid = this.state.rxData.oidPlan;
		if (!oid) {
			return;
		}
		const toSave = this.state.draft;
		this.setState({ busy: true });
		try {
			await this.props.context.socket.setState(oid, JSON.stringify(toSave), false);
			// Keep the saved draft visible even if a stale state echo arrives next.
			this.setState({ draft: toSave });
		} finally {
			this.setState({ busy: false });
		}
	}

	private getClearAfterLastOid(): string {
		return (
			this.state.rxData.oidClearAfterLast ||
			`${this.state.rxData.adapterInstance || "autism-support.0"}.schedule.clearAfterLast`
		);
	}

	private getClearAfterLastChecked(): boolean {
		if (this.state.localClearAfterLast !== undefined) {
			return this.state.localClearAfterLast;
		}
		const oid = this.getClearAfterLastOid();
		return Boolean(this.state.values[`${oid}.val`]);
	}

	private async bootstrapClearAfterLast(): Promise<void> {
		const oid = this.getClearAfterLastOid();
		const socket = this.props.context?.socket;
		if (!oid || !socket || this.state.values[`${oid}.val`] !== undefined) {
			return;
		}
		try {
			const state = await socket.getState(oid);
			if (state?.val !== undefined && state?.val !== null) {
				this.setState({ localClearAfterLast: Boolean(state.val) });
			}
		} catch {
			// Widget still works via optimistic toggle even if initial read fails.
		}
	}

	private async resetPlan(): Promise<void> {
		const lang = this.props.context?.lang || "de";
		const message = lang.startsWith("de")
			? "Tagesplan wirklich löschen? Alle Piktogramme werden entfernt."
			: "Really delete the daily schedule? All pictograms will be removed.";
		if (!window.confirm(message)) {
			return;
		}
		const empty: SchedulePlan = { version: 1, items: [] };
		const oid = this.state.rxData.oidPlan;
		this.setState({ busy: true, draft: empty, selectedIndex: -1 });
		try {
			if (oid) {
				await this.props.context.socket.setState(oid, JSON.stringify(empty), false);
			}
		} finally {
			this.setState({ busy: false });
		}
	}

	private async setClearAfterLast(enabled: boolean): Promise<void> {
		const oid = this.getClearAfterLastOid();
		this.setState({ localClearAfterLast: enabled });
		try {
			await this.props.context.socket.setState(oid, enabled, false);
		} catch (error) {
			this.setState({
				localClearAfterLast: undefined,
				searchError: (error as Error).message || "Option konnte nicht gespeichert werden",
			});
		}
	}

	private async setPeriodEnabled(periodId: string, enabled: boolean): Promise<void> {
		const oid = this.getPeriodOverridesOid();
		const current = this.getMergedPeriodOverrides();
		const next = { ...current, [periodId]: enabled };
		// Optimistic UI so the preview updates immediately (do not block checkboxes with busy).
		this.setState(prev => ({
			localPeriodOverrides: { ...prev.localPeriodOverrides, [periodId]: enabled },
		}));
		try {
			await this.props.context.socket.setState(oid, JSON.stringify(next), false);
		} catch (error) {
			this.setState(prev => {
				const local = { ...prev.localPeriodOverrides };
				delete local[periodId];
				return {
					localPeriodOverrides: local,
					searchError: (error as Error).message || "Tagesbereich konnte nicht gespeichert werden",
				};
			});
		}
	}

	private periodLabel(id: string): string {
		const de: Record<string, string> = {
			morning: "Morgens",
			forenoon: "Vormittag",
			noon: "Mittag",
			afternoon: "Nachmittag",
			evening: "Abend",
			night: "Nacht",
		};
		return de[id] || id;
	}

	private isDe(): boolean {
		return (this.props.context?.lang || "de").startsWith("de");
	}

	private adapterInstance(): string {
		return this.state.rxData.adapterInstance || "autism-support.0";
	}

	private libraryOid(): string {
		return this.state.rxData.oidLibrary || `${this.adapterInstance()}.schedule.pictogramLibrary`;
	}

	private syncLibraryFromState(): void {
		this.setState({ library: parseLibrary(this.state.values[`${this.libraryOid()}.val`]) });
	}

	private async bootstrapLibrary(): Promise<void> {
		const oid = this.libraryOid();
		const socket = this.props.context?.socket;
		if (!oid || !socket || this.state.values[`${oid}.val`] !== undefined) {
			return;
		}
		try {
			const state = await socket.getState(oid);
			this.setState({ library: parseLibrary(state?.val) });
		} catch (error) {
			this.setState({ searchError: (error as Error).message });
		}
	}

	private selectCustomPictogram(item: CustomPictogram): void {
		const index = this.state.selectedIndex;
		if (index < 0) {
			this.setState({
				searchError: this.isDe()
					? "Bitte zuerst einen Plan-Eintrag auswählen."
					: "Select a schedule item first.",
			});
			return;
		}
		const selected = this.state.draft.items[index];
		this.updateItem(index, {
			source: "custom",
			customRef: item.path,
			arasaacId: undefined,
			label: selected?.label || item.label,
		});
		this.setState({ searchError: "" });
	}

	private libraryItemFor(ref: string | undefined): CustomPictogram | undefined {
		if (!ref) {
			return undefined;
		}
		return this.state.library.items.find(
			item => item.path === ref || item.filename === ref || `pictograms/${item.filename}` === ref,
		);
	}

	private async runSearch(): Promise<void> {
		this.setState({ busy: true, searchError: "" });
		try {
			const hits = await searchArasaac(this.state.rxData.arasaacLanguage || "de", this.state.searchQuery);
			this.setState({ searchHits: hits });
		} catch (error) {
			this.setState({ searchError: (error as Error).message, searchHits: [] });
		} finally {
			this.setState({ busy: false });
		}
	}

	private renderCustomHits(): React.JSX.Element | null {
		const query = this.state.searchQuery.trim();
		const hits = this.state.library.items.filter(item => matchesPictogramQuery(item, query));
		if (!query || hits.length === 0) {
			return null;
		}
		const thumb = Math.max(48, Math.min(96, Number(this.state.rxData.pictogramSize) || 64));
		const instance = this.adapterInstance();
		return (
			<>
				<Typography
					variant="caption"
					sx={{ fontWeight: 700 }}
				>
					{this.isDe() ? "Eigene Bilder" : "Own images"}
				</Typography>
				<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, maxHeight: 160, overflowY: "auto" }}>
					{hits.map(item => this.renderLibraryThumb(item, thumb, instance))}
				</Box>
			</>
		);
	}

	private renderLibraryThumb(item: CustomPictogram, thumb: number, instance: string): React.JSX.Element {
		const selected = this.state.selectedIndex >= 0 ? this.state.draft.items[this.state.selectedIndex] : null;
		const active = selected?.source === "custom" && selected.customRef === item.path;
		return (
			<Box
				key={item.id}
				component="button"
				type="button"
				title={(item.tags || []).join(", ") || item.label}
				onClick={() => this.selectCustomPictogram(item)}
				sx={{
					width: thumb + 16,
					p: 0.5,
					border: "2px solid",
					borderColor: active ? "primary.main" : "divider",
					borderRadius: 1,
					background: "#fff",
					cursor: "pointer",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					gap: 0.5,
				}}
			>
				<VisFileImage
					src={customPictogramUrl(item, instance)}
					alt=""
					width={thumb}
					height={thumb}
					style={{ objectFit: "contain", display: "block" }}
				/>
				<Typography
					variant="caption"
					sx={{
						maxWidth: thumb + 8,
						overflow: "hidden",
						textOverflow: "ellipsis",
						whiteSpace: "nowrap",
						lineHeight: 1.2,
					}}
				>
					{item.label || item.filename}
				</Typography>
			</Box>
		);
	}

	private renderCustomEditor(selected: ScheduleItem): React.JSX.Element {
		const thumb = Math.max(48, Math.min(96, Number(this.state.rxData.pictogramSize) || 64));
		const instance = this.adapterInstance();
		const preview = resolveItemImageUrl(selected, instance);
		const filter = this.state.searchQuery.trim();
		const items = this.state.library.items.filter(item => matchesPictogramQuery(item, filter));
		const tags = (this.libraryItemFor(selected.customRef)?.tags || []).join(", ");
		return (
			<>
				{preview ? (
					<VisFileImage
						src={preview}
						alt=""
						width={72}
						height={72}
						style={{ objectFit: "contain", border: "1px solid #ddd", borderRadius: 8 }}
					/>
				) : null}
				<TextField
					size="small"
					label={this.isDe() ? "URL oder Dateipfad" : "Custom URL or file path"}
					value={selected.customRef || ""}
					onChange={e => this.updateItem(this.state.selectedIndex, { customRef: e.target.value })}
				/>
				{tags ? <Typography variant="caption">Tags: {tags}</Typography> : null}
				<TextField
					size="small"
					fullWidth
					label={this.isDe() ? "Eigene Bilder suchen" : "Search own images"}
					value={this.state.searchQuery}
					onChange={e => this.setState({ searchQuery: e.target.value })}
				/>
				{this.state.searchError ? (
					<Typography
						color="error"
						variant="caption"
					>
						{this.state.searchError}
					</Typography>
				) : null}
				<Typography
					variant="caption"
					sx={{ fontWeight: 700 }}
				>
					{this.isDe() ? "Gespeicherte Bilder – antippen zum Auswählen" : "Saved images – tap to select"}
				</Typography>
				<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, maxHeight: 260, overflowY: "auto" }}>
					{items.length ? (
						items.map(item => this.renderLibraryThumb(item, thumb, instance))
					) : (
						<Typography
							variant="caption"
							sx={{ opacity: 0.75 }}
						>
							{this.isDe()
								? "Noch keine eigenen Bilder. Bitte in den Instanzeinstellungen (Admin) hochladen und mit Tags versehen."
								: "No own images yet. Upload and tag them in the Admin instance settings."}
						</Typography>
					)}
				</Box>
				<Typography
					variant="caption"
					sx={{ opacity: 0.75 }}
				>
					{this.isDe()
						? "Upload und Tags nur in den Instanzeinstellungen (Admin, Reiter Piktogramme). Die Suche hier findet eigene Bilder über Name und Tags."
						: "Upload and tags are only in Admin instance settings (Pictograms tab). Search here finds own images by name and tags."}
				</Typography>
			</>
		);
	}

	renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
		super.renderWidgetBody(props);

		const basePeriods = parseDayPeriods(this.state.values[`${this.state.rxData.oidPeriods}.val`]);
		const overrides = this.getMergedPeriodOverrides();
		const periods = applyPeriodOverrides(basePeriods, overrides);
		const nowMinutes = Number(this.state.values[`${this.state.rxData.oidNowMinutes}.val`] ?? 0);
		const selected = this.state.selectedIndex >= 0 ? this.state.draft.items[this.state.selectedIndex] : null;

		return (
			<Box sx={{ width: "100%", height: "100%", overflow: "auto", p: 1, boxSizing: "border-box" }}>
				<Stack
					direction={{ xs: "column", md: "row" }}
					spacing={2}
					sx={{ minHeight: "100%" }}
				>
					<Box sx={{ flex: 1, minWidth: 280 }}>
						<Typography
							variant="subtitle1"
							sx={{ mb: 1, fontWeight: 700 }}
						>
							Schedule
						</Typography>
						<Stack
							direction="row"
							spacing={1}
							sx={{ mb: 1, flexWrap: "wrap" }}
						>
							<Button
								size="small"
								variant="outlined"
								disabled={this.state.busy}
								onClick={() =>
									this.setState(prev => ({
										draft: { version: 1, items: [...prev.draft.items, newItem()] },
										selectedIndex: prev.draft.items.length,
									}))
								}
							>
								+ Item
							</Button>
							<Button
								size="small"
								variant="outlined"
								color="error"
								disabled={this.state.busy || this.state.selectedIndex < 0}
								onClick={() =>
									this.setState(prev => {
										const items = prev.draft.items.filter((_, i) => i !== prev.selectedIndex);
										return {
											draft: { version: 1, items },
											selectedIndex: items.length ? Math.max(0, prev.selectedIndex - 1) : -1,
										};
									})
								}
							>
								Delete
							</Button>
							<Button
								size="small"
								variant="contained"
								disabled={this.state.busy}
								onClick={() => void this.savePlan()}
							>
								Save
							</Button>
							<Button
								size="small"
								variant="outlined"
								color="warning"
								disabled={this.state.busy || this.state.draft.items.length === 0}
								onClick={() => void this.resetPlan()}
							>
								Reset
							</Button>
						</Stack>

						<FormControlLabel
							sx={{ mb: 1 }}
							control={
								<Checkbox
									size="small"
									checked={this.getClearAfterLastChecked()}
									onChange={(_, checked) => void this.setClearAfterLast(checked)}
								/>
							}
							label={
								(this.props.context?.lang || "de").startsWith("de")
									? "Plan nach Ablauf löschen"
									: "Clear plan after last pictogram"
							}
						/>

						<Typography
							variant="subtitle2"
							sx={{ mt: 1, mb: 0.5, fontWeight: 700 }}
						>
							Tagesbereiche
						</Typography>
						<FormGroup
							row
							sx={{ mb: 2 }}
						>
							{basePeriods.map((period: DayPeriodDefinition) => (
								<FormControlLabel
									key={period.id}
									control={
										<Checkbox
											size="small"
											checked={periods.find(p => p.id === period.id)?.enabled !== false}
											onChange={(_, checked) => void this.setPeriodEnabled(period.id, checked)}
										/>
									}
									label={
										<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
											<PeriodIcon
												periodId={period.id}
												size={22}
												alt=""
											/>
											<span
												style={{
													width: 10,
													height: 10,
													borderRadius: 2,
													background: period.color,
													display: "inline-block",
												}}
											/>
											{this.periodLabel(period.id)}
										</span>
									}
								/>
							))}
						</FormGroup>

						<Stack
							spacing={1}
							sx={{ mb: 2 }}
						>
							{this.state.draft.items.map((item, index) => (
								<Button
									key={item.id}
									size="small"
									variant={index === this.state.selectedIndex ? "contained" : "outlined"}
									onClick={() =>
										this.setState({
											selectedIndex: index,
											searchError: "",
										})
									}
									sx={{ justifyContent: "flex-start", textTransform: "none" }}
								>
									{item.label || item.id} ({item.start}-{item.end})
								</Button>
							))}
						</Stack>

						{selected && (
							<Stack spacing={1.5}>
								<TextField
									size="small"
									label="Label"
									value={selected.label}
									onChange={e => this.updateItem(this.state.selectedIndex, { label: e.target.value })}
								/>
								<Stack
									direction="row"
									spacing={1}
								>
									<TextField
										size="small"
										label="Start"
										value={selected.start}
										onChange={e =>
											this.updateItem(this.state.selectedIndex, { start: e.target.value })
										}
									/>
									<TextField
										size="small"
										label="End"
										value={selected.end}
										onChange={e =>
											this.updateItem(this.state.selectedIndex, { end: e.target.value })
										}
									/>
								</Stack>
								<FormControl size="small">
									<InputLabel>Source</InputLabel>
									<Select
										label="Source"
										value={selected.source}
										onChange={e =>
											this.updateItem(this.state.selectedIndex, {
												source: e.target.value as ScheduleItem["source"],
											})
										}
									>
										<MenuItem value="arasaac">ARASAAC (external)</MenuItem>
										<MenuItem value="custom">Custom / URL</MenuItem>
									</Select>
								</FormControl>

								{selected.source === "arasaac" ? (
									<>
										<TextField
											size="small"
											label="ARASAAC ID"
											type="number"
											value={selected.arasaacId ?? ""}
											onChange={e =>
												this.updateItem(this.state.selectedIndex, {
													arasaacId: Number(e.target.value) || undefined,
												})
											}
										/>
										<Stack
											direction="row"
											spacing={1}
										>
											<TextField
												size="small"
												fullWidth
												label={
													this.isDe()
														? "Suche (ARASAAC + eigene Tags)"
														: "Search (ARASAAC + own tags)"
												}
												value={this.state.searchQuery}
												onChange={e => this.setState({ searchQuery: e.target.value })}
												onKeyDown={e => {
													if (e.key === "Enter") {
														void this.runSearch();
													}
												}}
											/>
											<Button
												variant="outlined"
												disabled={this.state.busy}
												onClick={() => void this.runSearch()}
											>
												{this.isDe() ? "Suchen" : "Search"}
											</Button>
										</Stack>
										{this.state.searchError ? (
											<Typography
												color="error"
												variant="caption"
											>
												{this.state.searchError}
											</Typography>
										) : null}
										{this.renderCustomHits()}
										<Box
											sx={{
												display: "flex",
												flexWrap: "wrap",
												gap: 1,
												maxHeight: 220,
												overflowY: "auto",
											}}
										>
											{this.state.searchHits.map(hit => {
												const thumb = Math.max(
													48,
													Math.min(96, Number(this.state.rxData.pictogramSize) || 64),
												);
												return (
													<Box
														key={hit.id}
														component="button"
														type="button"
														title={hit.keyword}
														onClick={() =>
															this.updateItem(this.state.selectedIndex, {
																source: "arasaac",
																arasaacId: hit.id,
																label: selected.label || hit.keyword,
															})
														}
														sx={{
															width: thumb + 16,
															p: 0.5,
															border: "1px solid",
															borderColor: "divider",
															borderRadius: 1,
															background: "#fff",
															cursor: "pointer",
															display: "flex",
															flexDirection: "column",
															alignItems: "center",
															gap: 0.5,
															"&:hover": { borderColor: "primary.main" },
														}}
													>
														<img
															src={arasaacImageUrl(hit.id, 500)}
															alt=""
															width={thumb}
															height={thumb}
															style={{ objectFit: "contain", display: "block" }}
															referrerPolicy="no-referrer"
															loading="lazy"
														/>
														<Typography
															variant="caption"
															sx={{
																maxWidth: thumb + 8,
																overflow: "hidden",
																textOverflow: "ellipsis",
																whiteSpace: "nowrap",
																lineHeight: 1.2,
															}}
														>
															{hit.keyword}
														</Typography>
													</Box>
												);
											})}
										</Box>
										<Typography
											variant="caption"
											sx={{ opacity: 0.75 }}
										>
											{this.isDe()
												? "ARASAAC-Bilder kommen nur von static.arasaac.org (CC BY-NC-SA)."
												: "ARASAAC images are loaded from static.arasaac.org only (CC BY-NC-SA)."}
										</Typography>
									</>
								) : (
									this.renderCustomEditor(selected)
								)}
							</Stack>
						)}
					</Box>

					<Box sx={{ flex: 1, minHeight: 320, border: "1px solid #ddd", borderRadius: 2 }}>
						<DailyScheduleVisual
							plan={this.state.draft}
							periods={periods}
							nowMinutes={nowMinutes}
							adapterInstance={this.state.rxData.adapterInstance || "autism-support.0"}
							pictogramSize={Number(this.state.rxData.pictogramSize) || 64}
							locale={this.props.context?.lang || "de"}
						/>
					</Box>
				</Stack>
			</Box>
		);
	}
}

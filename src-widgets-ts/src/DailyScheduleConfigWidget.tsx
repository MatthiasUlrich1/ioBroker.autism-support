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
import { arasaacImageUrl, searchArasaac, type ArasaacSearchHit } from "./lib/arasaac";
import {
	applyPeriodOverrides,
	parseDayPeriods,
	parsePeriodOverrides,
	parseSchedulePlan,
	type DayPeriodDefinition,
	type ScheduleItem,
	type SchedulePlan,
} from "./lib/schedule";

interface DailyScheduleConfigRxData {
	oidPlan: string;
	oidPeriods: string;
	oidPeriodOverrides: string;
	oidNowMinutes: string;
	oidCurrentItemIndex: string;
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
	}

	onStateUpdated(id: string, _state: ioBroker.State | null | undefined): void {
		if (id === this.state.rxData.oidPlan) {
			this.syncDraftFromState();
		}
	}

	private syncDraftFromState(): void {
		const plan = parseSchedulePlan(this.state.values[`${this.state.rxData.oidPlan}.val`]);
		this.setState({ draft: plan, selectedIndex: plan.items.length ? 0 : -1 });
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
		this.setState({ busy: true });
		try {
			await this.props.context.socket.setState(oid, JSON.stringify(this.state.draft), false);
		} finally {
			this.setState({ busy: false });
		}
	}

	private async setPeriodEnabled(periodId: string, enabled: boolean): Promise<void> {
		const oid = this.state.rxData.oidPeriodOverrides;
		if (!oid) {
			return;
		}
		const current = parsePeriodOverrides(this.state.values[`${oid}.val`]);
		const next = { ...current, [periodId]: enabled };
		this.setState({ busy: true });
		try {
			await this.props.context.socket.setState(oid, JSON.stringify(next), false);
		} finally {
			this.setState({ busy: false });
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

	private async runSearch(): Promise<void> {
		this.setState({ busy: true, searchError: "" });
		try {
			const hits = await searchArasaac(
				this.state.rxData.arasaacLanguage || "de",
				this.state.searchQuery,
			);
			this.setState({ searchHits: hits });
		} catch (error) {
			this.setState({ searchError: (error as Error).message, searchHits: [] });
		} finally {
			this.setState({ busy: false });
		}
	}

	private async uploadCustomFile(file: File): Promise<void> {
		const index = this.state.selectedIndex;
		if (index < 0) {
			return;
		}
		this.setState({ busy: true, searchError: "" });
		try {
			const buffer = await file.arrayBuffer();
			const bytes = new Uint8Array(buffer);
			let binary = "";
			bytes.forEach(b => {
				binary += String.fromCharCode(b);
			});
			const base64 = btoa(binary);
			const instance = this.state.rxData.adapterInstance || "autism-support.0";
			const result = (await this.props.context.socket.sendTo(instance, "uploadPictogram", {
				filename: file.name,
				base64,
				mime: file.type,
			})) as { ok?: boolean; path?: string; error?: string };

			if (!result?.ok || !result.path) {
				throw new Error(result?.error || "upload failed");
			}
			this.updateItem(index, { source: "custom", customRef: result.path, arasaacId: undefined });
		} catch (error) {
			this.setState({ searchError: (error as Error).message });
		} finally {
			this.setState({ busy: false });
		}
	}

	renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
		super.renderWidgetBody(props);

		const basePeriods = parseDayPeriods(this.state.values[`${this.state.rxData.oidPeriods}.val`]);
		const overrides = parsePeriodOverrides(
			this.state.values[`${this.state.rxData.oidPeriodOverrides}.val`],
		);
		const periods = applyPeriodOverrides(basePeriods, overrides);
		const nowMinutes = Number(this.state.values[`${this.state.rxData.oidNowMinutes}.val`] ?? 0);
		const currentItemIndex = Number(
			this.state.values[`${this.state.rxData.oidCurrentItemIndex}.val`] ?? -1,
		);
		const selected =
			this.state.selectedIndex >= 0 ? this.state.draft.items[this.state.selectedIndex] : null;

		return (
			<Box sx={{ width: "100%", height: "100%", overflow: "auto", p: 1, boxSizing: "border-box" }}>
				<Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ minHeight: "100%" }}>
					<Box sx={{ flex: 1, minWidth: 280 }}>
						<Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 700 }}>
							Schedule
						</Typography>
						<Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
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
						</Stack>

						<Typography variant="subtitle2" sx={{ mt: 1, mb: 0.5, fontWeight: 700 }}>
							Tagesbereiche
						</Typography>
						<FormGroup row sx={{ mb: 2 }}>
							{basePeriods.map((period: DayPeriodDefinition) => (
								<FormControlLabel
									key={period.id}
									control={
										<Checkbox
											size="small"
											checked={periods.find(p => p.id === period.id)?.enabled !== false}
											disabled={this.state.busy}
											onChange={(_, checked) => void this.setPeriodEnabled(period.id, checked)}
										/>
									}
									label={
										<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
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

						<Stack spacing={1} sx={{ mb: 2 }}>
							{this.state.draft.items.map((item, index) => (
								<Button
									key={item.id}
									size="small"
									variant={index === this.state.selectedIndex ? "contained" : "outlined"}
									onClick={() => this.setState({ selectedIndex: index })}
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
								<Stack direction="row" spacing={1}>
									<TextField
										size="small"
										label="Start"
										value={selected.start}
										onChange={e => this.updateItem(this.state.selectedIndex, { start: e.target.value })}
									/>
									<TextField
										size="small"
										label="End"
										value={selected.end}
										onChange={e => this.updateItem(this.state.selectedIndex, { end: e.target.value })}
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
										<MenuItem value="custom">Custom upload / URL</MenuItem>
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
										<Stack direction="row" spacing={1}>
											<TextField
												size="small"
												fullWidth
												label="Search ARASAAC"
												value={this.state.searchQuery}
												onChange={e => this.setState({ searchQuery: e.target.value })}
											/>
											<Button
												variant="outlined"
												disabled={this.state.busy}
												onClick={() => void this.runSearch()}
											>
												Search
											</Button>
										</Stack>
										{this.state.searchError ? (
											<Typography color="error" variant="caption">
												{this.state.searchError}
											</Typography>
										) : null}
										<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, maxHeight: 220, overflowY: "auto" }}>
											{this.state.searchHits.map(hit => {
												const thumb = Math.max(48, Math.min(96, Number(this.state.rxData.pictogramSize) || 64));
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
										<Typography variant="caption" sx={{ opacity: 0.75 }}>
											ARASAAC images are loaded from static.arasaac.org only (CC BY-NC-SA).
										</Typography>
									</>
								) : (
									<>
										<TextField
											size="small"
											label="Custom URL or file path"
											value={selected.customRef || ""}
											onChange={e =>
												this.updateItem(this.state.selectedIndex, { customRef: e.target.value })
											}
										/>
										<Button variant="outlined" component="label" disabled={this.state.busy}>
											Upload image
											<input
												hidden
												type="file"
												accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
												onChange={e => {
													const file = e.target.files?.[0];
													if (file) {
														void this.uploadCustomFile(file);
													}
													e.target.value = "";
												}}
											/>
										</Button>
										<Typography variant="caption" sx={{ opacity: 0.75 }}>
											Only upload images you own or are licensed to use. Do not upload ARASAAC
											files here.
										</Typography>
									</>
								)}
							</Stack>
						)}
					</Box>

					<Box sx={{ flex: 1, minHeight: 320, border: "1px solid #ddd", borderRadius: 2 }}>
						<DailyScheduleVisual
							plan={this.state.draft}
							periods={periods}
							nowMinutes={nowMinutes}
							currentItemIndex={currentItemIndex}
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

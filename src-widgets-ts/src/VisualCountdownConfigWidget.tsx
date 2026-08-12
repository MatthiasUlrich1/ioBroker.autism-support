import React from "react";
import { Box, Button, Stack } from "@mui/material";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps, VisRxWidgetState } from "@iobroker/types-vis-2";
import type VisRxWidget from "@iobroker/types-vis-2/visRxWidget";

import DurationStepper from "./components/DurationStepper";
import VisualCountdownVisual from "./components/VisualCountdownVisual";

interface VisualCountdownConfigRxData {
	oidDuration: string;
	oidRemaining: string;
	oidStart: string;
	oidPause: string;
	oidResume: string;
	oidStop: string;
	maxDurationHours: number;
	colorDigital: string;
	colorRemaining: string;
	colorElapsed: string;
	colorControlsText: string;
	colorControlsBorder: string;
	colorControlsArrows: string;
}

interface VisualCountdownConfigState extends VisRxWidgetState {
	durationHours: number;
	durationMinutes: number;
}

function resolveOid(oid: string): string {
	return (oid || "").replace(/[{}]/g, "").trim();
}

function secondsToParts(totalSeconds: number): { hours: number; minutes: number } {
	const safe = Math.max(0, Math.round(totalSeconds));
	return {
		hours: Math.floor(safe / 3600),
		minutes: Math.floor((safe % 3600) / 60),
	};
}

export default class VisualCountdownConfigWidget extends (window.visRxWidget as typeof VisRxWidget)<
	VisualCountdownConfigRxData,
	VisualCountdownConfigState
> {
	static adapter: string;

	constructor(props: VisRxWidgetProps) {
		super(props);
		this.state = {
			...this.state,
			durationHours: 1,
			durationMinutes: 0,
		};
	}

	static getWidgetInfo(): RxWidgetInfo {
		return {
			id: "asVisualCountdownConfig",
			visSet: "autism-support",
			visName: "VisualCountdownConfig",
			visAttrs: [
				{
					name: "timer",
					label: "timer_states",
					fields: [
						{
							name: "oidDuration",
							type: "id",
							label: "oid_duration",
							default: "autism-support.0.timer.duration",
						},
						{
							name: "oidRemaining",
							type: "id",
							label: "oid_remaining",
							default: "autism-support.0.timer.remaining",
						},
						{
							name: "oidStart",
							type: "id",
							label: "oid_start",
							default: "autism-support.0.timer.start",
						},
						{
							name: "oidPause",
							type: "id",
							label: "oid_pause",
							default: "autism-support.0.timer.pause",
						},
						{
							name: "oidResume",
							type: "id",
							label: "oid_resume",
							default: "autism-support.0.timer.resume",
						},
						{
							name: "oidStop",
							type: "id",
							label: "oid_stop",
							default: "autism-support.0.timer.stop",
						},
						{
							name: "maxDurationHours",
							type: "number",
							label: "max_duration_hours",
							default: 24,
							min: 1,
							max: 24,
						},
					],
				},
				{
					name: "appearance",
					label: "appearance",
					fields: [
						{
							name: "colorDigital",
							type: "color",
							label: "color_digital",
							default: "#000000",
						},
						{
							name: "colorRemaining",
							type: "color",
							label: "color_remaining",
							default: "#E53935",
						},
						{
							name: "colorElapsed",
							type: "color",
							label: "color_elapsed",
							default: "#FFFFFF",
						},
						{
							name: "colorControlsText",
							type: "color",
							label: "color_controls_text",
							default: "#000000",
						},
						{
							name: "colorControlsBorder",
							type: "color",
							label: "color_controls_border",
							default: "#9E9E9E",
						},
						{
							name: "colorControlsArrows",
							type: "color",
							label: "color_controls_arrows",
							default: "#000000",
						},
					],
				},
			],
			visPrev: "widgets/autism-support/img/visual-countdown-config.png",
		};
	}

	getWidgetInfo(): RxWidgetInfo {
		return VisualCountdownConfigWidget.getWidgetInfo();
	}

	static getI18nPrefix(): string {
		return `${VisualCountdownConfigWidget.adapter}_`;
	}

	componentDidMount(): void {
		super.componentDidMount();
		this.syncDurationInputsFromState();
	}

	onStateUpdated(id: string, state: ioBroker.State | null | undefined): void {
		if (id === resolveOid(this.state.rxData.oidDuration) && typeof state?.val === "number") {
			const parts = secondsToParts(state.val);
			this.setState({
				durationHours: parts.hours,
				durationMinutes: parts.minutes,
			});
		}
	}

	private syncDurationInputsFromState(): void {
		const duration = Number(this.state.values[`${this.state.rxData.oidDuration}.val`]);
		if (Number.isFinite(duration)) {
			const parts = secondsToParts(duration);
			this.setState({
				durationHours: parts.hours,
				durationMinutes: parts.minutes,
			});
		}
	}

	private sendState(oid: string, value: boolean | number): void {
		const id = resolveOid(oid);
		if (!id || !this.props.context?.socket?.setState) {
			return;
		}
		void this.props.context.socket.setState(id, { val: value, ack: false });
	}

	private applyDuration(): void {
		const maxHours = Number(this.state.rxData.maxDurationHours) || 24;
		const hours = Math.min(maxHours, Math.max(0, this.state.durationHours));
		const minutes = Math.min(59, Math.max(0, this.state.durationMinutes));
		const totalSeconds = hours * 3600 + minutes * 60;

		if (totalSeconds < 60) {
			return;
		}

		this.sendState(this.state.rxData.oidDuration, totalSeconds);
	}

	renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
		super.renderWidgetBody(props);

		const duration = Number(this.state.values[`${this.state.rxData.oidDuration}.val`] ?? 3600);
		const remaining = Number(this.state.values[`${this.state.rxData.oidRemaining}.val`] ?? duration);
		const maxHours = Number(this.state.rxData.maxDurationHours) || 24;

		return (
			<Box sx={{ width: "100%", height: "100%", bgcolor: "transparent", p: 1, boxSizing: "border-box" }}>
				<Stack spacing={1} sx={{ height: "100%" }}>
					<Box sx={{ flex: 1, minHeight: 180 }}>
						<VisualCountdownVisual
							durationSeconds={duration}
							remainingSeconds={remaining}
							size={220}
							colorDigital={this.state.rxData.colorDigital || "#000000"}
							colorRemaining={this.state.rxData.colorRemaining || "#E53935"}
							colorElapsed={this.state.rxData.colorElapsed || "#FFFFFF"}
						/>
					</Box>
					<Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
						<DurationStepper
							hours={this.state.durationHours}
							minutes={this.state.durationMinutes}
							maxHours={maxHours}
							hoursLabel={VisualCountdownConfigWidget.t("hours")}
							minutesLabel={VisualCountdownConfigWidget.t("minutes")}
							colorText={this.state.rxData.colorControlsText || "#000000"}
							colorBorder={this.state.rxData.colorControlsBorder || "#9E9E9E"}
							colorArrows={this.state.rxData.colorControlsArrows || "#000000"}
							onChange={(hours, minutes) => this.setState({ durationHours: hours, durationMinutes: minutes })}
						/>
						<Button
							variant="outlined"
							onClick={() => this.applyDuration()}
							sx={{
								color: this.state.rxData.colorControlsText || "#000000",
								borderColor: this.state.rxData.colorControlsBorder || "#9E9E9E",
							}}
						>
							{VisualCountdownConfigWidget.t("apply_duration")}
						</Button>
					</Stack>
					<Stack direction="row" spacing={1} flexWrap="wrap">
						<Button variant="contained" color="success" onClick={() => this.sendState(this.state.rxData.oidStart, true)}>
							{VisualCountdownConfigWidget.t("start")}
						</Button>
						<Button variant="contained" color="warning" onClick={() => this.sendState(this.state.rxData.oidPause, true)}>
							{VisualCountdownConfigWidget.t("pause")}
						</Button>
						<Button variant="contained" color="info" onClick={() => this.sendState(this.state.rxData.oidResume, true)}>
							{VisualCountdownConfigWidget.t("resume")}
						</Button>
						<Button variant="contained" color="error" onClick={() => this.sendState(this.state.rxData.oidStop, true)}>
							{VisualCountdownConfigWidget.t("stop")}
						</Button>
					</Stack>
				</Stack>
			</Box>
		);
	}
}

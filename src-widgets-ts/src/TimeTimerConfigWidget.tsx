import React from "react";
import { Box, Button, Stack, TextField } from "@mui/material";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps, VisRxWidgetState } from "@iobroker/types-vis-2";
import type VisRxWidget from "@iobroker/types-vis-2/visRxWidget";

import TimeTimerVisual from "./components/TimeTimerVisual";

interface TimeTimerConfigRxData {
	oidDuration: string;
	oidRemaining: string;
	oidSetDurationMinutes: string;
	oidStart: string;
	oidPause: string;
	oidResume: string;
	oidStop: string;
}

interface TimeTimerConfigState extends VisRxWidgetState {
	durationMinutesInput: string;
}

export default class TimeTimerConfigWidget extends (window.visRxWidget as typeof VisRxWidget)<
	TimeTimerConfigRxData,
	TimeTimerConfigState
> {
	static adapter: string;

	constructor(props: VisRxWidgetProps) {
		super(props);
		this.state = {
			...this.state,
			durationMinutesInput: "60",
		};
	}

	static getWidgetInfo(): RxWidgetInfo {
		return {
			id: "asTimeTimerConfig",
			visSet: "autism-support",
			visName: "TimeTimerConfig",
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
							name: "oidSetDurationMinutes",
							type: "id",
							label: "oid_set_duration",
							default: "autism-support.0.timer.setDurationMinutes",
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
					],
				},
			],
			visPrev: "widgets/autism-support/img/time-timer-config.png",
		};
	}

	getWidgetInfo(): RxWidgetInfo {
		return TimeTimerConfigWidget.getWidgetInfo();
	}

	static getI18nPrefix(): string {
		return `${TimeTimerConfigWidget.adapter}_`;
	}

	private sendCommand(oid: string, value: boolean | number): void {
		if (!oid) {
			return;
		}
		void this.props.context.socket.setState(oid, value);
	}

	renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
		super.renderWidgetBody(props);

		const duration = Number(this.state.values[`${this.state.rxData.oidDuration}.val`] ?? 3600);
		const remaining = Number(this.state.values[`${this.state.rxData.oidRemaining}.val`] ?? duration);

		return (
			<Box sx={{ width: "100%", height: "100%", bgcolor: "#FFFFFF", p: 1, boxSizing: "border-box" }}>
				<Stack spacing={1} sx={{ height: "100%" }}>
					<Box sx={{ flex: 1, minHeight: 180 }}>
						<TimeTimerVisual durationSeconds={duration} remainingSeconds={remaining} size={220} />
					</Box>
					<Stack direction="row" spacing={1} alignItems="center">
						<TextField
							size="small"
							type="number"
							label={TimeTimerConfigWidget.t("duration_minutes")}
							value={this.state.durationMinutesInput}
							onChange={(event) => this.setState({ durationMinutesInput: event.target.value })}
							inputProps={{ min: 1, max: 1440 }}
							sx={{ width: 140 }}
						/>
						<Button
							variant="outlined"
							onClick={() => {
								const minutes = Number(this.state.durationMinutesInput);
								if (Number.isFinite(minutes) && minutes > 0) {
									this.sendCommand(this.state.rxData.oidSetDurationMinutes, minutes);
								}
							}}
						>
							{TimeTimerConfigWidget.t("apply_duration")}
						</Button>
					</Stack>
					<Stack direction="row" spacing={1} flexWrap="wrap">
						<Button variant="contained" color="success" onClick={() => this.sendCommand(this.state.rxData.oidStart, true)}>
							{TimeTimerConfigWidget.t("start")}
						</Button>
						<Button variant="contained" color="warning" onClick={() => this.sendCommand(this.state.rxData.oidPause, true)}>
							{TimeTimerConfigWidget.t("pause")}
						</Button>
						<Button variant="contained" color="info" onClick={() => this.sendCommand(this.state.rxData.oidResume, true)}>
							{TimeTimerConfigWidget.t("resume")}
						</Button>
						<Button variant="contained" color="error" onClick={() => this.sendCommand(this.state.rxData.oidStop, true)}>
							{TimeTimerConfigWidget.t("stop")}
						</Button>
					</Stack>
				</Stack>
			</Box>
		);
	}
}

import React from "react";
import { Box } from "@mui/material";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps, VisRxWidgetState } from "@iobroker/types-vis-2";
import type VisRxWidget from "@iobroker/types-vis-2/visRxWidget";

import TimeTimerVisual from "./components/TimeTimerVisual";

interface TimeTimerLiveRxData {
	oidDuration: string;
	oidRemaining: string;
	colorDigital: string;
	colorRemaining: string;
	colorElapsed: string;
}

export default class TimeTimerLiveWidget extends (window.visRxWidget as typeof VisRxWidget)<
	TimeTimerLiveRxData,
	VisRxWidgetState
> {
	static adapter: string;

	static getWidgetInfo(): RxWidgetInfo {
		return {
			id: "asTimeTimerLive",
			visSet: "autism-support",
			visSetIcon: "widgets/autism-support/img/autism-support.svg",
			visSetLabel: "autism_support_widgets",
			visSetColor: "#E53935",
			visName: "TimeTimerLive",
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
					],
				},
			],
			visPrev: "widgets/autism-support/img/time-timer-live.png",
		};
	}

	constructor(props: VisRxWidgetProps) {
		super(props);
	}

	getWidgetInfo(): RxWidgetInfo {
		return TimeTimerLiveWidget.getWidgetInfo();
	}

	static getI18nPrefix(): string {
		return `${TimeTimerLiveWidget.adapter}_`;
	}

	renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
		super.renderWidgetBody(props);

		const duration = Number(this.state.values[`${this.state.rxData.oidDuration}.val`] ?? 3600);
		const remaining = Number(this.state.values[`${this.state.rxData.oidRemaining}.val`] ?? duration);

		return (
			<Box sx={{ width: "100%", height: "100%", bgcolor: "transparent" }}>
				<TimeTimerVisual
					durationSeconds={duration}
					remainingSeconds={remaining}
					colorDigital={this.state.rxData.colorDigital || "#000000"}
					colorRemaining={this.state.rxData.colorRemaining || "#E53935"}
					colorElapsed={this.state.rxData.colorElapsed || "#FFFFFF"}
				/>
			</Box>
		);
	}
}

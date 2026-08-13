import React from "react";
import { Box } from "@mui/material";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps, VisRxWidgetState } from "@iobroker/types-vis-2";
import type VisRxWidget from "@iobroker/types-vis-2/visRxWidget";

import DailyScheduleVisual from "./components/DailyScheduleVisual";
import { parseDayPeriods, parseSchedulePlan } from "./lib/schedule";

interface DailyScheduleLiveRxData {
	oidPlan: string;
	oidPeriods: string;
	oidNowMinutes: string;
	oidCurrentItemIndex: string;
	adapterInstance: string;
	pictogramSize: number;
}

export default class DailyScheduleLiveWidget extends (window.visRxWidget as typeof VisRxWidget)<
	DailyScheduleLiveRxData,
	VisRxWidgetState
> {
	static adapter: string;

	static getWidgetInfo(): RxWidgetInfo {
		return {
			id: "asDailyScheduleLive",
			visSet: "autism-support",
			visSetIcon: "widgets/autism-support/img/autism-support.svg",
			visSetLabel: "autism_support_widgets",
			visSetColor: "#FF8A00",
			visName: "DailyScheduleLive",
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
			visPrev: "widgets/autism-support/img/daily-schedule-live.png",
		};
	}

	constructor(props: VisRxWidgetProps) {
		super(props);
	}

	getWidgetInfo(): RxWidgetInfo {
		return DailyScheduleLiveWidget.getWidgetInfo();
	}

	static getI18nPrefix(): string {
		return `${DailyScheduleLiveWidget.adapter}_`;
	}

	renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
		super.renderWidgetBody(props);

		const plan = parseSchedulePlan(this.state.values[`${this.state.rxData.oidPlan}.val`]);
		const periods = parseDayPeriods(this.state.values[`${this.state.rxData.oidPeriods}.val`]);
		const nowMinutes = Number(this.state.values[`${this.state.rxData.oidNowMinutes}.val`] ?? 0);
		const currentItemIndex = Number(
			this.state.values[`${this.state.rxData.oidCurrentItemIndex}.val`] ?? -1,
		);

		return (
			<Box sx={{ width: "100%", height: "100%", bgcolor: "transparent" }}>
				<DailyScheduleVisual
					plan={plan}
					periods={periods}
					nowMinutes={nowMinutes}
					currentItemIndex={currentItemIndex}
					adapterInstance={this.state.rxData.adapterInstance || "autism-support.0"}
					pictogramSize={Number(this.state.rxData.pictogramSize) || 64}
					locale={this.props.context?.lang || "de"}
				/>
			</Box>
		);
	}
}

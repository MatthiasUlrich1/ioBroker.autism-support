import React from "react";
import { Box } from "@mui/material";

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps, VisRxWidgetState } from "@iobroker/types-vis-2";
import type VisRxWidget from "@iobroker/types-vis-2/visRxWidget";

import WeeklyScheduleOverview from "./components/WeeklyScheduleOverview";
import { parseWeekdayColors, parseWeeklyPlan } from "./lib/weekly-plan";

interface WeeklyScheduleLiveRxData {
	oidWeeklyPlan: string;
	oidWeekdayColors: string;
	adapterInstance: string;
	pictogramSize: number;
}

export default class WeeklyScheduleLiveWidget extends (window.visRxWidget as typeof VisRxWidget)<
	WeeklyScheduleLiveRxData,
	VisRxWidgetState
> {
	static adapter: string;

	static getWidgetInfo(): RxWidgetInfo {
		return {
			id: "asWeeklyScheduleLive",
			visSet: "autism-support",
			visSetIcon: "widgets/autism-support/img/autism-support.svg",
			visSetLabel: "autism_support_widgets",
			visSetColor: "#FF8A00",
			visName: "WeeklyScheduleLive",
			visAttrs: [
				{
					name: "schedule",
					label: "schedule_states",
					fields: [
						{
							name: "oidWeeklyPlan",
							type: "id",
							label: "oid_weekly_plan",
							default: "autism-support.0.schedule.weeklyPlan",
						},
						{
							name: "oidWeekdayColors",
							type: "id",
							label: "oid_weekday_colors",
							default: "autism-support.0.schedule.weekdayColors",
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
							default: 40,
							min: 24,
							max: 120,
							step: 4,
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
		return WeeklyScheduleLiveWidget.getWidgetInfo();
	}

	static getI18nPrefix(): string {
		return `${WeeklyScheduleLiveWidget.adapter}_`;
	}

	renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element {
		super.renderWidgetBody(props);

		const weeklyPlan = parseWeeklyPlan(this.state.values[`${this.state.rxData.oidWeeklyPlan}.val`]);
		const colors = parseWeekdayColors(this.state.values[`${this.state.rxData.oidWeekdayColors}.val`]);

		return (
			<Box sx={{ width: "100%", height: "100%", bgcolor: "transparent" }}>
				<WeeklyScheduleOverview
					weeklyPlan={weeklyPlan}
					colors={colors}
					adapterInstance={this.state.rxData.adapterInstance || "autism-support.0"}
					pictogramSize={Number(this.state.rxData.pictogramSize) || 40}
					locale={this.props.context?.lang || "de"}
				/>
			</Box>
		);
	}
}

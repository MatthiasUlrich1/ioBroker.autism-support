import React from "react";
import { Box, Typography } from "@mui/material";

import VisFileImage from "./VisFileImage";
import { resolveItemImageUrl } from "../lib/schedule";
import {
	WEEKDAY_KEYS,
	WEEKDAY_LABELS_DE,
	WEEKDAY_LABELS_EN,
	weekdayKeyFromDate,
	type WeekdayColors,
	type WeekdayKey,
	type WeeklyPlanData,
} from "../lib/weekly-plan";

export interface WeeklyScheduleOverviewProps {
	weeklyPlan: WeeklyPlanData;
	colors: WeekdayColors;
	adapterInstance: string;
	pictogramSize?: number;
	locale?: string;
	/** Highlight this weekday (default: today) */
	highlightDay?: WeekdayKey;
}

export default function WeeklyScheduleOverview(props: WeeklyScheduleOverviewProps): React.JSX.Element {
	const size = Math.max(28, Math.min(72, Number(props.pictogramSize) || 40));
	const isDe = (props.locale || "de").startsWith("de");
	const labels = isDe ? WEEKDAY_LABELS_DE : WEEKDAY_LABELS_EN;
	const today = props.highlightDay || weekdayKeyFromDate(new Date());

	return (
		<Box
			sx={{
				width: "100%",
				height: "100%",
				display: "grid",
				gridTemplateColumns: {
					xs: "1fr",
					sm: "repeat(2, 1fr)",
					md: "repeat(7, 1fr)",
				},
				gap: 1,
				p: 1,
				boxSizing: "border-box",
				overflow: "auto",
			}}
		>
			{WEEKDAY_KEYS.map(day => {
				const plan = props.weeklyPlan.days[day];
				const isToday = day === today;
				return (
					<Box
						key={day}
						sx={{
							bgcolor: props.colors[day],
							borderRadius: 2,
							border: isToday ? "2px solid #333" : "1px solid rgba(0,0,0,0.12)",
							p: 1,
							minHeight: 120,
							display: "flex",
							flexDirection: "column",
							gap: 0.75,
						}}
					>
						<Typography
							variant="subtitle2"
							sx={{ fontWeight: 800, textAlign: "center" }}
						>
							{labels[day]}
							{isToday ? (isDe ? " · heute" : " · today") : ""}
						</Typography>
						{plan.items.length === 0 ? (
							<Typography
								variant="caption"
								sx={{ opacity: 0.7, textAlign: "center" }}
							>
								—
							</Typography>
						) : (
							plan.items.map(item => {
								const src = resolveItemImageUrl(item, props.adapterInstance);
								return (
									<Box
										key={item.id}
										sx={{
											display: "flex",
											alignItems: "center",
											gap: 0.75,
											bgcolor: "rgba(255,255,255,0.55)",
											borderRadius: 1,
											p: 0.5,
										}}
									>
										{src ? (
											item.source === "custom" ? (
												<VisFileImage
													src={src}
													alt=""
													width={size}
													height={size}
													style={{ objectFit: "contain", flexShrink: 0 }}
												/>
											) : (
												<img
													src={src}
													alt=""
													width={size}
													height={size}
													style={{ objectFit: "contain", flexShrink: 0 }}
													referrerPolicy="no-referrer"
													loading="lazy"
												/>
											)
										) : (
											<Box sx={{ width: size, height: size, flexShrink: 0 }} />
										)}
										<Box sx={{ minWidth: 0 }}>
											<Typography
												variant="caption"
												sx={{
													display: "block",
													fontWeight: 700,
													lineHeight: 1.2,
													overflow: "hidden",
													textOverflow: "ellipsis",
													whiteSpace: "nowrap",
												}}
											>
												{item.label || item.id}
											</Typography>
											<Typography
												variant="caption"
												sx={{ opacity: 0.8, lineHeight: 1.2 }}
											>
												{item.start}–{item.end}
											</Typography>
										</Box>
									</Box>
								);
							})
						)}
					</Box>
				);
			})}
		</Box>
	);
}

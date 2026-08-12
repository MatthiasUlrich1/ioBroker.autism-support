import React from "react";
import { Box, IconButton, TextField } from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

export interface DurationStepperProps {
	hours: number;
	minutes: number;
	maxHours: number;
	hoursLabel: string;
	minutesLabel: string;
	onChange: (hours: number, minutes: number) => void;
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function DurationField({
	label,
	value,
	min,
	max,
	onChange,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	onChange: (value: number) => void;
}): React.JSX.Element {
	const step = (delta: number): void => {
		onChange(clamp(value + delta, min, max));
	};

	return (
		<Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.25 }}>
			<IconButton size="small" aria-label={`${label} increase`} onClick={() => step(1)}>
				<KeyboardArrowUpIcon fontSize="small" />
			</IconButton>
			<TextField
				size="small"
				label={label}
				value={value}
				onChange={(event) => {
					const parsed = Number.parseInt(event.target.value, 10);
					onChange(Number.isFinite(parsed) ? clamp(parsed, min, max) : min);
				}}
				inputProps={{ min, max, inputMode: "numeric", style: { textAlign: "center" } }}
				sx={{ width: 88 }}
			/>
			<IconButton size="small" aria-label={`${label} decrease`} onClick={() => step(-1)}>
				<KeyboardArrowDownIcon fontSize="small" />
			</IconButton>
		</Box>
	);
}

export default function DurationStepper({
	hours,
	minutes,
	maxHours,
	hoursLabel,
	minutesLabel,
	onChange,
}: DurationStepperProps): React.JSX.Element {
	return (
		<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
			<DurationField
				label={hoursLabel}
				value={hours}
				min={0}
				max={maxHours}
				onChange={(nextHours) => onChange(nextHours, minutes)}
			/>
			<Box sx={{ fontSize: 24, fontWeight: 700, pt: 2 }}>:</Box>
			<DurationField
				label={minutesLabel}
				value={minutes}
				min={0}
				max={59}
				onChange={(nextMinutes) => onChange(hours, nextMinutes)}
			/>
		</Box>
	);
}

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
	colorText?: string;
	colorBorder?: string;
	colorArrows?: string;
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
	colorText,
	colorBorder,
	colorArrows,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	onChange: (value: number) => void;
	colorText: string;
	colorBorder: string;
	colorArrows: string;
}): React.JSX.Element {
	const step = (delta: number): void => {
		onChange(clamp(value + delta, min, max));
	};

	return (
		<Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.25 }}>
			<IconButton
				size="small"
				aria-label={`${label} increase`}
				onClick={() => step(1)}
				sx={{ color: colorArrows }}
			>
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
				inputProps={{
					min,
					max,
					inputMode: "numeric",
					style: { textAlign: "center", color: colorText },
				}}
				InputLabelProps={{
					sx: { color: colorText, "&.Mui-focused": { color: colorText } },
				}}
				sx={{
					width: 88,
					"& .MuiOutlinedInput-root": {
						color: colorText,
						"& fieldset": { borderColor: colorBorder },
						"&:hover fieldset": { borderColor: colorBorder },
						"&.Mui-focused fieldset": { borderColor: colorBorder },
					},
					"& .MuiInputBase-input": { color: colorText },
				}}
			/>
			<IconButton
				size="small"
				aria-label={`${label} decrease`}
				onClick={() => step(-1)}
				sx={{ color: colorArrows }}
			>
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
	colorText = "#000000",
	colorBorder = "#9E9E9E",
	colorArrows = "#000000",
}: DurationStepperProps): React.JSX.Element {
	return (
		<Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
			<DurationField
				label={hoursLabel}
				value={hours}
				min={0}
				max={maxHours}
				colorText={colorText}
				colorBorder={colorBorder}
				colorArrows={colorArrows}
				onChange={(nextHours) => onChange(nextHours, minutes)}
			/>
			<Box sx={{ fontSize: 24, fontWeight: 700, pt: 2, color: colorText }}>:</Box>
			<DurationField
				label={minutesLabel}
				value={minutes}
				min={0}
				max={59}
				colorText={colorText}
				colorBorder={colorBorder}
				colorArrows={colorArrows}
				onChange={(nextMinutes) => onChange(hours, nextMinutes)}
			/>
		</Box>
	);
}

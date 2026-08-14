import React from "react";
import { periodIconSrc } from "../lib/period-icons";

export default function PeriodIcon({
	periodId,
	size,
	alt = "",
}: {
	periodId: string;
	size: number;
	alt?: string;
}): React.JSX.Element | null {
	const src = periodIconSrc(periodId);
	if (!src || size < 12) {
		return null;
	}
	return (
		<img
			src={src}
			alt={alt}
			width={size}
			height={size}
			draggable={false}
			style={{
				width: size,
				height: size,
				objectFit: "contain",
				display: "block",
				pointerEvents: "none",
				flexShrink: 0,
				borderRadius: Math.max(2, Math.round(size * 0.12)),
			}}
		/>
	);
}

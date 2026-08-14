import morning from "../assets/periods/morning.png";
import forenoon from "../assets/periods/forenoon.png";
import noon from "../assets/periods/noon.png";
import afternoon from "../assets/periods/afternoon.png";
import evening from "../assets/periods/evening.png";
import night from "../assets/periods/night.png";

const PERIOD_ICONS: Record<string, string> = {
	morning,
	forenoon,
	noon,
	afternoon,
	evening,
	night,
};

export function periodIconSrc(periodId: string): string | undefined {
	return PERIOD_ICONS[periodId];
}

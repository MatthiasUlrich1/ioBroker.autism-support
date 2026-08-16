declare global {
	namespace ioBroker {
		interface AdapterConfig {
			defaultDurationHours: number;
			defaultDurationMinutes: number;
			maxDurationHours: number;

			periodMorningEnabled: boolean;
			periodMorningStart: string;
			periodMorningEnd: string;
			periodMorningColor: string;

			periodForenoonEnabled: boolean;
			periodForenoonStart: string;
			periodForenoonEnd: string;
			periodForenoonColor: string;

			periodNoonEnabled: boolean;
			periodNoonStart: string;
			periodNoonEnd: string;
			periodNoonColor: string;

			periodAfternoonEnabled: boolean;
			periodAfternoonStart: string;
			periodAfternoonEnd: string;
			periodAfternoonColor: string;

			periodEveningEnabled: boolean;
			periodEveningStart: string;
			periodEveningEnd: string;
			periodEveningColor: string;

			periodNightEnabled: boolean;
			periodNightStart: string;
			periodNightEnd: string;
			periodNightColor: string;
			weekdayColorMon: string;
			weekdayColorTue: string;
			weekdayColorWed: string;
			weekdayColorThu: string;
			weekdayColorFri: string;
			weekdayColorSat: string;
			weekdayColorSun: string;
			customPictograms: Array<{ file?: string; label?: string; tags?: string }>;
			weeklyPlanRows: Array<{ id?: string; name?: string; active?: string }>;
		}
	}
}

export {};

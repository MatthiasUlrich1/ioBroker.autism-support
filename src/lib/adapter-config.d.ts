declare global {
	namespace ioBroker {
		interface AdapterConfig {
			defaultDurationHours: number;
			defaultDurationMinutes: number;
			maxDurationHours: number;
		}
	}
}

export {};

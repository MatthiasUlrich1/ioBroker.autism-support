declare global {
	namespace ioBroker {
		interface AdapterConfig {
			defaultDurationMinutes: number;
			maxDurationHours: number;
		}
	}
}

export {};

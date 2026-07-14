export const calloutTypes = ["info", "warning", "error", "success"] as const

export type CalloutType = (typeof calloutTypes)[number]

export function normalizeCalloutType(value: unknown): CalloutType {
	return calloutTypes.includes(value as CalloutType)
		? (value as CalloutType)
		: "info"
}

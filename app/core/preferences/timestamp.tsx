import { usePreferences } from "./context"
import { formatDatetime, formatTimestamp } from "./dates"

/**
 * A moment in time, written the way the writer asked for it.
 *
 * The tooltip is the point of the component. "3 months ago" is quick to scan
 * and says nothing about which day, so a reader who needs the day has to open
 * the item to find it; the exact stamp hangs off the label instead. A writer
 * reading absolute dates already has it, so there is nothing left to reveal and
 * no tooltip is offered — a hover that repeats the text is noise.
 */
export function Timestamp({
	className,
	value,
}: {
	className?: string
	value: Date
}) {
	const preferences = usePreferences()
	const shown = formatTimestamp(value, preferences)
	const exact = formatDatetime(value, preferences)

	return (
		<span className={className} title={shown === exact ? undefined : exact}>
			{shown}
		</span>
	)
}

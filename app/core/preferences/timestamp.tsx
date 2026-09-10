import { usePreferences } from "./context"
import { formatDatetimeWithZone, formatTimestamp } from "./dates"

/**
 * A moment in time, written the way the writer asked for it.
 *
 * The tooltip is the point of the component. "3 months ago" is quick to scan
 * and says nothing about which day, so the exact stamp hangs off the label
 * instead — and it names the zone it is read in, which no label ever does. A
 * writer already reading absolute dates therefore still has something to
 * reveal: which clock they are reading them on.
 */
export function Timestamp({
	className,
	value,
}: {
	className?: string
	value: Date
}) {
	const preferences = usePreferences()

	return (
		<span
			className={className}
			title={formatDatetimeWithZone(value, preferences)}
		>
			{formatTimestamp(value, preferences)}
		</span>
	)
}

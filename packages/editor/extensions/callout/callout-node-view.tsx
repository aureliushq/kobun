import {
	NodeViewContent,
	NodeViewWrapper,
	type ReactNodeViewProps,
} from "@tiptap/react"
import { CircleCheck, CircleX, Info, TriangleAlert } from "lucide-react"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/ui/components/base/select"
import { type CalloutType, calloutTypes, normalizeCalloutType } from "./types"

const calloutDetails = {
	info: { icon: Info, label: "Info" },
	warning: { icon: TriangleAlert, label: "Warning" },
	error: { icon: CircleX, label: "Error" },
	success: { icon: CircleCheck, label: "Success" },
} satisfies Record<CalloutType, { icon: typeof Info; label: string }>

export function CalloutNodeView({
	editor,
	node,
	updateAttributes,
}: ReactNodeViewProps) {
	const type = normalizeCalloutType(node.attrs.type)
	const { icon: Icon, label } = calloutDetails[type]

	return (
		<NodeViewWrapper className="callout-node-view" data-callout={type}>
			<div className="callout-toolbar" contentEditable={false}>
				<Select
					disabled={!editor.isEditable}
					value={type}
					onValueChange={(value) => {
						if (value) updateAttributes({ type: normalizeCalloutType(value) })
					}}
				>
					<SelectTrigger
						aria-label="Callout type"
						className="callout-type-selector"
						size="sm"
					>
						<Icon />
						<SelectValue>{label}</SelectValue>
					</SelectTrigger>
					<SelectContent align="start">
						{calloutTypes.map((calloutType) => {
							const details = calloutDetails[calloutType]
							const ItemIcon = details.icon

							return (
								<SelectItem key={calloutType} value={calloutType}>
									<ItemIcon />
									{details.label}
								</SelectItem>
							)
						})}
					</SelectContent>
				</Select>
			</div>
			<NodeViewContent className="callout-content" />
		</NodeViewWrapper>
	)
}

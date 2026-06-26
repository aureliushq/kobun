import type { Editor } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import { GripVertical } from "lucide-react";
import { type RefObject, useCallback, useEffect, useState } from "react";
import { Button } from "@/ui/components/base/button";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/ui/components/base/tooltip";

interface SideMenuProps {
	editor: Editor;
	containerRef: RefObject<HTMLDivElement | null>;
}

interface MenuPosition {
	top: number;
	left: number;
}

export function SideMenu({ editor, containerRef }: SideMenuProps) {
	const [position, setPosition] = useState<MenuPosition | null>(null);
	const [hoveredBlockPos, setHoveredBlockPos] = useState<number | null>(null);

	useEffect(() => {
		const editorElement = editor.view.dom;
		const container = containerRef.current;
		if (!container) return;

		const handleMouseMove = (event: MouseEvent) => {
			const containerRect = container.getBoundingClientRect();
			const elements = document.elementsFromPoint(event.clientX, event.clientY);
			const blockElement = elements.find(
				(el) =>
					el.closest(".ProseMirror")?.contains(el) &&
					el.parentElement?.classList.contains("ProseMirror"),
			) as HTMLElement | undefined;

			if (blockElement) {
				const blockRect = blockElement.getBoundingClientRect();
				const pos = editor.view.posAtDOM(blockElement, 0);
				setPosition({
					top: blockRect.top - containerRect.top - 1,
					left: 16,
				});
				setHoveredBlockPos(pos);
			}
		};

		const handleMouseLeave = () => {
			setPosition(null);
			setHoveredBlockPos(null);
		};

		editorElement.addEventListener("mousemove", handleMouseMove);
		container.addEventListener("mouseleave", handleMouseLeave);
		return () => {
			editorElement.removeEventListener("mousemove", handleMouseMove);
			container.removeEventListener("mouseleave", handleMouseLeave);
		};
	}, [editor, containerRef]);

	const handleDragStart = useCallback(
		(event: React.DragEvent) => {
			if (hoveredBlockPos === null || !event.dataTransfer) return;

			const view = editor.view;
			const $pos = view.state.doc.resolve(hoveredBlockPos);
			const from = $pos.before($pos.depth);

			view.focus();
			const selection = NodeSelection.create(view.state.doc, from);
			view.dispatch(view.state.tr.setSelection(selection));

			const slice = view.state.selection.content();
			const { dom, text } = view.serializeForClipboard(slice);

			event.dataTransfer.clearData();
			event.dataTransfer.setData("text/html", dom.innerHTML);
			event.dataTransfer.setData("text/plain", text);
			event.dataTransfer.effectAllowed = "copyMove";

			const blockDom = view.nodeDOM(from);
			if (blockDom instanceof HTMLElement) {
				event.dataTransfer.setDragImage(blockDom, 0, 0);
			}

			view.dragging = { slice, move: true };
		},
		[editor, hoveredBlockPos],
	);

	if (!position) return null;

	return (
		<TooltipProvider>
			<div
				className="absolute flex items-center gap-0.5 opacity-0 transition-opacity group-hover/editor:opacity-100"
				style={{ top: position.top, left: position.left }}
			>
				<Tooltip>
					<TooltipTrigger
						render={
							<Button
								variant="ghost"
								size="icon"
								className="cursor-grab active:cursor-grabbing"
								draggable
								data-drag-handle
								onDragStart={handleDragStart}
							/>
						}
					>
						<GripVertical />
					</TooltipTrigger>
					<TooltipContent side="bottom">Drag to reorder</TooltipContent>
				</Tooltip>
			</div>
		</TooltipProvider>
	);
}

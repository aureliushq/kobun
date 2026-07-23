import { Extension } from "@tiptap/core"
import { NodeSelection, Plugin, PluginKey } from "@tiptap/pm/state"

export const DragHandleExtension = Extension.create({
	name: "dragHandle",

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("dragHandle"),
				props: {
					handleDOMEvents: {
						dragstart: (view, event) => {
							const target = event.target as HTMLElement
							const blockEl = target.closest("[data-drag-handle]")
							if (!blockEl) return false

							const pos = view.posAtDOM(blockEl, 0)
							const $pos = view.state.doc.resolve(pos)

							const tr = view.state.tr
							const from = $pos.before($pos.depth)
							tr.setSelection(NodeSelection.create(tr.doc, from))
							view.dispatch(tr)

							return false
						},
					},
				},
			}),
		]
	},
})

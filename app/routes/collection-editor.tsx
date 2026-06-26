import { useParams } from "react-router";
import { RichTextEditor } from "@/editor";
import { EditorActionIntents } from "@/ui/lib/types";
import type { Route } from "./+types/collection-editor";

export async function loader(_args: Route.LoaderArgs) {
	return {};
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	switch (intent) {
		case EditorActionIntents.SAVE:
			// TODO: implement save
			return { ok: true, intent };
		case EditorActionIntents.PUBLISH:
			// TODO: implement publish
			return { ok: true, intent };
		default:
			return { ok: false, error: "unknown intent" };
	}
}

export default function CollectionEditor() {
	const params = useParams();
	const slug = params.collection_item_slug;
	const isNew = slug === "new";

	return (
		<div className="editor-wrapper p-6">
			<p className="text-muted-foreground text-sm">
				{isNew ? "New item editor" : `Editor for "${slug}"`}
			</p>
			<RichTextEditor />
		</div>
	);
}

# Rich-text Markdown editor

`packages/editor` provides Kobun's Tiptap-based document editor. It offers rich editing controls while keeping CommonMark/GFM Markdown as the canonical value. Storage and image handling stay outside the package through adapter interfaces.

## Installation

The editor is currently an internal Kobun package. Import it through the configured workspace alias:

```tsx
import { RichTextEditor } from "@/editor"
```

The application stylesheet already imports `packages/editor/styles/editor.css`. A consumer that extracts the package must load that stylesheet and provide the Tailwind theme variables and UI components used by the editor.

## Basic usage

```tsx
import { useRef } from "react"
import {
  type EditorRefApi,
  type PersistenceAdapter,
  RichTextEditor,
} from "@/editor"

export function DocumentEditor({ markdown }: { markdown: string }) {
  const editorRef = useRef<EditorRefApi>(null)

  const persistence: PersistenceAdapter = {
    onAutoSave: async (nextMarkdown) => {
      await fetch("/api/drafts", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown: nextMarkdown }),
      })
    },
    onPublish: async (nextMarkdown) => {
      await fetch("/api/documents/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown: nextMarkdown }),
      })
    },
  }

  return (
    <RichTextEditor
      ref={editorRef}
      initialContent={markdown}
      persistence={persistence}
    />
  )
}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `initialContent` | `string` | `""` | Initial Markdown. Changes after mount are not applied; remount the component to replace content. |
| `placeholder` | `string` | `"Press '/' for commands..."` | Empty-editor placeholder. |
| `imageUpload` | `ImageUploadAdapter` | — | Validates, uploads, and optionally resolves image sources. |
| `persistence` | `PersistenceAdapter` | — | Receives saves debounced by one second, and explicit commits and publishes. |
| `onChange` | `(markdown: string) => void` | — | Runs after every document change. |
| `onAutosaveStateChange` | `(state: AutosaveState) => void` | — | Reports dirty, saving, and last-saved state. |
| `readOnly` | `boolean` | `false` | Disables editing and hides editing menus. |
| `dragHandle` | `boolean` | `true` | Reserves the left gutter and shows the block drag handle in it while editing. The gutter stays reserved when `readOnly`, so hiding the handle never reflows the text. |
| `ref` | `React.Ref<EditorRefApi>` | — | Exposes the imperative editor API. |

`AutosaveState` contains `isDirty: boolean`, `isSaving: boolean`, and `lastSavedAt: Date | null`.

## Adapters

### Image uploads

The upload method returns the source stored in Markdown. Use `resolveSrc` when that portable source is not directly browser-readable; resolved URLs are display-only and never replace the stored source.

```tsx
import type { ImageUploadAdapter } from "@/editor"

const imageUpload: ImageUploadAdapter = {
  validate: (file) =>
    file.size > 5 * 1024 * 1024 ? "Images can be at most 5 MB." : null,
  upload: async (file) => {
    const form = new FormData()
    form.append("image", file)
    const response = await fetch("/api/upload-image", { method: "POST", body: form })
    if (!response.ok) throw new Error("Image upload failed")
    const result = (await response.json()) as { path: string }
    return result.path
  },
  resolveSrc: (src) => `/api/repo-asset/${src}`,
}
```

Only `image/*` files are taken from a paste or drop. `validate` returns an error message or `null`; the image node shows that message, and any error thrown by `upload`.

### Persistence

```ts
interface PersistenceAdapter {
  onAutoSave?: (markdown: string) => void | Promise<void>
  onCommit?: (
    markdown: string,
  ) => void | Promise<{ imageSources: Record<string, string> } | void>
  onPublish?: (markdown: string) => void | Promise<void>
}
```

`onAutoSave` is debounced, skipped when content is unchanged, and may run asynchronously. `onCommit` and `onPublish` only run when the consumer calls `ref.commit()` or `ref.publish()`; the editor renders neither button. Persistence errors reject the corresponding call.

`onCommit` may answer with `imageSources`, mapping an image's current source to a new one. The editor points those images at their new sources, without an undo step, and treats the result as saved. Kobun uses this to follow Staged Images into the repository's media directory.

In Kobun, collection documents use D1 drafts for `onAutoSave`, and commit the serialized Markdown file to GitHub through Octokit for both `onCommit` and `onPublish` — the two differ in what the commit declares, not in where it goes.

## Imperative API

```tsx
const editorRef = useRef<EditorRefApi>(null)

await editorRef.current?.save()
await editorRef.current?.commit()
await editorRef.current?.publish()
editorRef.current?.focus("end")
```

| Method | Result | Description |
| --- | --- | --- |
| `getMarkdown()` | `string` | Returns canonical Markdown. |
| `getHTML()` | `string` | Returns rendered HTML. |
| `focus(position?)` | `void` | Focuses `"start"`, `"end"`, `"all"`, or the current selection. |
| `hasUnsavedChanges()` | `boolean` | Reports whether content differs from the saved baseline. |
| `save()` | `Promise<void>` | Immediately invokes `onAutoSave` and marks that snapshot saved. |
| `commit()` | `Promise<void>` | Invokes `onCommit` with current Markdown, applies any `imageSources` it answers, and marks that snapshot saved. |
| `publish()` | `Promise<void>` | Invokes `onPublish` with current Markdown. |
| `getEditor()` | `Editor \| null` | Returns the underlying Tiptap editor for advanced integrations. |

## Word count

`EditorWordCount` renders a live `1,234 words · 6,789 characters` label for a document. It takes the Tiptap instance rather than the ref API, so pass `getEditor()` through state — the ref alone never re-renders on document changes:

```tsx
const [editor, setEditor] = useState<Editor | null>(null)

<RichTextEditor ref={(api) => setEditor(api?.getEditor() ?? null)} />
<EditorWordCount editor={editor} className="text-xs" />
```

It renders nothing while `editor` is `null`. Counts cover the editor document only, and come from the always-registered `CharacterCount` extension.

## Styling and theming

Import the editor stylesheet once if the host application does not already do so:

```css
@import "./packages/editor/styles/editor.css";
```

The stylesheet uses theme tokens such as `--color-background`, `--color-foreground`, `--color-muted`, `--color-border`, and `--color-primary`. Kobun defines these through Tailwind CSS 4 in `app/core/styles/app.css`. Override those tokens at the theme root rather than targeting ProseMirror internals. Use `.editor-wrapper` for Kobun's centered writing column.


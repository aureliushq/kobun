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
      autosaveDelay={1_000}
    />
  )
}
```

## Props

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `initialContent` | `string` | `""` | Initial Markdown. Changes after mount are not applied automatically; use `ref.setMarkdown()` to replace content. |
| `placeholder` | `string` | `"Press '/' for commands..."` | Empty-editor placeholder. |
| `imageUpload` | `ImageUploadAdapter` | — | Validates, uploads, and optionally resolves image sources. |
| `persistence` | `PersistenceAdapter` | — | Receives debounced saves and explicit publishes. |
| `autosaveDelay` | `number` | `1000` | Autosave debounce in milliseconds. |
| `onChange` | `(markdown: string) => void` | — | Runs after every document change. |
| `onAutosaveStateChange` | `(state: AutosaveState) => void` | — | Reports dirty, saving, and last-saved state. |
| `readOnly` | `boolean` | `false` | Disables editing and hides editing menus. |
| `dragHandle` | `boolean` | `true` | Shows the block drag handle while editing. |
| `slashCommands` | `SlashCommandItem[]` | `[]` | Appends custom items to the built-in slash command menu. |
| `className` | `string` | — | Additional class for the editor container. |
| `ref` | `React.Ref<EditorRefApi>` | — | Exposes the imperative editor API. |

`AutosaveState` contains `isDirty: boolean`, `isSaving: boolean`, and `lastSavedAt: Date | null`.

## Adapters

### Image uploads

The upload method returns the source stored in Markdown. Use `resolveSrc` when that portable source is not directly browser-readable; resolved URLs are display-only and never replace the stored source.

```tsx
import type { ImageUploadAdapter } from "@/editor"

const imageUpload: ImageUploadAdapter = {
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  maxFileSize: 5 * 1024 * 1024,
  validate: (file) =>
    file.name.includes(" ") ? "Image filenames cannot contain spaces" : null,
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

If omitted, `maxFileSize` defaults to 5 MB and accepted MIME types default to `image/*`. `validate` returns an error message or `null`; errors thrown by `upload` are shown by the image node.

### Persistence

```ts
interface PersistenceAdapter {
  onAutoSave?: (markdown: string) => void | Promise<void>
  onPublish?: (markdown: string) => void | Promise<void>
}
```

`onAutoSave` is debounced, skipped when content is unchanged, and may run asynchronously. `onPublish` only runs when the consumer calls `ref.publish()`; the editor does not render its own publish button. Persistence errors reject the corresponding `save()` or `publish()` call.

In Kobun, collection documents use D1 drafts for `onAutoSave` and commit the serialized Markdown file to GitHub through Octokit for `onPublish`.

## Imperative API

```tsx
const editorRef = useRef<EditorRefApi>(null)

await editorRef.current?.save()
await editorRef.current?.publish()
editorRef.current?.setMarkdown("# Replacement")
editorRef.current?.focus("end")
```

| Method | Result | Description |
| --- | --- | --- |
| `getMarkdown()` | `string` | Returns canonical Markdown. |
| `getJSON()` | `JSONContent` | Returns the current Tiptap document. |
| `getHTML()` | `string` | Returns rendered HTML. |
| `setMarkdown(markdown)` | `void` | Replaces content without emitting `onChange` and marks it clean. |
| `focus(position?)` | `void` | Focuses `"start"`, `"end"`, `"all"`, or the current selection. |
| `hasUnsavedChanges()` | `boolean` | Reports whether content differs from the saved baseline. |
| `save()` | `Promise<void>` | Immediately invokes `onAutoSave` and marks that snapshot saved. |
| `publish()` | `Promise<void>` | Invokes `onPublish` with current Markdown. |
| `clear()` | `void` | Clears document content. |
| `getEditor()` | `Editor \| null` | Returns the underlying Tiptap editor for advanced integrations. |

## Custom slash commands

Custom commands are appended after the built-in commands and use the exported `SlashCommandItem` contract:

```tsx
import { Sparkles } from "lucide-react"
import { type SlashCommandItem, RichTextEditor } from "@/editor"

const commands: SlashCommandItem[] = [
  {
    title: "Summary",
    description: "Insert a summary section.",
    icon: Sparkles,
    searchTerms: ["summary", "abstract"],
    command: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent("## Summary\n\n")
        .run()
    },
  },
]

<RichTextEditor slashCommands={commands} />
```

Command arrays configure the editor when it is created; remount the component to replace them.

## Styling and theming

Import the editor stylesheet once if the host application does not already do so:

```css
@import "./packages/editor/styles/editor.css";
```

The stylesheet uses theme tokens such as `--color-background`, `--color-foreground`, `--color-muted`, `--color-border`, and `--color-primary`. Kobun defines these through Tailwind CSS 4 in `app/core/styles/app.css`. Override those tokens at the theme root rather than targeting ProseMirror internals. Use `className` for container width, spacing, or host-specific layout, and `.editor-wrapper` for Kobun's centered writing column.

## Markdown utilities

`markdownToHtml(markdown)` and `htmlToMarkdown(html)` expose the same configured CommonMark/GFM conversion used by the editor. Unsupported rich features such as underline and callouts serialize as raw HTML so content remains round-trippable.

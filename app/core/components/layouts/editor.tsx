import { Outlet } from "react-router"
import { ScrollArea } from "@/ui/components/base/scroll-area"
import EditorHeader from "@/ui/components/blocks/editor-header"

export default function Editor() {
	return (
		<main className="flex h-screen w-screen flex-col divide-y">
			<EditorHeader />
			<ScrollArea className="z-10 h-full w-full p-8">
				<section className="flex w-full justify-center">
					<div className="flex w-full max-w-4xl flex-col gap-4">
						<Outlet />
					</div>
				</section>
			</ScrollArea>
		</main>
	)
}

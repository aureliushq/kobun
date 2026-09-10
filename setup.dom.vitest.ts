import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// happy-dom implements no Web Animations API, and Base UI's ScrollArea asks its
// viewport what is animating on a timer — after the test that rendered it has
// finished, so the throw lands as an unhandled error rather than a failure.
// Nothing here animates, so the honest answer is "nothing".
if (!Element.prototype.getAnimations) {
	Element.prototype.getAnimations = () => []
}

afterEach(() => {
	// Automatic cleanup from react testing library does not work with Vitest.
	// This is because react testing library expects `afterEach` to be globally available.
	// Vitest does not support this, so we need to manually cleanup.
	// Related issue: https://github.com/testing-library/vue-testing-library/issues/296
	cleanup()
})

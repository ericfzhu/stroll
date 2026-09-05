import type { WebGLRenderer } from 'three';

// Keep counters across the scene, shadow and postprocessing passes. Restore the
// renderer setting afterwards so diagnostics do not affect other render users.
export function renderWithFrameStats(renderer: Pick<WebGLRenderer, 'info'>, renderFrame: () => void) {
	const autoReset = renderer.info.autoReset;
	renderer.info.autoReset = false;
	renderer.info.reset();
	try {
		renderFrame();
	} finally {
		renderer.info.autoReset = autoReset;
	}
}

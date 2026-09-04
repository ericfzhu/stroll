const FAVICON_FRAME_COUNT = 12;
const FAVICON_FRAME_DURATION_MS = 120;

export function startFaviconAnimation() {
	const favicon = document.querySelector<HTMLLinkElement>('#favicon');
	const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (!favicon || reducedMotion) return;

	const frames = Array.from(
		{ length: FAVICON_FRAME_COUNT },
		(_, index) => `/favicon-frames/daisy-${String(index).padStart(2, '0')}.png`,
	);
	for (const frame of frames) {
		const image = new Image();
		image.src = frame;
	}

	let frameIndex = 0;
	window.setInterval(() => {
		favicon.href = frames[frameIndex];
		frameIndex = (frameIndex + 1) % frames.length;
	}, FAVICON_FRAME_DURATION_MS);
}

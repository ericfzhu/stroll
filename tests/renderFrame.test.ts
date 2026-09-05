import { describe, expect, it, vi } from 'vitest';
import type { WebGLRenderer } from 'three';
import { needsPostprocessing, renderWithFrameStats } from '../src/field/renderFrame';

describe('postprocessing selection', () => {
	it.each([
		[0, 0, false],
		[0.5, 0, true],
		[0, 0.5, true],
		[0.5, 0.5, true],
		[0.001, 0, true],
	])('selects effects for dither=%s, noise=%s: %s', (dither, noise, enabled) => {
		expect(needsPostprocessing(dither, noise)).toBe(enabled);
	});
});

describe('measured render frame', () => {
	it.each([true, false])('renders once, accumulates every pass and restores autoReset=%s', (autoReset) => {
		const info = {
			autoReset,
			render: { calls: 99 },
			reset: vi.fn(() => { info.render.calls = 0; }),
		};
		const render = vi.fn(() => {
			expect(info.autoReset).toBe(false);
			expect(info.render.calls).toBe(0);
			info.render.calls += 10; // Scene pass
			info.render.calls += 1; // Postprocessing pass
		});
		renderWithFrameStats({ info } as Pick<WebGLRenderer, 'info'>, render);
		expect(render).toHaveBeenCalledTimes(1);
		expect(info.reset).toHaveBeenCalledTimes(1);
		expect(info.render.calls).toBe(11);
		expect(info.autoReset).toBe(autoReset);
	});

	it('restores renderer state even if a pass fails', () => {
		const info = { autoReset: true, reset: vi.fn() };
		expect(() => renderWithFrameStats({ info } as unknown as Pick<WebGLRenderer, 'info'>, () => {
			throw new Error('Pass failed');
		})).toThrow('Pass failed');
		expect(info.autoReset).toBe(true);
	});
});

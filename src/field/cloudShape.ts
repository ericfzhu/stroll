import { MathUtils } from 'three';
import type { FlowerFieldWeatherState } from './weatherAtmosphere';

// Visual weather presets, not an estimate of measured cloud altitude.
export function cloudShape(cloudCover: number, state: FlowerFieldWeatherState) {
	const cover = MathUtils.clamp(cloudCover / 100, 0, 1);
	const wet = ['light-rain', 'heavy-rain', 'thunderstorm', 'snow', 'fog'].includes(state);
	const overcast = Math.max(wet ? 0.8 : 0, MathUtils.smoothstep(cover, 0.5, 0.95));
	return {
		cover,
		baseVariation: 1,
		towers: state === 'thunderstorm' ? 1 : 0,
		overcast,
		base: MathUtils.lerp(18, 16, overcast),
		depth: MathUtils.lerp(19, 11, overcast),
		scale: MathUtils.lerp(0.075, 0.045, overcast),
	};
}

export type CloudShapeOverrides = Partial<Omit<ReturnType<typeof cloudShape>, 'cover'>>;

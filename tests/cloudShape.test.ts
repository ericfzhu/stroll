import { expect, it } from 'vitest';
import { cloudShape } from '../src/field/cloudShape';

it('connects and flattens clouds as cover increases', () => {
	const scattered = cloudShape(30, 'light-clouds');
	const overcast = cloudShape(100, 'heavy-clouds');
	expect(scattered.overcast).toBe(0);
	expect(overcast.overcast).toBe(1);
	expect(overcast.depth).toBeLessThan(scattered.depth);
	expect(overcast.scale).toBeLessThan(scattered.scale);
	expect(cloudShape(70, 'heavy-clouds').overcast).toBeGreaterThan(0);
	expect(cloudShape(70, 'heavy-clouds').overcast).toBeLessThan(1);
});
it('uses a layered rainy sky without inventing extra cloud cover', () => {
	const rain = cloudShape(40, 'light-rain');
	expect(rain.overcast).toBeGreaterThan(cloudShape(40, 'light-clouds').overcast);
	expect(rain.cover).toBe(0.4);
	expect(cloudShape(0, 'light-rain').cover).toBe(0);
});

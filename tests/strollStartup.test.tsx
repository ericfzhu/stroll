import { expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Stroll from '../src/pages/Stroll';

vi.mock('../src/weather/useWeather', () => ({ default: () => ({ weather: null, loading: true }) }));
vi.mock('../src/field/FlowerFieldScene', () => ({
	default: ({ cameraSpeed }: { cameraSpeed: number }) => <canvas data-camera-speed={cameraSpeed} />,
}));

it('mounts the scene behind the loading cover while weather is pending', () => {
	const html = renderToStaticMarkup(<Stroll />);
	expect(html).toContain('<canvas');
	expect(html).toContain('data-camera-speed="0"');
	expect(html).toContain('flower-field-stage-preparing');
	expect(html).toContain('aria-hidden="true"');
	expect(html).toContain('Growing field');
	expect(html).not.toContain('flower-field-location');
});

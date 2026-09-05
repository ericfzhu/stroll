import { DEFAULT_SKY_COLOR } from '../field/weatherAtmosphere';
import { useCallback, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import FlowerFieldLoading from '../field/FlowerFieldLoading';
import FlowerFieldScene from '../field/FlowerFieldScene';
import useWeather from '../weather/useWeather';

export default function Stroll() {
	const reducedMotion = Boolean(useReducedMotion());
	const { weather, loading: weatherLoading } = useWeather();
	const [ready, setReady] = useState(false);
	const handleReady = useCallback(() => setReady(true), []);

	return (
		<main className="flower-field-page" aria-label="A Stroll Through the Meadow">
			<div className="flower-field-stage">
				{!weatherLoading && (
					<FlowerFieldScene
						reducedMotion={reducedMotion}
						showDiagnostics={false}
						cameraHeight={10}
						cameraAngle={15}
						showChunkBoundaries={false}
						skyColor={DEFAULT_SKY_COLOR}
						sunStrength={0.2}
						cameraSpeed={reducedMotion ? 0 : 0.54}
						windSpeed={1}
						windStrength={0.7}
						windDirection={46 * Math.PI / 180}
						windScale={0.35}
						ditherMode={0}
						ditherPixelSize={1}
						ditherStrength={0}
						noiseStrength={0}
						noiseScale={0.35}
						weather={weather}
						cloudRendering="stylized"
						onReady={handleReady}
					/>
				)}
			</div>
			{ready && !weatherLoading && (
				<p className="flower-field-location">
					Sydney, Australia
					<span className="flower-field-coordinates">33.8688° S · 151.2093° E</span>
				</p>
			)}
			{(!ready || weatherLoading) && <FlowerFieldLoading />}
		</main>
	);
}

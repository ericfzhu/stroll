import { useCallback, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import FlowerFieldLoading from '../features/flower-field/FlowerFieldLoading';
import FlowerFieldScene from '../features/flower-field/infinite-terrain/FlowerFieldScene';
import useWeather from '../features/weather/useWeather';

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
						skyColor="#77c4ee"
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
						cloudRendering="sheet"
						onReady={handleReady}
					/>
				)}
			</div>
			{(!ready || weatherLoading) && <FlowerFieldLoading />}
		</main>
	);
}

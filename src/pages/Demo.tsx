import { cloudShape, type CloudShapeOverrides } from '../field/cloudShape';
import { DEFAULT_SKY_COLOR, weatherStateFromCode } from '../field/weatherAtmosphere';
import { useCallback, useMemo, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Link } from 'react-router-dom';
import FlowerFieldLoading from '../field/FlowerFieldLoading';
import FlowerFieldScene from '../field/FlowerFieldScene';
import type { WeatherData } from '../weather/weatherTypes';
import './Demo.css';

// Midnight in Sydney on 1 January 2026 (AEDT), so lunar positions match the displayed hour.
const MOCK_DAY_START = Date.UTC(2025, 11, 31, 13) / 1000;
const MOCK_SUNRISE = MOCK_DAY_START + 6 * 60 * 60;
const MOCK_SUNSET = MOCK_DAY_START + 18 * 60 * 60;
const WEATHER_OPTIONS = [
	{ code: 800, label: 'Clear', cloudCover: 0 },
	{ code: 802, label: 'Light clouds', cloudCover: 45 },
	{ code: 804, label: 'Heavy clouds', cloudCover: 90 },
	{ code: 721, label: 'Haze', cloudCover: 35 },
	{ code: 741, label: 'Fog', cloudCover: 80 },
	{ code: 500, label: 'Light rain', cloudCover: 75 },
	{ code: 502, label: 'Heavy rain', cloudCover: 95 },
	{ code: 211, label: 'Thunderstorm', cloudCover: 100 },
	{ code: 601, label: 'Snow', cloudCover: 90 },
	{ code: 781, label: 'Severe', cloudCover: 85 },
] as const;

function createMockWeather(conditionCode: number, cloudCover: number, visibility: number): WeatherData {
	const condition = WEATHER_OPTIONS.find((option) => option.code === conditionCode)?.label ?? 'Clear';
	return {
		temperature: 20,
		feelsLike: 20,
		humidity: 60,
		pressure: 1015,
		visibility,
		windSpeed: 2,
		windDirection: 90,
		windGust: null,
		cloudCover,
		condition,
		conditionCode,
		description: condition.toLowerCase(),
		city: 'Mock field',
		timezone: 0,
		sunrise: MOCK_SUNRISE,
		sunset: MOCK_SUNSET,
	};
}

function formatMockHour(hour: number) {
	const wholeHour = Math.floor(hour) % 24;
	const minutes = Math.round((hour - Math.floor(hour)) * 60);
	return `${String(wholeHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export default function FlowerFieldDemo() {
	const reducedMotion = Boolean(useReducedMotion());
	const [ready, setReady] = useState(false);
	const [cameraHeight, setCameraHeight] = useState(7);
	const [cameraAngle, setCameraAngle] = useState(15);
	const [showChunkBoundaries, setShowChunkBoundaries] = useState(false);
	const [skyColor, setSkyColor] = useState(DEFAULT_SKY_COLOR);
	const [sunStrength, setSunStrength] = useState(0.2);
	const [cameraSpeed, setCameraSpeed] = useState(reducedMotion ? 0 : 0.54);
	const [windSpeed, setWindSpeed] = useState(1);
	const [windStrength, setWindStrength] = useState(0.7);
	const [windDirection, setWindDirection] = useState(46);
	const [windScale, setWindScale] = useState(0.35);
	const [ditherMode, setDitherMode] = useState<0 | 1>(0);
	const [ditherPixelSize, setDitherPixelSize] = useState(1);
	const [ditherStrength, setDitherStrength] = useState(0);
	const [noiseStrength, setNoiseStrength] = useState(0);
	const [noiseScale, setNoiseScale] = useState(0.05);
	const [weatherCode, setWeatherCode] = useState(800);
	const [cloudCover, setCloudCover] = useState(0);
	const [cloudShapeOverrides, setCloudShapeOverrides] = useState<CloudShapeOverrides>({});
	const shape = { ...cloudShape(cloudCover, weatherStateFromCode(weatherCode)), ...cloudShapeOverrides };
	const [visibility, setVisibility] = useState(10);
	const [timeOfDay, setTimeOfDay] = useState(14);
	const [settingsCopied, setSettingsCopied] = useState(false);
	const mockWeather = useMemo(
		() => createMockWeather(weatherCode, cloudCover, visibility),
		[cloudCover, visibility, weatherCode],
	);
	const mockWeatherNow = MOCK_DAY_START + timeOfDay * 60 * 60;
	const handleReady = useCallback(() => setReady(true), []);
	const handleWeatherChange = useCallback((conditionCode: number) => {
		const option = WEATHER_OPTIONS.find((candidate) => candidate.code === conditionCode);
		setWeatherCode(conditionCode);
		if (option) setCloudCover(option.cloudCover);
	}, []);
	const handleCopySettings = useCallback(async () => {
		await navigator.clipboard.writeText(JSON.stringify({
			height: cameraHeight,
			angle: cameraAngle,
			showChunkBoundaries,
			sky: skyColor,
			sun: sunStrength,
			moveSpeed: cameraSpeed,
			windSpeed,
			windForce: windStrength,
			windDirection,
			gustScale: windScale,
			ditherPattern: ditherMode === 0 ? 'diamond' : 'bayer',
			ditherPixelSize,
			ditherStrength,
			noiseStrength,
			noiseScale,
			weatherCode,
			cloudCover,
			cloudShapeOverrides,
			visibility,
			time: formatMockHour(timeOfDay),
		}, null, 2));
		setSettingsCopied(true);
		window.setTimeout(() => setSettingsCopied(false), 1600);
	}, [cameraAngle, cameraHeight, cameraSpeed, cloudCover, cloudShapeOverrides, ditherMode, ditherPixelSize, ditherStrength, noiseScale, noiseStrength, showChunkBoundaries, skyColor, sunStrength, timeOfDay, visibility, weatherCode, windDirection, windScale, windSpeed, windStrength]);

	return (
		<main className="flower-field-page">
			<div className="flower-field-stage">
				<FlowerFieldScene
					reducedMotion={reducedMotion}
					cameraHeight={cameraHeight}
					cameraAngle={cameraAngle}
					showChunkBoundaries={showChunkBoundaries}
					skyColor={skyColor}
					sunStrength={sunStrength}
					cameraSpeed={cameraSpeed}
					windSpeed={windSpeed}
					windStrength={windStrength}
					windDirection={windDirection * Math.PI / 180}
					windScale={windScale}
					ditherMode={ditherMode}
					ditherPixelSize={ditherPixelSize}
					ditherStrength={ditherStrength}
					noiseStrength={noiseStrength}
					noiseScale={noiseScale}
					weather={mockWeather}
					weatherNow={mockWeatherNow}
					cloudRendering="stylized"
					cloudShapeOverrides={cloudShapeOverrides}
					onReady={handleReady}
				/>
			</div>
			<div className="flower-field-interface">
				<header className="flower-field-header">
					<Link to="/flower-studio" className="flower-field-studio">Flower studio</Link>
				</header>
				<aside className="flower-field-camera-controls" aria-label="Scene controls">
					<label>
						<span>Height</span>
						<input
							type="range"
							min="2"
							max="16"
							step="0.25"
							value={cameraHeight}
							onChange={(event) => setCameraHeight(Number(event.target.value))}
						/>
						<output>{cameraHeight.toFixed(2)}u</output>
					</label>
					<label>
						<span>Angle</span>
						<input
							type="range"
							min="-80"
							max="45"
							step="1"
							value={cameraAngle}
							onChange={(event) => setCameraAngle(Number(event.target.value))}
						/>
						<output>{cameraAngle}°</output>
					</label>
					<label>
						<span>Chunks</span>
						<input
							type="checkbox"
							checked={showChunkBoundaries}
							onChange={(event) => setShowChunkBoundaries(event.target.checked)}
						/>
						<output>{showChunkBoundaries ? 'On' : 'Off'}</output>
					</label>
					<label>
						<span>Weather</span>
						<select value={weatherCode} onChange={(event) => handleWeatherChange(Number(event.target.value))}>
							{WEATHER_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
						</select>
						<output>{weatherCode}</output>
					</label>
					<label>
						<span>Clouds</span>
						<input type="range" min="0" max="100" step="1" value={cloudCover} onChange={(event) => setCloudCover(Number(event.target.value))} />
						<output>{cloudCover}%</output>
					</label>
					<fieldset>
						<legend>Cloud shape</legend>
						{([
							['overcast', 'Connected', 0, 1, 0.05],
							['base', 'Base height', 10, 40, 0.5],
							['depth', 'Thickness', 5, 30, 0.5],
							['scale', 'Shape scale', 0.025, 0.15, 0.005],
							['baseVariation', 'Uneven base', 0, 2, 0.1],
						] as const).map(([key, label, min, max, step]) => (
							<label key={key}>
								<span>{label}</span>
								<input type="range" min={min} max={max} step={step} value={shape[key]}
									onChange={(event) => setCloudShapeOverrides((current) => ({ ...current, [key]: Number(event.target.value) }))} />
								<output>{shape[key].toFixed(key === 'scale' ? 3 : 1)}</output>
							</label>
						))}
						<button type="button" onClick={() => setCloudShapeOverrides({})}>Reset cloud shape to weather</button>
					</fieldset>
					<label>
						<span>Visibility</span>
						<input type="range" min="1" max="10" step="0.5" value={visibility} onChange={(event) => setVisibility(Number(event.target.value))} />
						<output>{visibility.toFixed(1)}k</output>
					</label>
					<label>
						<span>Time</span>
						<input type="range" min="0" max="23.75" step="0.25" value={timeOfDay} onChange={(event) => setTimeOfDay(Number(event.target.value))} />
						<output>{formatMockHour(timeOfDay)}</output>
					</label>
					<label>
						<span>Sky</span>
						<input
							type="color"
							value={skyColor}
							onChange={(event) => setSkyColor(event.target.value)}
						/>
						<output>{skyColor}</output>
					</label>
					<label>
						<span>Sun</span>
						<input
							type="range"
							min="0"
							max="1.25"
							step="0.05"
							value={sunStrength}
							onChange={(event) => setSunStrength(Number(event.target.value))}
						/>
						<output>{sunStrength.toFixed(2)}</output>
					</label>
					<label>
						<span>Move speed</span>
						<input
							type="range"
							min="0"
							max="2"
							step="0.01"
							value={cameraSpeed}
							onChange={(event) => setCameraSpeed(Number(event.target.value))}
						/>
						<output>{cameraSpeed.toFixed(2)}</output>
					</label>
					<label>
						<span>Wind speed</span>
						<input
							type="range"
							min="0"
							max="3"
							step="0.05"
							value={windSpeed}
							onChange={(event) => setWindSpeed(Number(event.target.value))}
						/>
						<output>{windSpeed.toFixed(2)}</output>
					</label>
					<label>
						<span>Wind force</span>
						<input
							type="range"
							min="0"
							max="2"
							step="0.05"
							value={windStrength}
							onChange={(event) => setWindStrength(Number(event.target.value))}
						/>
						<output>{windStrength.toFixed(2)}</output>
					</label>
					<label>
						<span>Wind dir</span>
						<input
							type="range"
							min="0"
							max="360"
							step="1"
							value={windDirection}
							onChange={(event) => setWindDirection(Number(event.target.value))}
						/>
						<output>{windDirection}°</output>
					</label>
					<label>
						<span>Gust scale</span>
						<input
							type="range"
							min="0.05"
							max="1"
							step="0.05"
							value={windScale}
							onChange={(event) => setWindScale(Number(event.target.value))}
						/>
						<output>{windScale.toFixed(2)}</output>
					</label>
					<fieldset>
						<legend>Dithering</legend>
						<label>
							<span>Pattern</span>
							<select value={ditherMode} onChange={(event) => setDitherMode(Number(event.target.value) as 0 | 1)}>
								<option value={0}>Diamond</option>
								<option value={1}>Bayer 8×8</option>
							</select>
							<output>{ditherMode === 0 ? 'Dia' : '8×8'}</output>
						</label>
						<label>
							<span>Pixel size</span>
							<input type="range" min="1" max="12" step="1" value={ditherPixelSize} onChange={(event) => setDitherPixelSize(Number(event.target.value))} />
							<output>{ditherPixelSize}px</output>
						</label>
						<label>
							<span>Strength</span>
							<input type="range" min="0" max="1" step="0.05" value={ditherStrength} onChange={(event) => setDitherStrength(Number(event.target.value))} />
							<output>{ditherStrength.toFixed(2)}</output>
						</label>
					</fieldset>
					<fieldset>
						<legend>Noise</legend>
						<label>
							<span>Strength</span>
							<input type="range" min="0" max="1" step="0.05" value={noiseStrength} onChange={(event) => setNoiseStrength(Number(event.target.value))} />
							<output>{noiseStrength.toFixed(2)}</output>
						</label>
						<label>
							<span>Scale</span>
							<input type="range" min="0.05" max="1.5" step="0.05" value={noiseScale} onChange={(event) => setNoiseScale(Number(event.target.value))} />
							<output>{noiseScale.toFixed(2)}</output>
						</label>
					</fieldset>
					<button type="button" onClick={handleCopySettings}>
						{settingsCopied ? 'Copied' : 'Copy settings'}
					</button>
				</aside>

			</div>

			{!ready && (
				<FlowerFieldLoading />
			)}
		</main>
	);
}

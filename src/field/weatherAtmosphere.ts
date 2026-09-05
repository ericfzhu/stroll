import * as THREE from 'three';
import type { WeatherData } from '../weather/weatherTypes';

export type FlowerFieldWeatherState =
	| 'clear'
	| 'light-clouds'
	| 'heavy-clouds'
	| 'haze'
	| 'fog'
	| 'light-rain'
	| 'heavy-rain'
	| 'thunderstorm'
	| 'snow'
	| 'severe';

export interface FlowerFieldAtmosphere {
	state: FlowerFieldWeatherState;
	zenithColor: string;
	horizonColor: string;
	fogColor: string;
	fogNear: number;
	fogFar: number;
	sunColor: string;
	sunDirection: THREE.Vector3;
	sunStrength: number;
	sunVisibility: number;
	starVisibility: number;
	rainIntensity: number;
}

interface AtmosphereOptions {
	fallbackSkyColor: string;
	baseSunStrength: number;
	now?: number;
}

interface Palette {
	zenith: string;
	horizon: string;
	sun: string;
	fogDistance: number;
}

export const DEFAULT_SKY_COLOR = '#389ddd';

const DAY_PALETTES: Record<FlowerFieldWeatherState, Palette> = {
	clear: { zenith: DEFAULT_SKY_COLOR, horizon: '#b2dcef', sun: '#fff1c5', fogDistance: 90 },
	'light-clouds': { zenith: '#439fd8', horizon: '#bcd9e6', sun: '#f9e8c4', fogDistance: 88 },
	'heavy-clouds': { zenith: '#788e9b', horizon: '#b7c0bf', sun: '#e7dfcf', fogDistance: 80 },
	haze: { zenith: '#91adb3', horizon: '#d8cbae', sun: '#f1c990', fogDistance: 68 },
	fog: { zenith: '#a9b5b5', horizon: '#d2d5cf', sun: '#ded9c9', fogDistance: 48 },
	'light-rain': { zenith: '#5f7988', horizon: '#9eadae', sun: '#d7d4ca', fogDistance: 68 },
	'heavy-rain': { zenith: '#455d6b', horizon: '#7e8d91', sun: '#c5c7c3', fogDistance: 58 },
	thunderstorm: { zenith: '#344459', horizon: '#68747c', sun: '#bfc2bd', fogDistance: 52 },
	snow: { zenith: '#a6bdc9', horizon: '#e5e9e6', sun: '#f4eee0', fogDistance: 62 },
	severe: { zenith: '#584f57', horizon: '#8a7775', sun: '#cfbda8', fogDistance: 48 },
};

const NIGHT_ZENITH = new THREE.Color('#07111d');
const NIGHT_HORIZON = new THREE.Color('#182630');
const NIGHT_SUN = new THREE.Color('#8fa3b4');
const DEFAULT_SKY_REFERENCE = new THREE.Color(DEFAULT_SKY_COLOR);
const DEFAULT_SUN_DIRECTION = new THREE.Vector3(-0.48, 0.78, -0.4).normalize();

const WEATHER_COLOR_INFLUENCE: Record<FlowerFieldWeatherState, number> = {
	clear: 0,
	'light-clouds': 0.3,
	'heavy-clouds': 0.62,
	haze: 0.7,
	fog: 0.82,
	'light-rain': 0.72,
	'heavy-rain': 0.85,
	thunderstorm: 0.9,
	snow: 0.82,
	severe: 0.9,
};

const RAIN_INTENSITY: Record<FlowerFieldWeatherState, number> = {
	clear: 0,
	'light-clouds': 0,
	'heavy-clouds': 0,
	haze: 0,
	fog: 0,
	'light-rain': 0.42,
	'heavy-rain': 1,
	thunderstorm: 1,
	snow: 0,
	severe: 0,
};

export function weatherStateFromCode(code: number): FlowerFieldWeatherState {
	if (code >= 200 && code < 300) return 'thunderstorm';
	if (code >= 300 && code < 400) return 'light-rain';
	if (code >= 500 && code <= 501) return 'light-rain';
	if (code >= 502 && code < 600) return 'heavy-rain';
	if (code >= 600 && code < 700) return 'snow';
	if (code === 741) return 'fog';
	if (code === 771 || code === 781) return 'severe';
	if (code >= 700 && code < 800) return 'haze';
	if (code === 801 || code === 802) return 'light-clouds';
	if (code === 803 || code === 804) return 'heavy-clouds';
	return 'clear';
}

function smoothstep(edge0: number, edge1: number, value: number) {
	const progress = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
	return progress * progress * (3 - 2 * progress);
}

function daylightAt(now: number, sunrise: number, sunset: number) {
	const twilight = 45 * 60;
	const sunriseBlend = smoothstep(sunrise - twilight, sunrise + twilight, now);
	const sunsetBlend = 1 - smoothstep(sunset - twilight, sunset + twilight, now);
	return Math.min(sunriseBlend, sunsetBlend);
}

function sunDirectionAt(now: number, sunrise: number, sunset: number) {
	if (sunset <= sunrise) return DEFAULT_SUN_DIRECTION.clone();
	const progress = THREE.MathUtils.clamp((now - sunrise) / (sunset - sunrise), 0, 1);
	const altitude = Math.max(0.035, Math.sin(progress * Math.PI));
	return new THREE.Vector3(
		THREE.MathUtils.lerp(-0.85, 0.85, progress),
		altitude,
		-0.52,
	).normalize();
}

function colorWithCloudCover(color: string, cloudCover: number, target: string) {
	return `#${new THREE.Color(color)
		// Scattered clouds leave blue gaps; only a nearly closed cloud deck
		// adds a broad grey cast on top of the weather condition palette.
		.lerp(new THREE.Color(target), smoothstep(65, 100, cloudCover) * 0.18)
		.getHexString()}`;
}

function nightBlend(color: string, nightColor: THREE.Color, daylight: number) {
	return `#${nightColor.clone().lerp(new THREE.Color(color), daylight).getHexString()}`;
}

function weatherTint(baseColor: string, weatherColor: string, influence: number) {
	return `#${new THREE.Color(baseColor).lerp(new THREE.Color(weatherColor), influence).getHexString()}`;
}

function applySkyColorShift(baseColor: string, skyColor: string) {
	// Transfer the palette's lighter, less saturated horizon to the selected
	// sky in display color space. Subtracting linear RGB channels clips dark
	// blues unevenly and can turn their horizon (and fog) yellow.
	const base = new THREE.Color(baseColor).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
	const selected = new THREE.Color(skyColor).getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
	const reference = DEFAULT_SKY_REFERENCE.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace);
	const shiftedColor = new THREE.Color().setHSL(
		base.h + selected.h - reference.h,
		base.s * selected.s / reference.s,
		base.l * selected.l / reference.l,
		THREE.SRGBColorSpace,
	);
	return `#${shiftedColor.getHexString()}`;
}

export function createFlowerFieldAtmosphere(
	weather: WeatherData | null,
	{ fallbackSkyColor, baseSunStrength, now = Date.now() / 1000 }: AtmosphereOptions,
): FlowerFieldAtmosphere {
	if (!weather) {
		return {
			state: 'clear',
			zenithColor: fallbackSkyColor,
			horizonColor: fallbackSkyColor,
			fogColor: fallbackSkyColor,
			fogNear: 30,
			fogFar: 90,
			sunColor: '#fff2cf',
			sunDirection: DEFAULT_SUN_DIRECTION.clone(),
			sunStrength: baseSunStrength,
			sunVisibility: 0,
			starVisibility: 0,
			rainIntensity: 0,
		};
	}

	const state = weatherStateFromCode(weather.conditionCode);
	const palette = DAY_PALETTES[state];
	const daylight = daylightAt(now, weather.sunrise, weather.sunset);
	const cloudCover = THREE.MathUtils.clamp(weather.cloudCover, 0, 100);
	const tintedZenith = weatherTint(fallbackSkyColor, palette.zenith, WEATHER_COLOR_INFLUENCE[state]);
	const shiftedHorizon = applySkyColorShift(palette.horizon, fallbackSkyColor);
	const tintedHorizon = weatherTint(shiftedHorizon, palette.horizon, WEATHER_COLOR_INFLUENCE[state]);
	const dayZenith = colorWithCloudCover(tintedZenith, cloudCover, '#87969c');
	const dayHorizon = colorWithCloudCover(tintedHorizon, cloudCover, '#aeb6b5');
	// Warmth is confined to the hour around sunrise/sunset and subdued by
	// opaque weather. Most of the daytime sky keeps its selected blue.
	const solarEventDistance = Math.min(Math.abs(now - weather.sunrise), Math.abs(now - weather.sunset));
	const twilight = (1 - smoothstep(0, 60 * 60, solarEventDistance))
		* (1 - WEATHER_COLOR_INFLUENCE[state] * 0.85)
		* (1 - smoothstep(65, 100, cloudCover) * 0.5);
	const zenithColor = weatherTint(nightBlend(dayZenith, NIGHT_ZENITH, daylight), '#8c8fbb', twilight * 0.16);
	const horizonColor = weatherTint(nightBlend(dayHorizon, NIGHT_HORIZON, daylight), '#efb39d', twilight * 0.65);
	const sunColor = weatherTint(nightBlend(palette.sun, NIGHT_SUN, daylight), '#ffc08b', twilight * 0.75);
	const cloudTransmission = 1 - cloudCover / 100 * 0.68;
	const starTransmission = 1 - cloudCover / 100 * 0.94;
	const visibilityDistance = THREE.MathUtils.clamp(weather.visibility * 9, 38, 90);
	const fogFar = Math.min(palette.fogDistance, visibilityDistance);

	return {
		state,
		zenithColor,
		horizonColor,
		fogColor: horizonColor,
		fogNear: Math.max(18, fogFar * 0.42),
		fogFar,
		sunColor,
		sunDirection: sunDirectionAt(now, weather.sunrise, weather.sunset),
		sunStrength: baseSunStrength * daylight * cloudTransmission,
		sunVisibility: daylight * cloudTransmission,
		starVisibility: (1 - daylight) * starTransmission,
		rainIntensity: RAIN_INTENSITY[state],
	};
}

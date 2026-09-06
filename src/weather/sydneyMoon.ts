import SunCalc from 'suncalc';

export interface SydneyMoon {
	// SunCalc 1.9 returns altitude in radians and phase in [0, 1].
	altitude: number;
	azimuth: number;
	illuminatedFraction: number;
	phase: number;
}

export function sydneyMoon(now: number): SydneyMoon {
	const date = new Date(now * 1000);
	const position = SunCalc.getMoonPosition(date, -33.8688, 151.2093);
	const illumination = SunCalc.getMoonIllumination(date);
	return { altitude: position.altitude, azimuth: position.azimuth, illuminatedFraction: illumination.fraction, phase: illumination.phase };
}

// An artistic exposure curve, not a physical lux model. Preserve a readable
// moonless field, while letting a high, nearly full moon add more light.
export function moonlightAmount(moon: SydneyMoon, cloudCover: number, daylight: number) {
	const elevation = Math.max(0, Math.sin(moon.altitude));
	const phaseBrightness = Math.max(0, Math.min(1, moon.illuminatedFraction)) ** 3;
	const cloudTransmission = (1 - Math.max(0, Math.min(100, cloudCover)) / 100) ** 2;
	return elevation * phaseBrightness * cloudTransmission * (1 - Math.max(0, Math.min(1, daylight)));
}

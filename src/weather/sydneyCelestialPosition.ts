import SunCalc from 'suncalc';
import { Vector3 } from 'three';

// SunCalc 1.9 azimuth is measured from south towards west, in radians.
// Our scene faces north (-Z); east is +X and up is +Y.
export function skyDirection(altitude: number, azimuth: number) {
	const horizontal = Math.cos(altitude);
	return new Vector3(-Math.sin(azimuth) * horizontal, Math.sin(altitude), Math.cos(azimuth) * horizontal);
}

export function sydneySunDirection(now: number) {
	const position = SunCalc.getPosition(new Date(now * 1000), -33.8688, 151.2093);
	return skyDirection(position.altitude, position.azimuth);
}

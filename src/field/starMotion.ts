import { Vector3 } from 'three';

// Scene convention: north is -Z, east is +X. Earth's north pole is
// below Sydney's northern horizon; the opposite pole is above the south.
const latitude = -33.8688 * Math.PI / 180;
export const STAR_ROTATION_AXIS = new Vector3(0, Math.sin(latitude), -Math.cos(latitude));
// One sidereal day: https://www.esa.int/Enabling_Support/Space_Transportation/Types_of_orbits
export const SIDEREAL_DAY_SECONDS = 86164.0905;

// Procedural sky with an arbitrary reference orientation, not a star catalogue.
// Absolute Unix time keeps visits aligned and avoids accumulated frame drift.
export function starRotationAt(seconds: number) {
	return -(seconds % SIDEREAL_DAY_SECONDS) / SIDEREAL_DAY_SECONDS * Math.PI * 2;
}

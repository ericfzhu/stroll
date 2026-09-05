export interface SolarTimes {
	sunrise: number;
	sunset: number;
}

const radians = Math.PI / 180;
const latitude = -33.8688 * radians;
const longitude = 151.2093;
const sydneyDate = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
});
let cachedDay = NaN;
let cachedTimes: SolarTimes;

// NOAA's approximate solar equations, evaluated at noon for the Sydney date.
// https://gml.noaa.gov/grad/solcalc/solareqns.PDF
// All inputs/outputs are Unix seconds; browser timezone and DST do not shift
// the physical solar events. The explicit timezone selects the correct date.
export function sydneySolarTimes(now: number): SolarTimes {
	const parts = sydneyDate.formatToParts(new Date(now * 1000));
	const part = (type: string) => Number(parts.find((entry) => entry.type === type)!.value);
	const year = part('year');
	const day = Date.UTC(year, part('month') - 1, part('day'));
	if (day === cachedDay) return cachedTimes;
	const yearStart = Date.UTC(year, 0, 1);
	const daysInYear = (Date.UTC(year + 1, 0, 1) - yearStart) / 86400000;
	const gamma = 2 * Math.PI / daysInYear * ((day - yearStart) / 86400000);
	const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma)
		- 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
	const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma)
		- 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma)
		- 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
	const hourAngle = Math.acos(Math.cos(90.833 * radians) / (Math.cos(latitude) * Math.cos(declination))
		- Math.tan(latitude) * Math.tan(declination)) / radians;
	const noon = day / 1000 + (720 - 4 * longitude - equationOfTime) * 60;
	cachedDay = day;
	cachedTimes = { sunrise: noon - hourAngle * 240, sunset: noon + hourAngle * 240 };
	return cachedTimes;
}

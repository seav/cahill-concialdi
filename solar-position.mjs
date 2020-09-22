// ==================================================================
// SOLAR POSITION CALCULATION FUNCTIONS
// ------------------------------------------------------------------

// These functions have been adapted from Mike Bostock's solar calculator library
// https://github.com/mbostock/solar-calculator

// ------------------------------------------------------------------

import { DEGS_IN_CIRCLE, deg2Rad, rad2Deg } from './math.mjs';
import { LatLon } from './data-types.mjs';

// ------------------------------------------------------------------

// Returns the current position of the sun above the earth
// as a LatLon object in degrees
export function getSunLatLon() {
  const now = new Date;
  const day = new Date(+now).setUTCHours(0, 0, 0, 0);
  const t = epochCentury(now);
  let x = (day - now) / 864e5 * DEGS_IN_CIRCLE - DEGS_IN_CIRCLE/2 - equationOfTime(t) / 4;
  x %= DEGS_IN_CIRCLE;
  if (x < 0) x += DEGS_IN_CIRCLE;
  return new LatLon(solarDeclination(t), x);
}

// ------------------------------------------------------------------

// Returns the fractional number of centures since the J2000.0 epoch
// (2000-01-01T12:00:00Z) given a JS date.
// Note: No correction is made between Terrestrial Time and UTC.
function epochCentury(date) {
  const epoch = Date.UTC(2000, 0, 1, 12);
  return (date - epoch) / 315576e7;
}

// ------------------------------------------------------------------

// Returns the equation of time in minutes given t in J2000.0 centuries
// https://en.wikipedia.org/wiki/Equation_of_time
function equationOfTime(t) {
  const ε = obliquityOfEcliptic(t);
  const l0 = meanLongitude(t);
  const e = orbitEccentricity(t);
  const m = meanAnomaly(t);
  const y = Math.tan(ε/2)**2;
  const sinM = Math.sin(m);
  const eot0 =
    y * Math.sin(2*l0)
    - 2 * e * sinM
    + 4 * e * y * sinM * Math.cos(2*l0)
    - 0.5 * y * y * Math.sin(4*l0)
    - 1.25 * e * e * Math.sin(2*m);
  return rad2Deg(eot0) * 4;
}

// ------------------------------------------------------------------

// Returns Earth's orbital eccentricity given t in J2000.0 centuries
// https://en.wikipedia.org/wiki/Orbital_eccentricity
function orbitEccentricity(t) {
  return 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
}

// ------------------------------------------------------------------

// Returns the solar declination in degrees given t in J2000.0 centuries
// https://en.wikipedia.org/wiki/Position_of_the_Sun#Declination_of_the_Sun_as_seen_from_Earth
function solarDeclination(t) {
  return rad2Deg(Math.asin(Math.sin(obliquityOfEcliptic(t)) * Math.sin(apparentLongitude(t))));
}

// ------------------------------------------------------------------

// Returns the sun's apparent longitude in radians given t in J2000.0 centuries
// https://en.wikipedia.org/wiki/Apparent_longitude
function apparentLongitude(t) {
  const θ = deg2Rad(125.04 - 1934.136 * t);
  return trueLongitude(t) + deg2Rad(-0.00569 - 0.00478 * Math.sin(θ));
}

// ------------------------------------------------------------------

// Returns the sun's true longitude in radians given t in J2000.0 centuries
// https://en.wikipedia.org/wiki/True_longitude
function trueLongitude(t) {
  return meanLongitude(t) + equationOfCenter(t);
}

// ------------------------------------------------------------------

// Returns the sun's mean longitude in radians given t in J2000.0 centuries
// https://en.wikipedia.org/wiki/Mean_longitude
function meanLongitude(t) {
  const l = (280.46646 + t * (36000.76983 + t * 0.0003032)) % DEGS_IN_CIRCLE;
  return deg2Rad(l < 0 ? l + DEGS_IN_CIRCLE : l);
}

// ------------------------------------------------------------------

// Returns the sun’s equation of the center in radians given t in J2000.0 centuries
// https://en.wikipedia.org/wiki/Equation_of_the_center
function equationOfCenter(t) {
  const m = meanAnomaly(t);
  return deg2Rad(
    Math.sin(  m) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2*m) * (0.019993 - 0.000101 * t) +
    Math.sin(3*m) * 0.000289
  );
}

// ------------------------------------------------------------------

// Returns the obliquity of the Earth's ecliptic in radians
// given t in J2000.0 centuries
function obliquityOfEcliptic(t) {
  const ε0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t*0.001813)))/60)/60;
  const ω = deg2Rad(125.04 - 1934.136 * t);
  return deg2Rad(ε0 + 0.00256 * Math.cos(ω));
}

// ------------------------------------------------------------------

// Returns the sun's mean anomaly in radians given t in J2000.0 centuries
// https://en.wikipedia.org/wiki/Mean_anomaly
function meanAnomaly(t) {
  return deg2Rad(357.52911 + t * (35999.05029 - 0.0001537 * t));
}

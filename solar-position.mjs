// ==================================================================
// SOLAR POSITION CALCULATION FUNCTION
// ------------------------------------------------------------------

// Adapted from the Wikipedia article "Equation of Time"
// using the "Altenative calculation" approximation
// https://en.wikipedia.org/w/index.php?oldid=995567376#Alternative_calculation

// ------------------------------------------------------------------

import { TWO_PI, DEGS_IN_CIRCLE, EARTH_TILT, deg2Rad, rad2Deg } from './globals.mjs';
import { LatLon } from './data-types.mjs';

// ------------------------------------------------------------------

const MILLI          = 0.001;
const SECS_PER_DAY   = 86400;
const MS_PER_DAY     = SECS_PER_DAY / MILLI;
const EARTH_TILT_RAD = deg2Rad(EARTH_TILT);

// Mean angular velocity of Earth's revolution in radians per day
const Ω_REV = TWO_PI/365.2422;

// Approximate difference in days between Dec solstice and Jan 1
const Δ_SOLSTICE = 10;

// Approximate difference in days between Jan 1 and Earth's perihelion
const Δ_PERIHELION = 2;

// Approximate eccentricity of the Earth's orbit
const ECCENTRICITY = 0.0167

// ------------------------------------------------------------------

// Returns the current position of the sun above the earth
// as a LatLon object in degrees
export function getSunLatLon(date = new Date) {

  // Various time periods since some start point
  const msSinceUtcMidnight = date - new Date(+date).setUTCHours(0, 0, 0, 0);
  const msSinceUtcJan1     = date - new Date(date.getUTCFullYear() + '-01-01');
  const daysSinceUtcJan1   = msSinceUtcJan1 / MS_PER_DAY;

  // Rotation of the Earth in degrees since the last UTC midnight
  const δRot = -msSinceUtcMidnight / MS_PER_DAY * DEGS_IN_CIRCLE;

  // Mean revolution of the Earth in radians since the Dec solstice
  const δRev0 = Ω_REV * (daysSinceUtcJan1 + Δ_SOLSTICE);

  // Adjusted revolution of the Earth in radians since the Dec solstice
  // using a 1st-order approximation for the orbital eccentricity
  const δRev1 = δRev0 + 2 * ECCENTRICITY * Math.sin(Ω_REV * (daysSinceUtcJan1 - Δ_PERIHELION));

  // Uncorrected equation of time in half-turns
  const eot0 = (δRev0 - Math.atan(Math.tan(δRev1) / Math.cos(EARTH_TILT_RAD))) / Math.PI;

  // Corrected equation of time in degrees
  const eot = (eot0 - Math.round(eot0)) * DEGS_IN_CIRCLE/2;

  // Solar declination in degrees
  const dec = -rad2Deg(Math.asin(Math.sin(EARTH_TILT_RAD) * Math.cos(δRev1)));

  // Solar longitude in degrees
  let lon = δRot - eot - DEGS_IN_CIRCLE/2;
  lon %= DEGS_IN_CIRCLE;
  if (lon < 0) lon += DEGS_IN_CIRCLE;

  return new LatLon(dec, lon);
}

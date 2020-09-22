// ==================================================================
// CAHILL CONFORMAL PROJECTION CODE
// ------------------------------------------------------------------

import { HALF_ROOT_3, QUARTER_PI, PI_OVER_6 } from './math.mjs';
import { Point, LatLon } from './data-types.mjs';
import { Pole, mapObliqueLatLon } from './spherical.mjs';

// ------------------------------------------------------------------

// 2^(2/3)/6 ∫₀^π sin^(-1/3)(x)dx
//
// This constant value is copied from jkunimune15/Map-Projections:
// https://github.com/jkunimune15/Map-Projections/blob/
//   eb64c3f91414b22c45db4bd9642fa1aa748ea238/src/maps/Octohedral.java#L119
const HEXAGON_SCALE = 1.1129126745;

// Pole object representing a pole on the equator at the east vertex of an octant
const VERTEX = new Pole(0, QUARTER_PI, -3 * QUARTER_PI);

// ------------------------------------------------------------------

// Returns the basic projected octant-based map coordinates as a Point object
// of a given LatLon object in radians. The octant is defined as an upright
// equilateral triangle where the N pole is the top vertex and the equator is
// the bottom side and the central meridian/altitude is 0° longitude.
//
// This function is an adaptation of faceProject() in jkunimune15/Map-Projections:
// https://github.com/jkunimune15/Map-Projections/blob/
//   f1aac1f383cf902d6fe7ba8a7e586f860bb39f43/src/maps/Octohedral.java#L123-L139
export function projectInOctant(latLon) {

  // Temporarily negate negative longitudes to take advantage of octant symmetry
  const negate = latLon.lon < 0 ? -1 : 1;
  latLon.lon = negate * latLon.lon;

  // Get coordinates of latLon as seen from the VERTEX pole
  const oblique = mapObliqueLatLon(latLon, VERTEX);

  // Select original latLon or oblique latLon depending on which is closer
  // to the north or VERTEX poles
  const latLonPrime = latLon.lat > oblique.lat ? latLon : oblique;

  // Apply the conformal projection
  const w = new Complex({
    r   : Math.pow(Math.tan(QUARTER_PI - latLonPrime.lat/2), 2/3),
    phi : latLonPrime.lon * 2/3,
  });
  const z = projectConformal(w);

  // Return the projected point, taking care to reverse the temporary negation
  return (
    latLon.lat > oblique.lat
      ? new Point(negate * z.im, z.re)
      : new Point(
        negate * (-HALF_ROOT_3 * z.re - z.im/2 + 1/2),
        -z.re/2 + HALF_ROOT_3 * z.im + HALF_ROOT_3,
      )
  );
}

// ------------------------------------------------------------------

// This is an approximation of the conformal Cahill projection math.
//
// This function is an adaptation of polynomial() in jkunimune15/Map-Projections:
// https://github.com/jkunimune15/Map-Projections/blob/
//   f1aac1f383cf902d6fe7ba8a7e586f860bb39f43/src/maps/Octohedral.java#L162-L167
function projectConformal(c) {
  const c1 = c.mul(new Complex({ r: 1, phi: -PI_OVER_6 }));
  const c2 = c1
    .add(c1.pow(7 ).div(21     ))
    .add(c1.pow(11).div(99     ))
    .add(c1.pow(13).div(1287/16));
  return c2.div(new Complex({ r: HEXAGON_SCALE, phi: -PI_OVER_6 }));
}

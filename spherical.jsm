// ==================================================================
// BASIC SPHERICAL MATH FUNCTIONS
// ------------------------------------------------------------------

import { TWO_PI, HALF_PI } from './math.jsm';
import { LatLon } from './data-types.jsm';

// ------------------------------------------------------------------

// Class to represent a pole; basically a LatLon object
// with an additional orientation angle
export class Pole {

  constructor(lat, lon, θ) {
    this.lat = lat;
    this.lon = lon;
    this.θ   = θ;
  }

  isEqualTo(otherPole) {
    return (
      this.lat === otherPole.lat &&
      this.lon === otherPole.lon &&
      this.θ   === otherPole.θ
    );
  }
}
// ------------------------------------------------------------------

// Pole object representing the standard N pole
const NORTH_POLE = new Pole(HALF_PI, 0, 0);

// ------------------------------------------------------------------

// Compute the relative latitude and longitude of a given LatLon object in
// radians given a specified pole; returns a new LatLon object in radians.
//
// This function is an adaptation of obliquifySphc() in jkunimune15/Map-Projections:
// https://github.com/jkunimune15/Map-Projections/blob/
//   1d5a4d97b9e63ef614c133c9e028ba8e44702c10/src/maps/Projection.java#L400-L441
export function mapObliqueLatLon(latLon, pole) {

  if (pole.isEqualTo(NORTH_POLE)) return latLon.copy();

  const δLon = pole.lon - latLon.lon;
  const cosΔLon = Math.cos(δLon);

  const lat1 = (pole.lat === HALF_PI)
    ? latLon.lat
    : HALF_PI - getLatLonDistance(pole, latLon);

  let lon1 = (pole.lat === HALF_PI)
    ? lon1 = δLon
    : Math.acos(
        (
          Math.cos(pole.lat) * Math.sin(latLon.lat) -
          Math.sin(pole.lat) * Math.cos(latLon.lat) * cosΔLon
        ) / Math.cos(lat1)
      ) - Math.PI;
  if (isNaN(lon1)) {
    lon1 = (
      (cosΔLon >= 0 && latLon.lat <  pole.lat) ||
      (cosΔLon <  0 && latLon.lat < -pole.lat)
    ) ? 0 : -Math.PI;
  }
  else if (Math.sin(-δLon) > 0) {
    lon1 = -lon1;
  }
  lon1 -= pole.θ;
  while (lon1 >  Math.PI) lon1 -= TWO_PI;
  while (lon1 < -Math.PI) lon1 += TWO_PI;

  return new LatLon(lat1, lon1);
}

// ------------------------------------------------------------------

// Return the distance in radians of a given LatLon object from another
// LatLon object, both in radians
export function getLatLonDistance(origin, destination) {
  const cosΔLon = Math.cos(origin.lon - destination.lon);
  return (
    HALF_PI - Math.asin(
      Math.sin(origin.lat) * Math.sin(destination.lat) +
      Math.cos(origin.lat) * Math.cos(destination.lat) * cosΔLon
    )
  );
}
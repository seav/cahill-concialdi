// ==================================================================
// BASIC SPHERICAL MATH FUNCTIONS
// ------------------------------------------------------------------

import { TWO_PI, HALF_PI } from './globals.mjs';
import { LatLon } from './data-types.mjs';

// ------------------------------------------------------------------

// Class to represent a pole; extends LatLon with an orientation angle
export class Pole extends LatLon {

  constructor(lat, lon, θ) {
    super(lat, lon);
    this.θ = θ;
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  isEqualTo(otherPole) {
    return (
      this.lat === otherPole.lat &&
      this.lon === otherPole.lon &&
      this.θ   === otherPole.θ
    );
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Compute the relative latitude and longitude of a given LatLon object in
  // radians given this pole (in radians); returns a new LatLon object in radians.
  //
  // This function is an adaptation of obliquifySphc() in jkunimune15/Map-Projections:
  // https://github.com/jkunimune15/Map-Projections/blob/
  //   1d5a4d97b9e63ef614c133c9e028ba8e44702c10/src/maps/Projection.java#L400-L441
  mapObliqueLatLon(latLon) {

    if (this.isEqualTo(NORTH_POLE)) return latLon.copy();

    const δLon = this.lon - latLon.lon;
    const cosΔLon = Math.cos(δLon);

    const lat1 = (this.lat === HALF_PI)
      ? latLon.lat
      : HALF_PI - this.getDistanceTo(latLon);

    let lon1 = (this.lat === HALF_PI)
      ? lon1 = δLon
      : Math.acos(
          (
            Math.cos(this.lat) * Math.sin(latLon.lat) -
            Math.sin(this.lat) * Math.cos(latLon.lat) * cosΔLon
          ) / Math.cos(lat1)
        ) - Math.PI;
    if (isNaN(lon1)) {
      lon1 = (
        (cosΔLon >= 0 && latLon.lat <  this.lat) ||
        (cosΔLon <  0 && latLon.lat < -this.lat)
      ) ? 0 : -Math.PI;
    }
    else if (Math.sin(-δLon) > 0) {
      lon1 = -lon1;
    }
    lon1 -= this.θ;
    while (lon1 >  Math.PI) lon1 -= TWO_PI;
    while (lon1 < -Math.PI) lon1 += TWO_PI;

    return new LatLon(lat1, lon1);
  }

}

// ------------------------------------------------------------------

// Pole object representing the standard N pole
const NORTH_POLE = new Pole(HALF_PI, 0, 0);

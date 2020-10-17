// ==================================================================
// CAHILL-CONCIALDI BAT PROJECTION CODE
// ------------------------------------------------------------------

import { PI_OVER_6, DEGS_IN_CIRCLE, deg2Rad } from './globals.mjs';
import { Point, LatLon } from './data-types.mjs';
import { projectInOctant } from './cahill-conformal.mjs';

// ------------------------------------------------------------------

// Map area parameters (default unit is SVG length unit)
       const OCTANT_SCALE    = 100;  // side length of a projected octant
export const MAP_VIEW_ORIGIN = new Point(142, 45.5);
export const MAP_WIDTH       = 302;
export const MAP_HEIGHT      = 178;
export const MAP_TILT_DEG    = -5.4;  // Tilt of the map in degrees
export const MAP_TILT        = deg2Rad(MAP_TILT_DEG);

// Constants for the origin field of the MapArea class
const NORTH_POLE_ORIGIN   = new Point(0, 0);
const SOUTH_POLE_B_ORIGIN = new Point(   0, 2*Math.cos(PI_OVER_6));
const SOUTH_POLE_L_ORIGIN = new Point(-1.5,   Math.cos(PI_OVER_6));
const SOUTH_POLE_R_ORIGIN = new Point( 1.5,   Math.cos(PI_OVER_6));

// ------------------------------------------------------------------

// Class to represents a map area
// (either the whole or a portion of an octant / octahedral face)
class MapArea {

  constructor(centerLon, swCorner, neCorner, origin, angle) {

    // Longitude of the octant's center in degrees
    this.centerLon = centerLon;

    // LatLon objects representing the SW and NE corners of the map area
    this.swCorner = swCorner;
    this.neCorner = neCorner;

    // Indicates if the octant is in the northern hemisphere
    this.isNorth = neCorner.lat > 0;

    // Point object representing the position of the projected N or S pole.
    // Note: This does not yet take map scaling and rotation into account.
    this.origin = origin;

    // Angle in radians representing the direction of S for the N pole or N for
    // the S pole and where 0° points down and positive degrees runs clockwise.
    // Note 1: This does not yet take map scaling and tilt into account.
    // Note 2: Constructor param must be in degrees.
    this.angle = deg2Rad(angle);

    // Indicates if the map area contains the antimeridian (180°)
    this.hasAntimeridian = swCorner.lon > neCorner.lon;
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Returns true if the specified LatLon object is inside the map area
  // Note: Assumes that the param is within the Earth
  //       (lat: [-90°,90°]; lon: [-180°,180°])
  contains(latLon) {
    return (
      this.swCorner.lat <= latLon.lat && latLon.lat <= this.neCorner.lat &&
      (
        this.hasAntimeridian
          ? (this.swCorner.lon <= latLon.lon || latLon.lon <= this.neCorner.lon)
          : (this.swCorner.lon <= latLon.lon && latLon.lon <= this.neCorner.lon)
      )
    );
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Returns a Point object representing the projected map coordinates of a
  // given LatLon object in degrees, taking scaling, but not tilt, into account.
  project(latLon) {

    // Normalize input then do basic octant projection (no scaling or tilt)
    const normalLatLon = this._getNormalizedOctantLatLon(latLon);
    const point = projectInOctant(normalLatLon.toRadians());

    // Invert x to reverse the absolute function applied in the normalization
    if (!this.isNorth) point.x = -point.x;

    // Return projected coordinates with scaling
    return point.rotate(this.angle).translate(this.origin).scale(OCTANT_SCALE);
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Returns a new LatLon object in degrees representing the normalized
  // coordinates given a LatLon object in degrees, where:
  // - latitude is the distance from the equator (regardless if N/S)
  // - longitude is the difference from the octant's center longitude
  _getNormalizedOctantLatLon(latLon) {
    return new LatLon(
      Math.abs(latLon.lat),
      this.hasAntimeridian
        ? (
          (latLon.lon     < 0 ? latLon.lon     + DEGS_IN_CIRCLE : latLon.lon    ) -
          (this.centerLon < 0 ? this.centerLon + DEGS_IN_CIRCLE : this.centerLon)
        )
        : latLon.lon - this.centerLon,
    );
  }
}

// ------------------------------------------------------------------

// List of the 12 MapArea objects
export const MAP_AREAS = [
  [-160, new LatLon(  0, -168.5), new LatLon( 90, -115  ), NORTH_POLE_ORIGIN  ,  120],
  [ -70, new LatLon(  0, -115  ), new LatLon( 90,  -25  ), NORTH_POLE_ORIGIN  ,   60],
  [  20, new LatLon(  0,  -25  ), new LatLon( 90,   65  ), NORTH_POLE_ORIGIN  ,    0],
  [ 110, new LatLon(  0,   65  ), new LatLon( 90,  155  ), NORTH_POLE_ORIGIN  ,  -60],
  [-160, new LatLon(  0,  155  ), new LatLon( 90, -168.5), NORTH_POLE_ORIGIN  , -120],
  [-160, new LatLon(-90, -150  ), new LatLon(  0, -115  ), SOUTH_POLE_L_ORIGIN,  180],
  [ -70, new LatLon(-90, -115  ), new LatLon(  0,  -25  ), SOUTH_POLE_L_ORIGIN, -120],
  [  20, new LatLon(-90,  -25  ), new LatLon(-45,   15  ), SOUTH_POLE_L_ORIGIN,  -60],
  [  20, new LatLon(-45,  -25  ), new LatLon(  0,   65  ), SOUTH_POLE_B_ORIGIN, -180],
  [  20, new LatLon(-90,   15  ), new LatLon(-45,   65  ), SOUTH_POLE_R_ORIGIN,   60],
  [ 110, new LatLon(-90,   65  ), new LatLon(  0,  155  ), SOUTH_POLE_R_ORIGIN,  120],
  [-160, new LatLon(-90,  155  ), new LatLon(  0, -150  ), SOUTH_POLE_R_ORIGIN,  180],
].map(params => new MapArea(...params));

// ------------------------------------------------------------------

// The entry function to project a LatLon object in degrees to its map position
// as a Point object, not taking tilt into account.
// If the areaIdx param is specified, it will coerce projection on that MapArea,
// otherwise it will select the first MapArea that contains the LatLon object.
// The areaIdx param is needed because the edges of the MapAreas overlap and may
// project to different places on the map if the MapAreas aren't adjacent.
export function project(latLon, areaIdx = null) {
  const area = areaIdx !== null
    ? MAP_AREAS[areaIdx]
    : MAP_AREAS.find(area => area.contains(latLon));
  return area.project(latLon);
}

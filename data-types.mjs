// ==================================================================
// PRIMITIVE DATA TYPE CLASSES
// ------------------------------------------------------------------

import { HALF_PI, deg2Rad } from './math.mjs';

// ------------------------------------------------------------------

// Class to represent a Cartesian 2D point
export class Point {

  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  copy() {
    return new Point(this.x, this.y);
  }

  isEqualTo(otherPoint) {
    return (
      this.x === otherPoint.x &&
      this.y === otherPoint.y
    );
  }

  getAngleTo(otherPoint) {
    return Math.atan2(otherPoint.y - this.y, otherPoint.x - this.x);
  }

  getDistanceTo(otherPoint) {
    return Math.hypot(otherPoint.y - this.y, otherPoint.x - this.x);
  }

  translate(δPoint) {
    this.x += δPoint.x;
    this.y += δPoint.y;
    return this;
  }

  scale(factor) {
    this.x *= factor;
    this.y *= factor;
    return this;
  }

  rotate(θ) {
    const cosΘ = Math.cos(θ);
    const sinΘ = Math.sin(θ);
    const original = this.copy();
    this.x = original.x * cosΘ - original.y * sinΘ;
    this.y = original.x * sinΘ + original.y * cosΘ;
    return this;
  }

  // Returns an SVG-friendly string representation of the point and
  // rounded to at most 2 decimal points
  toString() {
    return (`${this.x.toFixed(2)},${this.y.toFixed(2)}`).replace(/\.00/g, '');
  }
}

// ------------------------------------------------------------------

// Class to represent a pair of coordinates on Earth
export class LatLon {

  constructor(lat, lon) {
    this.lat = lat;
    this.lon = lon;
  }

  copy() {
    return new LatLon(this.lat, this.lon);
  }

  // Assuming object is in degrees, returns a new object in radians
  toRadians() {
    return new LatLon(deg2Rad(this.lat), deg2Rad(this.lon));
  }

  // Return the distance in radians to another LatLon object assuming this
  // object is already in radians
  getDistanceTo(otherLatLon) {
    const cosΔLon = Math.cos(this.lon - otherLatLon.lon);
    return HALF_PI - Math.asin(
      Math.sin(this.lat) * Math.sin(otherLatLon.lat) +
      Math.cos(this.lat) * Math.cos(otherLatLon.lat) * cosΔLon
    );
  }
};

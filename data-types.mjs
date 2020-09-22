// ==================================================================
// PRIMITIVE DATA TYPE CLASSES
// ------------------------------------------------------------------

// Class to represent a Cartesian 2D point
export class Point {

  constructor(x, y) {
    this.x = x;
    this.y = y;
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
    return new LatLon(this.lat*Math.PI/180, this.lon*Math.PI/180);
  }
};

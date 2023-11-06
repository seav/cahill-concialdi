// ==================================================================
// RASTER MAP DRAWING ROUTINES
// ------------------------------------------------------------------

import { fQS, MAX_COLOR_VALUE, TWO_PI, DEGS_IN_CIRCLE, deg2Rad, SVG_NS } from './globals.mjs';
import { Point, LatLon } from './data-types.mjs';
import { MAP_VIEW_ORIGIN, MAP_WIDTH, MAP_HEIGHT, MAP_TILT,
         MAP_AREAS, project } from './concialdi.mjs';
import { initVectorMap, drawData } from "./map-vector.mjs";
import { getSunLatLon } from './solar-position.mjs';

// ------------------------------------------------------------------

// Channels in Canvas data: RGBA
const NUM_CANVAS_DATA_CHANNELS = 4;

// Filenames of the source raster maps in plate carrée projection.
const NE_I_FILENAME       = 'ne-i.jpg';
const NE_HYPSO_FILENAME   = 'ne-hypso.jpg';
const NASA_BLUE_FILENAME  = 'nasa-blue-marble-ng.jpg';
const NASA_BLACK_FILENAME = 'nasa-black-marble.jpg';

// Source raster maps' pixels per degree measure.
// Note: All maps are expected to have 3600×1800 dimensions.
const SOURCE_RASTER_PPD = 10;

// HiDPI factor: Canvas dimensions will be upscaled by this factor
const CANVAS_PIXEL_DENSITY = 3;

// Min-max distance of the solar terminator in radians from the solar position;
// interval is used for terminator "blurring"
const MIN_TERMINATOR_DISTANCE = deg2Rad(89);
const MAX_TERMINATOR_DISTANCE = deg2Rad(92);

// ------------------------------------------------------------------

// Declare available raster map styles (data type and instances)

class RasterStyle {
  constructor(filenames, isDayNight, graticuleColor) {
    this.filenames = filenames;
    this.isDayNight = isDayNight;
    this.graticuleColor = graticuleColor;
  }
}

export const [
  RASTER_NE_I,
  RASTER_NE_HYPSO,
  RASTER_NASA_BLUE,
  RASTER_NASA_BLACK,
  RASTER_NE_I_DAY_NIGHT,
  RASTER_NE_HYPSO_DAY_NIGHT,
  RASTER_NASA_DAY_NIGHT,
] = [
  [[NE_I_FILENAME                          ], false, '#0002'],
  [[NE_HYPSO_FILENAME                      ], false, '#0002'],
  [[NASA_BLUE_FILENAME                     ], false, '#fff3'],
  [[NASA_BLACK_FILENAME                    ], false, '#fff3'],
  [[NE_I_FILENAME                          ], true , '#0002'],
  [[NE_HYPSO_FILENAME                      ], true , '#0002'],
  [[NASA_BLUE_FILENAME, NASA_BLACK_FILENAME], true , '#fff3'],
].map(params => new RasterStyle(...params));

// ------------------------------------------------------------------

let RasterMapIsInit = false;

// Main Canvas, Canvas context, and Canvas data
const Canvas = fQS('canvas');
const CanvasContext = Canvas.getContext('2d');
let CanvasData;

// Ratio of canvas length per SVG length
let CanvasPerSvgFactor;

// Current selected raster style
let CurrentRasterStyle;

// Source map(s)' raw image data
let SourceRasterRawData;

// Current position of the sun as a LatLon object in radians
let SunPosition;

// ------------------------------------------------------------------

// Class to represent a 1°×1° cell of the raster map
class MapCell {

  constructor(swLatLon, cellCorners, maskCorners) {

    // Original LatLon of the cell's SW corner in degrees
    this.swLatLon = swLatLon;

    // Array of projected coordinates (as Point objects) of the cell corners
    // starting from the SW corner going counterclockwise
    this.cellCorners = cellCorners;

    // Same as above but for the cell mask to account for the half-cells along
    // the Bering Strait cut: we only draw pixels within the mask
    this.maskCorners = maskCorners;

    const isNorthPolar = cellCorners[2].isEqualTo(cellCorners[3]);
    const isSouthPolar = cellCorners[0].isEqualTo(cellCorners[1]);

    // Indicates if this cell is adjacent to the N/S pole
    this.isPolar = isNorthPolar || isSouthPolar;

    // If isPolar, indicates if this cell is adjacent to the N pole
    this.isNorthPolar = isNorthPolar;
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Draws this cell's portion of the raster map by writing into the global
  // CanvasData object and reading from the SourceRasterRawData object
  drawCell() {

    const xs = this.maskCorners.map(point => point.x);
    const ys = this.maskCorners.map(point => point.y);
    const minX = Math.floor(Math.min(...xs));
    const maxX = Math.ceil (Math.max(...xs));
    const minY = Math.floor(Math.min(...ys));
    const maxY = Math.ceil (Math.max(...ys));

    for   (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {

        const pixelPos = new Point(x, y);

        if (!this.isInMask(pixelPos)) continue;

        const latLon = this.isPolar
          ? this.getPolarInverseLatLon(pixelPos)
          : this.getInverseLatLon     (pixelPos);
        const pixelOffset = new Point(
          (latLon.lon + DEGS_IN_CIRCLE/2) % DEGS_IN_CIRCLE,
          DEGS_IN_CIRCLE/4 - latLon.lat,
        );
        const srcDataIdx = NUM_CANVAS_DATA_CHANNELS * (
          Math.floor(SOURCE_RASTER_PPD * pixelOffset.y) * DEGS_IN_CIRCLE * SOURCE_RASTER_PPD +
          Math.floor(SOURCE_RASTER_PPD * pixelOffset.x)
        );
        const destDataIdx = NUM_CANVAS_DATA_CHANNELS * (y * Canvas.width + x);

        const pixelData = [
          SourceRasterRawData[0][srcDataIdx    ],
          SourceRasterRawData[0][srcDataIdx + 1],
          SourceRasterRawData[0][srcDataIdx + 2],
        ];

        if (CurrentRasterStyle.isDayNight) {
          const distance = SunPosition.getDistanceTo(latLon.toRadians());
          let dayRatio =
            distance <= MIN_TERMINATOR_DISTANCE
              ? 1
              : distance >= MAX_TERMINATOR_DISTANCE
                ? 0
                : 1 - (distance - MIN_TERMINATOR_DISTANCE) / (MAX_TERMINATOR_DISTANCE - MIN_TERMINATOR_DISTANCE);
          const has2SourceImages = SourceRasterRawData.length === 2;
          if (!has2SourceImages) dayRatio = (dayRatio + 1)/2;
          pixelData[0] *= dayRatio;
          pixelData[1] *= dayRatio;
          pixelData[2] *= dayRatio;
          if (has2SourceImages && dayRatio < 1) {
            pixelData[0] += SourceRasterRawData[1][srcDataIdx    ] * (1 - dayRatio);
            pixelData[1] += SourceRasterRawData[1][srcDataIdx + 1] * (1 - dayRatio);
            pixelData[2] += SourceRasterRawData[1][srcDataIdx + 2] * (1 - dayRatio);
          }
        }

        CanvasData.data[destDataIdx    ] = pixelData[0];
        CanvasData.data[destDataIdx + 1] = pixelData[1];
        CanvasData.data[destDataIdx + 2] = pixelData[2];
        CanvasData.data[destDataIdx + 3] = MAX_COLOR_VALUE;
      }
    }
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Returns true if the given point lies inside the cell mask.
  // This is implemented as a simplified point-in-polygon algorithm.
  isInMask(point) {
    let numIntersections = 0;
    for (let idx = 0; idx < this.maskCorners.length; idx++) {
      const edgePointA = this.maskCorners[idx];
      const edgePointB = this.maskCorners[(idx + 1) % this.maskCorners.length];
      if (
        point.x >= Math.min(edgePointA.x, edgePointB.x) &&
        point.x <  Math.max(edgePointA.x, edgePointB.x)
      ) {
        if (
          point.y >= Math.max(edgePointA.y, edgePointB.y) ||
          point.y >= Math.min(edgePointA.y, edgePointB.y) &&
          point.y >= edgePointA.y + (point.x - edgePointA.x) / (edgePointB.x - edgePointA.x) * (edgePointB.y - edgePointA.y)
        ) numIntersections++;
      }
    }
    return numIntersections % 2 === 1;
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Returns the spherical coordinates in degrees as a LatLon object
  // of a given "projected" point inside this cell if cell is not polar
  getInverseLatLon(point) {

    // Given 1°×1° cell with corners in projected map coordinates:
    //   - SW corner = (A, B) = this.cellCorners[0]
    //   - SE corner = (C, D) = this.cellCorners[1]
    //   - NW corner = (E, F) = this.cellCorners[3]
    //   - NE corner = (G, H) = this.cellCorners[2]

    const corners = this.cellCorners;

    // Set of equations determining the "projected" coordinates (x′, y′)
    // of an input relative coordinates in degrees (x, y) into a cell,
    // where (x₀, y₀) and (x₁, y₁) are intermediate coordinates:
    //   1. x₀ = A + (C - A)x
    //      y₀ = B + (D - B)x
    //      x₁ = E + (G - E)x
    //      y₁ = F + (H - F)x
    //   2. x′ = x₀ + (x₁ - x₀)y
    //      y′ = y₀ + (y₁ - y₀)y
    //
    // Equations above combined into a system of 2 equations with unknowns x, y:
    //   x′ - A = (C - A)x + (E - A)y + (A + G - C - E)xy
    //   y′ - B = (D - B)x + (F - B)y + (B + H - D - F)xy
    //
    // Helper coefficients for the system of equations:
    //   J = x′ - A
    //   K = y′ - B
    //   L = C - A
    //   M = D - B
    //   N = E - A
    //   P = F - B
    //   Q = A + G - C - E
    //   R = B + H - D - F

    const J = point.x - corners[0].x;
    const K = point.y - corners[0].y;
    const L = corners[1].x - corners[0].x;
    const M = corners[1].y - corners[0].y;
    const N = corners[3].x - corners[0].x;
    const P = corners[3].y - corners[0].y;
    const Q = corners[0].x + corners[2].x - corners[1].x - corners[3].x;
    const R = corners[0].y + corners[2].y - corners[1].y - corners[3].y;

    // Same system of equations above but using helper coefficients:
    //   J = Lx + Ny + Qxy
    //   K = Mx + Py + Rxy
    //
    // Combined equation in terms of y:
    //   y = (J - Lx)/(N + Qx) = (K - Mx)/(P + Rx)
    //
    // Quadratic equation with variable x:
    //   (-LR + QM)x² + (JR + NM - LP - QK)x + (JP - NK) = 0

    // Quadratic equation coefficients:
    const a =           - L*R + Q*M;
    const b = J*R + N*M - L*P - Q*K;
    const c = J*P - N*K;

    // Determine 2 solutions to the quadratic equation
    const discriminantRoot = Math.sqrt(b*b - 4*a*c);
    const x1 = (-b + discriminantRoot) / (2*a);
    const x2 = (-b - discriminantRoot) / (2*a);
    const y1 = (J - L * x1) / (N + Q * x1);
    const y2 = (J - L * x2) / (N + Q * x2);

    // Return one of the solutions added to the SW corner coordinates
    const latLon = (0 <= x1 && x1 <= 1 && 0 <= y1 && y1 <= 1)
      ? new LatLon(y1, x1)
      : new LatLon(y2, x2);
    latLon.lat += this.swLatLon.lat;
    latLon.lon += this.swLatLon.lon;
    return latLon;
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Returns the spherical coordinates in degrees as a LatLon object
  // of a given "projected" point inside this cell if cell is polar.
  // The algorithm is basic triangular math assuming that the cell is
  // shaped like an isosceles triangle with the vertex point at the pole.
  getPolarInverseLatLon(point) {

    const corners = this.cellCorners;

    // Compute relative latitude as a function of the ratio of the point's
    // distance to the pole
    const cellHeight = corners[2].getDistanceTo(corners[1]);
    const relLat = this.isNorthPolar
      ? 1 - corners[2].getDistanceTo(point) / cellHeight
      :     corners[1].getDistanceTo(point) / cellHeight;

    // Compute relative longitude as a function of the angle of the point
    // with respect to the pole in relation the the vertex angle
    let cellWidth = this.isNorthPolar
      ? corners[2].getAngleTo(corners[0]) - corners[2].getAngleTo(corners[1])
      : corners[1].getAngleTo(corners[2]) - corners[1].getAngleTo(corners[3]);
    if (cellWidth < 0) cellWidth += TWO_PI;
    let relLon = this.isNorthPolar
        ? +(corners[2].getAngleTo(corners[0]) - corners[2].getAngleTo(point))
        : -(corners[1].getAngleTo(corners[3]) - corners[1].getAngleTo(point));
    if (relLon < 0) relLon += TWO_PI;
    relLon /= cellWidth;

    return new LatLon(this.swLatLon.lat + relLat, this.swLatLon.lon + relLon);
  }
}

// ------------------------------------------------------------------

function initRasterMap() {
  if (RasterMapIsInit) return;
  RasterMapIsInit = true;
  Canvas.width = Canvas.clientWidth * CANVAS_PIXEL_DENSITY;
  CanvasPerSvgFactor = Canvas.width / MAP_WIDTH;
  Canvas.height = CanvasPerSvgFactor * MAP_HEIGHT;
  CanvasData = CanvasContext.getImageData(0, 0, Canvas.width, Canvas.height);
}

// ------------------------------------------------------------------

export function drawRasterMap(style, graticuleInterval = null) {

  initRasterMap();

  CanvasContext.clearRect(0, 0, Canvas.width, Canvas.height);

  CurrentRasterStyle = style;

  if (style.isDayNight) SunPosition = getSunLatLon().toRadians();

  SourceRasterRawData = [];
  const images = [];
  let numImagesLoaded = 0;

  const onloadHandler = function() {

    numImagesLoaded++;
    if (numImagesLoaded < style.filenames.length) return;

    images.forEach(image => {
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = image.width;
      sourceCanvas.height = image.height;
      const sourceContext = sourceCanvas.getContext('2d')
      sourceContext.drawImage(image, 0, 0);
      SourceRasterRawData.push(sourceContext.getImageData(0, 0, image.width, image.height).data);
    });

    MAP_AREAS.forEach((area, idx) => { drawRasterMapArea(area, idx) });
    //if (graticuleInterval !== null)
    drawRasterGraticule(graticuleInterval);
    CanvasContext.putImageData(CanvasData, 0, 0);
  }

  style.filenames.forEach(filename => {
    const image = new Image();
    image.src = filename;
    image.onload = onloadHandler;
    images.push(image);
  });
}

// ------------------------------------------------------------------

// Draws a portion of a raster map corresponding to a given MapArea and its
// index by iterating over the MapArea's 1°×1° cells
function drawRasterMapArea(area, idx) {
  for (let lat = area.swCorner.lat; lat < area.neCorner.lat; lat++) {

    // Account for the antimeridian and the Bering Strait half-cells
    const antiMeridianAdjust = area.hasAntimeridian ? DEGS_IN_CIRCLE : 0;
    const startLon = Math.floor(area.swCorner.lon);
    const endLon   = Math.ceil (area.neCorner.lon) + antiMeridianAdjust;

    for (let lon = startLon; lon < endLon; lon++) {

      const maskedLonW = Math.max(lon    , area.swCorner.lon);
      const maskedLonE = Math.min(lon + 1, area.neCorner.lon + antiMeridianAdjust);

      const cornerPositions =
        // Raw 2D list of spherical coordinates of the corners
        // starting from the SW corner going counterclockwise
        [
          // Cell corners
          [lat    , lon    ],
          [lat    , lon + 1],
          [lat + 1, lon + 1],
          [lat + 1, lon    ],
          // Cell mask corners
          [lat    , maskedLonW],
          [lat    , maskedLonE],
          [lat + 1, maskedLonE],
          [lat + 1, maskedLonW],
        ]
        .map(coords => new LatLon(...coords))
        // Do initial projection into map coordinates then rotate, translate,
        // and scale into final map coordinates (in Canvas pixels)
        .map(latLon =>
          project(latLon, idx)
          .rotate(MAP_TILT)
          .translate(MAP_VIEW_ORIGIN)
          .scale(CanvasPerSvgFactor)
        );

      const cell = new MapCell(
        new LatLon(lat, lon),
        cornerPositions.slice(0, 4),
        cornerPositions.slice(4, 8),
      );
      cell.drawCell();
    }
  }
}

// ------------------------------------------------------------------

function drawRasterGraticule(interval) {

  initVectorMap();
  //drawGraticule(interval);
  //drawSpecialCircles();
  drawData();

  // const mapSvg = fQS('svg');
  // const tempSvg = document.createElement('svg');
  // tempSvg.innerHTML = mapSvg.innerHTML;
  // tempSvg.setAttributeNS(SVG_NS, 'viewBox', mapSvg.getAttribute('viewBox'));
  // tempSvg.setAttribute('xmlns', SVG_NS);
  // tempSvg.setAttribute('width', Canvas.width);
  // tempSvg.setAttribute('height', Canvas.height);
  // mapSvg.style.display = 'none';
  // Array.from(tempSvg.querySelectorAll('path')).forEach(path => {
  //   path.setAttribute('stroke', CurrentRasterStyle.graticuleColor);
  // });

  const image = new Image();
  image.src = 'data:image/svg+xml,' + encodeURIComponent(fQS('svg').outerHTML);
  image.onload = function() {
    CanvasContext.drawImage(image, 0, 0);
  };
}

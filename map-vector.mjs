// ==================================================================
// VECTOR MAP LAYERS DRAWING ROUTINES
// ------------------------------------------------------------------

import { fGID, fQS, fCSVGE, getJson, EARTH_TILT, MAX_COLOR_VALUE, DEGS_IN_CIRCLE } from './globals.mjs';
import { LatLon } from './data-types.mjs';
import { MAP_VIEW_ORIGIN, MAP_WIDTH, MAP_HEIGHT, MAP_TILT_DEG,
         MAP_AREAS, project } from './concialdi.mjs';

// ------------------------------------------------------------------

let VectorMapIsInit = false;

// ------------------------------------------------------------------

export function initVectorMap() {
  if (VectorMapIsInit) return;
  VectorMapIsInit = true;
  fQS('svg').setAttribute('viewBox', `${-MAP_VIEW_ORIGIN.x} ${-MAP_VIEW_ORIGIN.y} ${MAP_WIDTH} ${MAP_HEIGHT}`);
  //fGID('svg-map-wrapper').setAttribute('transform', `rotate(${MAP_TILT_DEG})`);
}

// ------------------------------------------------------------------

export function drawVectorMap() {
  initVectorMap();
  //drawBackground();
  //drawGraticule(10);
  //drawSpecialCircles();
  drawCountries();
  drawBoundaries();
  drawBivariateLegend();
}

// ------------------------------------------------------------------

// Convert GeoJSON LineString or MultiPolygon coordinates to an SVG path,
// doing projection along the way
function convertGeoJsonToSvgPath(geoJson) {
  const isMultiPolygon = typeof geoJson[0][0] !== 'number';
  const path = fCSVGE('path');
  const lineStrings = isMultiPolygon ? [].concat(...geoJson) : [geoJson];
  path.setAttribute(
    'd',
    lineStrings
      .map(lineString =>
        lineString
          .map(lonLat => project(new LatLon(lonLat[1], lonLat[0])))
          .map((point, idx) => (idx ? 'L' : 'M') + point.toString())
          .join('') + (isMultiPolygon ? 'z' : '')
      )
      .join(''),
  );
  return path;
}

// ------------------------------------------------------------------

// Convert a list of list of Point objects to an SVG path
function convertPointListsToSvgPath(pointLists, isClosed) {
  const path = fCSVGE('path');
  path.setAttribute(
    'd',
    pointLists
      .map(list =>
        list.map((point, idx) => (idx ? 'L' : 'M') + point.toString()).join('') +
        (isClosed ? 'z' : '')
      )
      .join(''),
  );
  return path;
}

// ------------------------------------------------------------------

function drawCountries() {
  getJson('africa-indices.json').then(indices => {

    const minWpfi = 25;
    const wpfiRange = 60;

    const minHdi = 0.35
    const hdiRange = 0.5;

    console.log(minWpfi, wpfiRange, minHdi, hdiRange);

    getJson('ne-country-areas.json').then(countries => {
      countries.forEach(country => {

        const path = convertGeoJsonToSvgPath(country[1]);

        // // Compute fill color based on the country's position
        // // where the average of the country's coordinates is a proxy for position
        // const flatLonLatList = [].concat(...[].concat(...country[1]));
        // const numCoords = flatLonLatList.length;
        // const sumLat = flatLonLatList.reduce((sum, lonLat) => sum + lonLat[1], 0);
        // const sumLon = flatLonLatList.reduce((sum, lonLat) => sum + lonLat[0], 0);
        // let red   = MAX_COLOR_VALUE/2 * (1 + sumLat / numCoords / (DEGS_IN_CIRCLE/4));
        // let green = MAX_COLOR_VALUE/2 * (1 + sumLon / numCoords / (DEGS_IN_CIRCLE/2));
        // let blue  = MAX_COLOR_VALUE - (red + green)/2;
        // red   = Math.min(MAX_COLOR_VALUE, red  *1.25);
        // green = Math.min(MAX_COLOR_VALUE, green*1.25);
        // blue  = Math.min(MAX_COLOR_VALUE, blue *1.25);
        //const rgb = `rgb(${red},${green},${blue})`;

        if (country[0] in indices) {
          const datum = indices[country[0]];
          if (datum) {
            const rgb = getBivariateColor(
              (datum[0] - minWpfi) / wpfiRange,
              (datum[1] - minHdi ) / hdiRange,
            );

            path.setAttribute('fill'  , rgb);
            path.setAttribute('stroke', rgb);
          }
          else {
            path.setAttribute('fill', 'url(#no-data)');
          }
        }
        else {
          path.setAttribute('fill'  , `#2c2c2c`);
          path.setAttribute('stroke', `#2c2c2c`);
        }

        fGID('countries').appendChild(path);
      });
    });
  });
}

// ------------------------------------------------------------------

function drawBoundaries() {
  getJson('ne-boundaries.json').then(boundaries => {
    boundaries.forEach(boundary => {
      const path = convertGeoJsonToSvgPath(boundary[1]);
      if (!boundary[0]) path.classList.add('disputed');
      fGID('boundaries').appendChild(path);
    });
  });
}

// ------------------------------------------------------------------

// Graticule interval values in degrees
const DEFAULT_INTERVAL = 15;
const VALID_INTERVALS = [1, 2, 5, 10, 15, 20, 30];

export function drawGraticule(interval = DEFAULT_INTERVAL) {

  if (!VALID_INTERVALS.includes(interval)) interval = DEFAULT_INTERVAL;

  const pointLists = [];
  MAP_AREAS.forEach((area, idx) => {

    let points;

    let endLon = area.neCorner.lon;
    if (area.hasAntimeridian) endLon += DEGS_IN_CIRCLE;

    // Generate latitude lines
    for (
      let lat = Math.ceil (area.swCorner.lat/interval)*interval;
      lat <=    Math.floor(area.neCorner.lat/interval)*interval;
      lat += interval
    ) {
      points = [];
      for (let lon = area.swCorner.lon; lon <= endLon; lon++) {
        points.push(project(new LatLon(lat, lon), idx));
      }
      if (area.swCorner.lon % 1 !== endLon % 1) {
        // Account for the half-degree cut along the Bering Strait
        points.push(project(new LatLon(lat, endLon), idx));
      }
      pointLists.push(points);
    }

    // Generate longitude lines
    for (
      let lon = Math.ceil (area.swCorner.lon/interval)*interval;
      lon <=    Math.floor(endLon           /interval)*interval;
      lon += interval
    ) {
      points = [];
      for (let lat = area.swCorner.lat; lat <= area.neCorner.lat; lat++) {
        points.push(project(new LatLon(lat, lon), idx));
      }
      pointLists.push(points);
    }
  });

  // Draw graticule
  const path = convertPointListsToSvgPath(pointLists, false);
  fGID('graticule').appendChild(path);
}

// ------------------------------------------------------------------

// Draws the equator, tropic circles, and polar circles
export function drawSpecialCircles() {

  let pointLists;
  let points;
  let path;

  // Generate equator
  pointLists = [];
  points = [];
  points.push(project(MAP_AREAS[0].swCorner));
  points.push(project(MAP_AREAS[1].swCorner));
  points.push(project(MAP_AREAS[2].swCorner));
  points.push(project(MAP_AREAS[3].swCorner));
  points.push(project(MAP_AREAS[4].swCorner));
  points.push(project(MAP_AREAS[0].swCorner, 4));
  pointLists.push(points);
  points = [];
  points.push(project(new LatLon(0, MAP_AREAS[5].swCorner.lon), 5));
  points.push(project(MAP_AREAS[5].neCorner));
  pointLists.push(points);
  points = [];
  points.push(project(MAP_AREAS[4].swCorner));
  points.push(project(MAP_AREAS[11].neCorner, 11));
  pointLists.push(points);

  // Draw equator
  path = convertPointListsToSvgPath(pointLists, false);
  path.classList.add('equator');
  fGID('circles').appendChild(path);

  pointLists = [];

  // Generate Tropic of Cancer and Arctic Circle
  [EARTH_TILT, DEGS_IN_CIRCLE/4 - EARTH_TILT].forEach(lat => {
    points = [project(new LatLon(lat, MAP_AREAS[0].swCorner.lon))];
    for (let lon = Math.trunc(MAP_AREAS[0].swCorner.lon); lon < MAP_AREAS[4].neCorner.lon + DEGS_IN_CIRCLE; lon++) {
      points.push(project(new LatLon(lat, lon)));
    }
    points.push(project(new LatLon(lat, MAP_AREAS[4].neCorner.lon), 4));
    pointLists.push(points);
  });

  // Generate Tropic of Capricorn
  points = [];
  for (let lon = MAP_AREAS[5].swCorner.lon; lon <= MAP_AREAS[6].neCorner.lon; lon++) {
    points.push(project(new LatLon(-EARTH_TILT, lon)));
  }
  pointLists.push(points);
  points = [];
  for (let lon = MAP_AREAS[8].swCorner.lon; lon <= MAP_AREAS[8].neCorner.lon; lon++) {
    points.push(project(new LatLon(-EARTH_TILT, lon), 8));
  }
  pointLists.push(points);
  points = [];
  for (let lon = MAP_AREAS[10].swCorner.lon; lon <= MAP_AREAS[11].neCorner.lon + DEGS_IN_CIRCLE; lon++) {
    points.push(project(new LatLon(-EARTH_TILT, lon), points.length === 0 ? 10 : undefined));
  }
  pointLists.push(points);

  // Generate Antarctic Circle
  points = [];
  for (let lon = MAP_AREAS[5].swCorner.lon; lon <= MAP_AREAS[7].neCorner.lon; lon++) {
    points.push(project(new LatLon(-DEGS_IN_CIRCLE/4 + EARTH_TILT, lon)));
  }
  pointLists.push(points);
  points = [];
  for (let lon = MAP_AREAS[9].swCorner.lon; lon <= MAP_AREAS[11].neCorner.lon + DEGS_IN_CIRCLE; lon++) {
    points.push(project(new LatLon(-DEGS_IN_CIRCLE/4 + EARTH_TILT, lon), points.length === 0 ? 9 : undefined));
  }
  pointLists.push(points);

  // Draw tropic and polar circles
  path = convertPointListsToSvgPath(pointLists, false);
  path.classList.add('polar-tropic');
  fGID('circles').appendChild(path);
}

// ------------------------------------------------------------------

// Draw the map background/outline
function drawBackground() {

  // Generate background points
  const points = [];
  points.push(project(new LatLon(MAP_AREAS[5].neCorner.lat, MAP_AREAS[5].swCorner.lon), 5));
  for (let lat = 0; lat >= -DEGS_IN_CIRCLE/4; lat--) {
    points.push(project(new LatLon(lat, MAP_AREAS[5].swCorner.lon), 5));
  }
  for (let lon = MAP_AREAS[7].neCorner.lon; lon >= MAP_AREAS[7].swCorner.lon; lon--) {
    points.push(project(new LatLon(MAP_AREAS[7].neCorner.lat, lon)));
  }
  points.push(project(MAP_AREAS[6].neCorner, 6));
  for (let lon = MAP_AREAS[8].swCorner.lon; lon <= MAP_AREAS[8].neCorner.lon; lon++) {
    points.push(project(new LatLon(MAP_AREAS[8].swCorner.lat, lon), 8));
  }
  points.push(project(MAP_AREAS[8].neCorner));
  for (let lon = MAP_AREAS[9].neCorner.lon; lon >= MAP_AREAS[9].swCorner.lon; lon--) {
    points.push(project(new LatLon(MAP_AREAS[9].neCorner.lat, lon), 9));
  }
  for (let lat = -DEGS_IN_CIRCLE/4; lat <= 0; lat++) {
    points.push(project(new LatLon(lat, MAP_AREAS[11].neCorner.lon), 11));
  }
  points.push(project(MAP_AREAS[10].neCorner));
  for (let lat = 0; lat < DEGS_IN_CIRCLE/4; lat++) {
    points.push(project(new LatLon(lat, MAP_AREAS[4].neCorner.lon), 4));
  }
  for (let lat = DEGS_IN_CIRCLE/4; lat >= 0; lat--) {
    points.push(project(new LatLon(lat, MAP_AREAS[0].swCorner.lon)));
  }
  points.push(project(MAP_AREAS[5].neCorner));

  // Draw background
  fGID('background').setAttribute(
    'd',
    points.map((point, idx) => (idx ? 'L' : 'M') + point.toString()).join(''),
  );
}

function drawBivariateLegend() {
  const range = [0, 0.2, 0.4, 0.6, 0.8];
  range.forEach(val1 => {
    range.forEach(val2 => {
      const rgb = getBivariateColor(val1, val2);
      const box = fCSVGE('rect');
      box.setAttribute('x', val1 * 40 + 4);
      box.setAttribute('y', val2 * 40 + 4);
      box.setAttribute('width' , 8);
      box.setAttribute('height', 8);
      box.setAttribute('fill'  , rgb);
      box.setAttribute('stroke', rgb);
      fGID('legend').appendChild(box);
    })
  })
}

function getBivariateColor(val1, val2) {

  const seqseq2Colors = [
    [[  0,  0,  0], [179,102,  0], [243,179,  0]],
    [[ 55, 99,135], [179,179,179], [243,230,179]],
    [[ 80,157,194], [180,211,225], [243,243,243]],
  ];

  const val1Gen = Math.min(4, Math.floor(val1 * 5));
  const val2Gen = Math.min(4, Math.floor(val2 * 5));

  function getAverageColor(rgb1, rgb2) {
    return [0, 1, 2].map(idx => Math.floor((rgb1[idx] + rgb2[idx]) / 2));
  }

  let red, green, blue;
  if (val1Gen % 2 === 0 && val2Gen % 2 === 0) {
    [red, green, blue] = seqseq2Colors[val1Gen / 2][val2Gen / 2];
  }
  else if (val1Gen % 2 === 0) {
    [red, green, blue] = getAverageColor(
      seqseq2Colors[val1Gen / 2][Math.floor(val2Gen / 2)],
      seqseq2Colors[val1Gen / 2][Math.ceil (val2Gen / 2)],
    );
  }
  else if (val2Gen % 2 === 0) {
    [red, green, blue] = getAverageColor(
      seqseq2Colors[Math.floor(val1Gen / 2)][val2Gen / 2],
      seqseq2Colors[Math.ceil (val1Gen / 2)][val2Gen / 2],
    );
  }
  else {
    [red, green, blue] = getAverageColor(
      getAverageColor(
        seqseq2Colors[Math.floor(val1Gen / 2)][Math.floor(val2Gen / 2)],
        seqseq2Colors[Math.floor(val1Gen / 2)][Math.ceil (val2Gen / 2)],
      ),
      getAverageColor(
        seqseq2Colors[Math.ceil (val1Gen / 2)][Math.floor(val2Gen / 2)],
        seqseq2Colors[Math.ceil (val1Gen / 2)][Math.ceil (val2Gen / 2)],
      ),
    );
  }

  return `rgb(${red},${green},${blue})`;
}

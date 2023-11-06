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
  fGID('svg-map-wrapper').setAttribute('transform', `rotate(${MAP_TILT_DEG})`);
}

// ------------------------------------------------------------------

export function drawVectorMap() {
  initVectorMap();
  drawBackground();
  drawGraticule(10);
  drawSpecialCircles();
  drawCountries();
  drawBoundaries();
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
  getJson('ne-country-areas.json').then(countries => {
    countries.forEach(country => {

      const path = convertGeoJsonToSvgPath(country[1]);

      // Compute fill color based on the country's position
      // where the average of the country's coordinates is a proxy for position
      const flatLonLatList = [].concat(...[].concat(...country[1]));
      const numCoords = flatLonLatList.length;
      const sumLat = flatLonLatList.reduce((sum, lonLat) => sum + lonLat[1], 0);
      const sumLon = flatLonLatList.reduce((sum, lonLat) => sum + lonLat[0], 0);
      let red   = MAX_COLOR_VALUE/2 * (1 + sumLat / numCoords / (DEGS_IN_CIRCLE/4));
      let green = MAX_COLOR_VALUE/2 * (1 + sumLon / numCoords / (DEGS_IN_CIRCLE/2));
      let blue  = MAX_COLOR_VALUE - (red + green)/2;
      red   = Math.min(MAX_COLOR_VALUE, red  *1.25);
      green = Math.min(MAX_COLOR_VALUE, green*1.25);
      blue  = Math.min(MAX_COLOR_VALUE, blue *1.25);
      const rgb = `rgb(${red},${green},${blue})`;
      path.setAttribute('fill'  , rgb);
      path.setAttribute('stroke', rgb);

      fGID('countries').appendChild(path);
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



export function drawData() {
  console.log('test');
  [
    ["Beijing",365,116.408,39.904,true],
    ["Delhi",126,77.217,28.667],
    ["Dubai",210,55.309,25.27],
    ["Guangzhou",68,113.26,23.13,true],
    ["Hangzhou",98,120.168,30.25,true,,true],
    ["Hong Kong",305,114.159,22.278,,true],
    ["Istanbul",64,28.96,41.01],
    ["Mumbai",224,72.878,19.076],
    ["Osaka",70,135.502,34.694],
    ["Riyadh",65,46.71,24.65,true],
    ["Seoul",185,126.99,37.56],
    ["Shanghai",332,121.467,31.167],
    ["Shenzhen",154,114.054,22.535],
    ["Singapore",330,103.8,1.3],
    ["Taipei",82,121.563,25.038],
    ["Tel Aviv",86,34.78,32.08],
    ["Tokyo",275,139.692,35.689],
  ]
  .sort((a, b) => a[2] - b[2])
  .forEach(datum => {
    const latLon = new LatLon(datum[3], datum[2]);
    const pos = project(latLon);

    const bar = fCSVGE('rect');
    bar.setAttribute('x', pos.x - 0.3);
    bar.setAttribute('y', pos.y);
    bar.setAttribute('width', 0.6);
    bar.setAttribute('height', datum[1]/20);
    bar.setAttribute('stroke', '#000');
    bar.setAttribute('stroke-width', 0.1);
    bar.setAttribute('fill', '#f00');
    bar.setAttribute('transform', `rotate(135 ${pos.x} ${pos.y})`)
    fGID('countries').appendChild(bar);

    const label = fCSVGE('text');
    label.innerHTML = `${datum[0]}`;
    label.setAttribute('x', pos.x + (datum[4] ? -1 : 1) + (datum[6] ? -2 : 0));
    label.setAttribute('y', pos.y - 1.1 + (datum[5] ? 2.5 : 0));
    label.setAttribute('text-anchor', datum[4] ? 'end' : 'start');
    label.setAttribute('fill', '#800');
    label.style.fontFamily = 'Ubuntu Condensed';
    label.style.fontSize = '1.5px';
    label.setAttribute('transform', `rotate(-45 ${pos.x} ${pos.y})`)
    fGID('countries').appendChild(label);

    const subLabel = fCSVGE('text');
    subLabel.innerHTML = `${datum[1]}`;
    subLabel.setAttribute('x', pos.x + (datum[4] ? -1 : 1) + (datum[6] ? -2 : 0));
    subLabel.setAttribute('y', pos.y + (datum[5] ? 2.5 : 0));
    subLabel.setAttribute('text-anchor', datum[4] ? 'end' : 'start');
    subLabel.setAttribute('fill', '#000');
    subLabel.style.fontFamily = 'Ubuntu';
    subLabel.style.fontSize = '1px';
    subLabel.style.fontWeight = 'bold';
    subLabel.setAttribute('transform', `rotate(-45 ${pos.x} ${pos.y})`)
    fGID('countries').appendChild(subLabel);
  });
}
// ==================================================================
// GLOBAL CONSTANT VALUES AND FUNCTIONS
// ------------------------------------------------------------------

// DOM function aliases
export const fGID   = id       => document.getElementById(id);
export const fQS    = selector => document.querySelector(selector);
export const fCSVGE = name     => document.createElementNS(SVG_NS, name);

// Simple JSON fetcher
export const getJson = filename => fetch(filename).then(response => response.json());

// Math constants
export const HALF_ROOT_3    = Math.sqrt(3)/2;
export const TWO_PI         = 2*Math.PI;
export const HALF_PI        = Math.PI/2;
export const QUARTER_PI     = Math.PI/4;
export const PI_OVER_6      = Math.PI/6;
export const DEGS_IN_CIRCLE = 360;

// Degree-radian conversion functions
export const deg2Rad = θ => θ*Math.PI/180;
export const rad2Deg = θ => θ*180/Math.PI;

// SVG XML namespace
export const SVG_NS = 'http://www.w3.org/2000/svg';

// Tilt of the earth's poles in degrees; used to draw the tropic and polar circles
export const EARTH_TILT = 23.43;

// Color channel max value
export const MAX_COLOR_VALUE = 255;

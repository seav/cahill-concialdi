![Cahill–Concialdi map preview](https://github.com/seav/cahill-concialdi/blob/master/docs/readme-header.png?raw=true)
# Cahill–Concialdi map projection
This [small web app](https://seav.github.io/cahill-concialdi/) is a JavaScript implementation of the Cahill–Concialdi Bat map projection and which generates the map as an embedded SVG image.

## About the map projection
The Cahill–Concialdi Bat map projection was created by Luca Concialdi in 2015 and is essentially a rearrangement of the [conformal variant](https://commons.wikimedia.org/wiki/File:Cahill_butterfly_conformal_projection_SW.jpg) of the butterfly map projection developed by [Bernard J. S. Cahill](https://en.wikipedia.org/wiki/Bernard_J._S._Cahill) in 1909. The rearrangement aimed to ensure that the northern hemisphere is uninterrupted with the only cut located at the Bering Strait, and puts New Zealand right next to Australia, which is not the case in almost all variants and adaptations of Cahill’s map projections, such as the [Cahill–Keyes](https://en.wikipedia.org/wiki/Cahill%E2%80%93Keyes_projection). If you want more background information about this new map projection, then read this [blog post](https://blog.map-projections.net/four-polyhedral-projections).

I came across this map projection in early 2020 and it instantly became my most favorite because it meets almost all of the qualities that I am looking for in a worldwide map projection: the map is conformal, mostly uninterrupted for landmasses (except for Antarctica), and is roughly equal-area for the landmasses (again except for Antarctica). While I really like the Cahill and [Waterman](https://en.wikipedia.org/wiki/Waterman_butterfly_projection) families of map projections and Buckminster Fuller’s [Dymaxion map](https://en.wikipedia.org/wiki/Dymaxion_map), the beauty of the Cahill–Concialdi is that it looks simpler (especially compared to the Dymaxion map) and has less “cuts” (compared to Cahill–Keyes). The only major problem is that Antarctica is mangled and too big, but I think this is an acceptable compromise because Antarctica is almost uninhabited.

## Math and code
The JavaScript source code for the core map projection was ported from the Java implementation of the conformal Cahill projection developed by Justin Kunimune for his [Map Projections](https://github.com/jkunimune15/Map-Projections/) software. I am actually very thankful to Justin for providing an open-source implementation of the map projection because I have no access to the conformal math developed by L.P. Lee in 1976 and the math itself is way over my head. Specifically, I ported and adapted the following Java methods:

| Justin’s Java method | Java source file | My Javascript function |
|---|---|---|
| `faceProject()` | [src/maps/Octohedral.java](https://github.com/jkunimune15/Map-Projections/blob/f1aac1f383cf902d6fe7ba8a7e586f860bb39f43/src/maps/Octohedral.java#L123-L139) | `projectInOctant()` |
| `polynomial()` | [src/maps/Octohedral.java](https://github.com/jkunimune15/Map-Projections/blob/f1aac1f383cf902d6fe7ba8a7e586f860bb39f43/src/maps/Octohedral.java#L162-L167) | `projectConformal()` |
| `obliquifySphc()` | [src/maps/Projection.java](https://github.com/jkunimune15/Map-Projections/blob/1d5a4d97b9e63ef614c133c9e028ba8e44702c10/src/maps/Projection.java#L400-L441) | `mapObliqueLatLon()` |

I also included the minified [Complex.js](https://github.com/infusion/Complex.js/) JavaScript library, to implement the complex math in Justin’s code.

As for the rest of the projection code, I reimplemented it by myself and it was very easy to do so once you understood how spherical coordinates are projected onto each octahedral face.

One significant change that I did from Luca’s original arrangement is that I used 168.5°W as my dividing line on the Bering Strait instead of Luca’s original 170°W which clips the tip of the Chukchi Peninsula on the easternmost part of Russia and the large St. Lawrence Island in Alaska. Unfortunately, there is no line of longitude passing through the Bering Strait that doesn’t cut any island, but using 168.5°W at least only cuts the minor Aleutian island of Umnak.

## Natural Earth data
To depict the landmasses, countries, and boundaries, I simply grabbed the [GeoJSON data](https://github.com/nvkelso/natural-earth-vector/tree/master/geojson) from [Natural Earth](http://naturalearthdata.com/), and simplified it by:
* rounding coordinates to 2 decimal places,
* stripping out the excess properties,
* coercing all country polygons into GeoJSON `MultiPolygon` (4D) arrays, and
* collapsing the GeoJSON structure to the minimum JSON structure that I needed.

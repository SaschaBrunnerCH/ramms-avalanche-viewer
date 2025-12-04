import ImageryTileLayer from '@arcgis/core/layers/ImageryTileLayer';
import * as rasterFunctionUtils from '@arcgis/core/layers/support/rasterFunctionUtils';
import type RasterFunction from '@arcgis/core/layers/support/RasterFunction';

// World Elevation Service URL
const ELEVATION_SERVICE_URL =
  'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer';

/**
 * Create a raster function for snow coverage visualization.
 * Shows snow white color for areas:
 * - Above a minimum elevation threshold
 * - With slope less than 55 degrees (snow doesn't stick on steeper terrain)
 *
 * @param minElevation Minimum elevation for snow coverage (default 2000m)
 */
export function getCustomRasterFunctionSnow(minElevation: number = 2000): RasterFunction {
  // Get slope in degrees
  const slopeFunction = rasterFunctionUtils.slope({
    slopeType: 'degree',
    zFactor: 1,
  });

  // Mask for slopes less than 55 degrees (snow can stick)
  // Remap: slopes 0-55 -> 1, slopes >55 -> NoData
  const slopeMask = rasterFunctionUtils.remap({
    rangeMaps: [{ range: [0, 55], output: 1 }],
    raster: slopeFunction,
  });

  // Mask for elevation above minimum threshold
  const elevationMask = rasterFunctionUtils.remap({
    rangeMaps: [{ range: [minElevation, 9000], output: 1 }],
  });

  // Combine slope and elevation masks (both must be 1)
  const combinedMask = rasterFunctionUtils.times({
    raster: slopeMask,
    raster2: elevationMask,
  });

  // Apply snow white color where mask is valid
  const snowColor = rasterFunctionUtils.colormap({
    colormap: [[1, 255, 255, 255]], // Snow white
    raster: combinedMask,
  });

  return snowColor;
}

/**
 * Create an ImageryTileLayer with snow cover visualization
 * Uses elevation and slope masks to show realistic snow coverage
 */
export function createSnowCoverLayer(minElevation: number = 0): ImageryTileLayer {
  const layer = new ImageryTileLayer({
    url: ELEVATION_SERVICE_URL,
    title: 'Snow Cover',
    opacity: 0.9,
    rasterFunction: getCustomRasterFunctionSnow(minElevation),
    blendMode: 'normal',
  });

  return layer;
}

/**
 * Create a raster function for visualizing slope angles.
 * Colors slopes by danger level:
 * - 22-27°: yellow
 * - 27-32°: orange
 * - 32-37°: red
 * - 37+°: purple
 */
export function getCustomRasterFunctionSlopes(): RasterFunction {
  // Compute slope
  const slope = rasterFunctionUtils.slope({
    slopeType: 'degree',
    zFactor: 1,
  });

  // Apply smooth-arithmetic-mean convolution to reduce noise
  const processedSlope = rasterFunctionUtils.convolution({
    convolutionType: 'smooth-arithmetic-mean',
    raster: slope,
  });

  // Remap slope values (degrees) to categorical ranges
  const remapSlope = rasterFunctionUtils.remap({
    rangeMaps: [
      { range: [22, 27], output: 30 },
      { range: [27, 32], output: 35 },
      { range: [32, 37], output: 40 },
      { range: [37, 90], output: 45 },
    ],
    raster: processedSlope,
  });

  // Map categorical ranges to RGB colors
  const colorMapSlope = rasterFunctionUtils.colormap({
    colormap: [
      [30, 242, 229, 10], // yellow
      [35, 244, 111, 36], // orange
      [40, 255, 5, 91], // red
      [45, 200, 137, 187], // purple
    ],
    raster: remapSlope,
  });

  return colorMapSlope;
}

/**
 * Create an ImageryTileLayer for slope visualization
 * Shows avalanche danger zones by slope angle
 */
export function createSlopesLayer(): ImageryTileLayer {
  return new ImageryTileLayer({
    url: ELEVATION_SERVICE_URL,
    title: 'Slopes',
    rasterFunction: getCustomRasterFunctionSlopes(),
    opacity: 0.3,
    visible: true,
  });
}
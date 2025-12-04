import ElevationLayer from '@arcgis/core/layers/ElevationLayer';
import Multipoint from '@arcgis/core/geometry/Multipoint';
import type { ExtentData, GridData } from '../config/types';
import { ELEVATION_SERVICE_URL } from '../config/constants';

/**
 * Service for querying ground elevations
 */
export class ElevationService {
  getSlopeLayer() {
    throw new Error("Method not implemented.");
  }
  private elevationLayer: ElevationLayer;
  private isLoaded = false;

  constructor() {
    this.elevationLayer = new ElevationLayer({
      url: ELEVATION_SERVICE_URL,
    });
  }

  /**
   * Load the elevation layer
   */
  async load(): Promise<void> {
    if (this.isLoaded) return;
    await this.elevationLayer.load();
    this.isLoaded = true;
  }

  /**
   * Get the underlying elevation layer for use in maps
   */
  getLayer(): ElevationLayer {
    return this.elevationLayer;
  }

  /**
   * Query ground elevations for a grid of points
   */
  async queryGridElevations(
    extent: ExtentData,
    resolution: number
  ): Promise<GridData> {
    await this.load();

    const xStep = (extent.xmax - extent.xmin) / (resolution - 1);
    const yStep = (extent.ymax - extent.ymin) / (resolution - 1);

    const points: [number, number][] = [];
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const px = extent.xmin + x * xStep;
        const py = extent.ymax - y * yStep;
        points.push([px, py]);
      }
    }

    const elevations = new Float64Array(points.length);

    try {
      const multipoint = new Multipoint({
        points: points,
        spatialReference: extent.spatialReference,
      });

      const elevResult = await this.elevationLayer.queryElevation(multipoint, {
        demResolution: 'finest-contiguous',
      });

      if (elevResult?.geometry && 'points' in elevResult.geometry) {
        const resultPoints = elevResult.geometry.points as number[][];
        resultPoints.forEach((p: number[], i: number) => {
          elevations[i] = p[2] || 0;
        });
      }
    } catch (error) {
      console.warn('Could not query elevation:', error);
      // Fill with zeros on error
      elevations.fill(0);
    }

    return {
      points,
      elevations,
      resolution,
    };
  }

  /**
   * Query elevation for a single point
   */
  async queryPointElevation(x: number, y: number, wkid: number): Promise<number> {
    await this.load();

    try {
      const multipoint = new Multipoint({
        points: [[x, y]],
        spatialReference: { wkid },
      });

      const elevResult = await this.elevationLayer.queryElevation(multipoint);

      if (elevResult?.geometry && 'points' in elevResult.geometry) {
        const resultPoints = elevResult.geometry.points as number[][];
        return resultPoints[0]?.[2] || 0;
      }
    } catch (error) {
      console.warn('Could not query elevation:', error);
    }

    return 0;
  }
}

// Singleton instance
let elevationServiceInstance: ElevationService | null = null;

/**
 * Get the singleton elevation service instance
 */
export function getElevationService(): ElevationService {
  if (!elevationServiceInstance) {
    elevationServiceInstance = new ElevationService();
  }
  return elevationServiceInstance;
}

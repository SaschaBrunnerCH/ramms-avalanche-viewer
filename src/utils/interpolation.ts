/**
 * Bilinear interpolation on a 2D grid
 * @param grid - 1D array representing 2D grid (row-major order)
 * @param srcRes - Source grid resolution (width = height)
 * @param x - Normalized x coordinate [0, 1]
 * @param y - Normalized y coordinate [0, 1]
 */
export function bilinearInterpolate(
  grid: ArrayLike<number>,
  srcRes: number,
  x: number,
  y: number
): number {
  const fx = x * (srcRes - 1);
  const fy = y * (srcRes - 1);

  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, srcRes - 1);
  const y1 = Math.min(y0 + 1, srcRes - 1);

  const tx = fx - x0;
  const ty = fy - y0;

  const v00 = grid[y0 * srcRes + x0];
  const v10 = grid[y0 * srcRes + x1];
  const v01 = grid[y1 * srcRes + x0];
  const v11 = grid[y1 * srcRes + x1];

  // Bilinear interpolation
  const v0 = v00 * (1 - tx) + v10 * tx;
  const v1 = v01 * (1 - tx) + v11 * tx;

  return v0 * (1 - ty) + v1 * ty;
}

/**
 * Apply Gaussian-like smoothing to flatten peaks
 * Uses 3x3 kernel with Gaussian weights
 * @param grid - Input grid data
 * @param res - Grid resolution
 * @param passes - Number of smoothing passes
 */
export function applyGaussianSmooth(
  grid: number[],
  res: number,
  passes: number
): number[] {
  let current = grid;

  for (let p = 0; p < passes; p++) {
    const smoothed = new Array<number>(res * res);

    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const idx = y * res + x;
        const centerVal = current[idx];

        // Skip zero values to preserve boundaries
        if (centerVal === 0) {
          smoothed[idx] = 0;
          continue;
        }

        // 3x3 Gaussian-weighted average
        let sum = 0;
        let weight = 0;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < res && ny >= 0 && ny < res) {
              const nIdx = ny * res + nx;
              const nVal = current[nIdx];

              // Gaussian weight: center=4, edges=2, corners=1
              const w = dx === 0 && dy === 0 ? 4 : (dx === 0 || dy === 0 ? 2 : 1);

              // Only include non-zero neighbors in smoothing
              if (nVal > 0) {
                sum += nVal * w;
                weight += w;
              }
            }
          }
        }

        smoothed[idx] = weight > 0 ? sum / weight : centerVal;
      }
    }

    current = smoothed;
  }

  return current;
}

/**
 * Upsample a grid using bilinear interpolation
 * @param srcGrid - Source grid data
 * @param srcRes - Source resolution
 * @param dstRes - Destination resolution
 * @param flattenPasses - Number of smoothing passes to apply
 */
export function upsampleGrid(
  srcGrid: number[] | Float32Array,
  srcRes: number,
  dstRes: number,
  flattenPasses: number
): number[] {
  const dstGrid = new Array<number>(dstRes * dstRes);

  for (let y = 0; y < dstRes; y++) {
    for (let x = 0; x < dstRes; x++) {
      const normX = x / (dstRes - 1);
      const normY = y / (dstRes - 1);
      dstGrid[y * dstRes + x] = bilinearInterpolate(srcGrid, srcRes, normX, normY);
    }
  }

  // Apply smoothing passes to reduce sharp peaks
  return applyGaussianSmooth(dstGrid, dstRes, flattenPasses);
}

/**
 * Generate smoothed grid points and elevations
 */
export function generateSmoothedGrid(
  basePoints: [number, number][],
  baseElevations: Float64Array | number[],
  baseRes: number,
  factor: number
): {
  points: [number, number][];
  elevations: Float64Array;
  resolution: number;
} {
  const smoothRes = (baseRes - 1) * factor + 1;

  const smoothPoints: [number, number][] = [];
  const smoothElevations = new Float64Array(smoothRes * smoothRes);

  // Get extent from base points
  const xMin = basePoints[0][0];
  const xMax = basePoints[baseRes - 1][0];
  const yMax = basePoints[0][1];
  const yMin = basePoints[(baseRes - 1) * baseRes][1];

  for (let y = 0; y < smoothRes; y++) {
    for (let x = 0; x < smoothRes; x++) {
      const normX = x / (smoothRes - 1);
      const normY = y / (smoothRes - 1);

      // Interpolate position
      const px = xMin + normX * (xMax - xMin);
      const py = yMax - normY * (yMax - yMin);
      smoothPoints.push([px, py]);

      // Interpolate elevation
      const elev = bilinearInterpolate(baseElevations, baseRes, normX, normY);
      smoothElevations[y * smoothRes + x] = elev;
    }
  }

  return {
    points: smoothPoints,
    elevations: smoothElevations,
    resolution: smoothRes,
  };
}

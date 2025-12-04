import Mesh from '@arcgis/core/geometry/Mesh';
import MeshComponent from '@arcgis/core/geometry/support/MeshComponent';
import MeshMaterialMetallicRoughness from '@arcgis/core/geometry/support/MeshMaterialMetallicRoughness';
import type { ExtentData, FlowHeightData, GridData, TerrainConfig } from '../config/types';
import { getColorFromHeight } from '../utils/colorUtils';
import { upsampleGrid } from '../utils/interpolation';
import { MESH_MATERIAL } from '../config/constants';

/**
 * Create a 3D mesh from flow height data
 */
export function createMesh(
  flowData: FlowHeightData,
  gridData: GridData,
  smoothedGridData: GridData | null,
  terrainConfig: TerrainConfig,
  smoothingFactor: number,
  flattenPasses: number
): Mesh | null {
  const baseRes = terrainConfig.gridResolution;

  if (flowData.nonZeroCount === 0) {
    return null;
  }

  // Determine which grid and resolution to use
  let gridPoints: [number, number][];
  let groundElevations: Float64Array | number[];
  let resolution: number;
  let smoothedFlowHeights: number[] | Float32Array;

  if (smoothingFactor > 1 && smoothedGridData) {
    resolution = (baseRes - 1) * smoothingFactor + 1;
    smoothedFlowHeights = upsampleGrid(
      Array.from(flowData.flowHeights),
      baseRes,
      resolution,
      flattenPasses
    );
    gridPoints = smoothedGridData.points;
    groundElevations = smoothedGridData.elevations;
  } else {
    resolution = baseRes;
    smoothedFlowHeights = flowData.flowHeights;
    gridPoints = gridData.points;
    groundElevations = gridData.elevations;
  }

  // Build vertex positions and colors
  const positions: number[] = [];
  const colors: number[] = [];

  for (let i = 0; i < gridPoints.length; i++) {
    const [px, py] = gridPoints[i];
    const groundElev = groundElevations[i];
    const flowHeight = smoothedFlowHeights[i];

    const flowOffset = flowHeight * terrainConfig.exaggerationFactor;
    const totalZ = groundElev + flowOffset + 1;

    positions.push(px, py, totalZ);

    const color = getColorFromHeight(flowHeight);
    colors.push(color[0], color[1], color[2], color[3]);
  }

  // Generate triangles (only where at least one vertex has flow > 0)
  const flatPositions: number[] = [];
  const flatColors: number[] = [];
  const flatFaces: number[] = [];

  for (let y = 0; y < resolution - 1; y++) {
    for (let x = 0; x < resolution - 1; x++) {
      const i = y * resolution + x;
      const i1 = i;
      const i2 = i + 1;
      const i3 = i + resolution;
      const i4 = i + resolution + 1;

      const f1 = smoothedFlowHeights[i1];
      const f2 = smoothedFlowHeights[i2];
      const f3 = smoothedFlowHeights[i3];
      const f4 = smoothedFlowHeights[i4];

      // Triangle 1: i1, i2, i3
      if (f1 > 0 || f2 > 0 || f3 > 0) {
        const baseIdx = flatPositions.length / 3;

        // Average color for the triangle
        const avgColor = [
          Math.round((colors[i1 * 4] + colors[i2 * 4] + colors[i3 * 4]) / 3),
          Math.round((colors[i1 * 4 + 1] + colors[i2 * 4 + 1] + colors[i3 * 4 + 1]) / 3),
          Math.round((colors[i1 * 4 + 2] + colors[i2 * 4 + 2] + colors[i3 * 4 + 2]) / 3),
          Math.round((colors[i1 * 4 + 3] + colors[i2 * 4 + 3] + colors[i3 * 4 + 3]) / 3),
        ];

        flatPositions.push(
          positions[i1 * 3], positions[i1 * 3 + 1], positions[i1 * 3 + 2],
          positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2],
          positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]
        );
        flatColors.push(
          avgColor[0], avgColor[1], avgColor[2], avgColor[3],
          avgColor[0], avgColor[1], avgColor[2], avgColor[3],
          avgColor[0], avgColor[1], avgColor[2], avgColor[3]
        );
        flatFaces.push(baseIdx, baseIdx + 1, baseIdx + 2);
      }

      // Triangle 2: i2, i4, i3
      if (f2 > 0 || f4 > 0 || f3 > 0) {
        const baseIdx = flatPositions.length / 3;

        const avgColor = [
          Math.round((colors[i2 * 4] + colors[i4 * 4] + colors[i3 * 4]) / 3),
          Math.round((colors[i2 * 4 + 1] + colors[i4 * 4 + 1] + colors[i3 * 4 + 1]) / 3),
          Math.round((colors[i2 * 4 + 2] + colors[i4 * 4 + 2] + colors[i3 * 4 + 2]) / 3),
          Math.round((colors[i2 * 4 + 3] + colors[i4 * 4 + 3] + colors[i3 * 4 + 3]) / 3),
        ];

        flatPositions.push(
          positions[i2 * 3], positions[i2 * 3 + 1], positions[i2 * 3 + 2],
          positions[i4 * 3], positions[i4 * 3 + 1], positions[i4 * 3 + 2],
          positions[i3 * 3], positions[i3 * 3 + 1], positions[i3 * 3 + 2]
        );
        flatColors.push(
          avgColor[0], avgColor[1], avgColor[2], avgColor[3],
          avgColor[0], avgColor[1], avgColor[2], avgColor[3],
          avgColor[0], avgColor[1], avgColor[2], avgColor[3]
        );
        flatFaces.push(baseIdx, baseIdx + 1, baseIdx + 2);
      }
    }
  }

  if (flatPositions.length === 0) {
    return null;
  }

  const meshComponent = new MeshComponent({
    faces: flatFaces,
    shading: 'flat',
    material: new MeshMaterialMetallicRoughness({
      metallic: MESH_MATERIAL.metallic,
      roughness: MESH_MATERIAL.roughness,
    }),
  });

  const mesh = new Mesh({
    vertexAttributes: {
      position: new Float64Array(flatPositions),
      color: new Uint8Array(flatColors),
    },
    components: [meshComponent],
    spatialReference: { wkid: flowData.extent.spatialReference.wkid },
  });

  return mesh;
}

/**
 * Generate grid points and elevations from extent
 */
export function generateGridPoints(
  extent: ExtentData,
  resolution: number
): { points: [number, number][] } {
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

  return { points };
}

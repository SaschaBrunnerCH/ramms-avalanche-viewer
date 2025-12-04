import { fromArrayBuffer } from 'geotiff';
import type { AvalancheConfig, ExtentData, FlowHeightData } from '../config/types';
import { WEB_MERCATOR_WKID, DATA_FOLDER } from '../config/constants';

/**
 * Generate TIFF URL for a given avalanche config and time
 */
export function getTiffUrl(config: AvalancheConfig, time: number): string {
  return `${DATA_FOLDER}/${config.folder}/${config.prefix}${time.toFixed(2)}${config.suffix}`;
}

/**
 * Generate array of time steps from avalanche config
 */
export function generateTimeSteps(config: AvalancheConfig): number[] {
  const [start, end] = config.timeRange;
  const interval = config.timeInterval;
  const steps: number[] = [];

  for (let t = start; t <= end; t += interval) {
    steps.push(t);
  }

  return steps;
}

/**
 * Load and parse a TIFF file, returning flow height data
 */
export async function loadTiffFrame(
  url: string,
  gridResolution: number
): Promise<FlowHeightData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();

  const width = image.getWidth();
  const height = image.getHeight();
  const rasters = await image.readRasters();
  const pixels = rasters[0] as Float32Array | Float64Array | Uint8Array;

  const bbox = image.getBoundingBox();

  const extent: ExtentData = {
    xmin: bbox[0],
    ymin: bbox[1],
    xmax: bbox[2],
    ymax: bbox[3],
    spatialReference: { wkid: WEB_MERCATOR_WKID },
  };

  // Convert to flow heights grid (resample to target resolution)
  const flowHeights = new Float32Array(gridResolution * gridResolution);
  let maxHeight = 0;
  let nonZeroCount = 0;

  for (let y = 0; y < gridResolution; y++) {
    for (let x = 0; x < gridResolution; x++) {
      const normX = x / (gridResolution - 1);
      const normY = y / (gridResolution - 1);

      const px = Math.floor(normX * (width - 1));
      const py = Math.floor(normY * (height - 1));
      const idx = py * width + px;

      const value = pixels[idx];
      const flowHeight = value > 0 && !isNaN(value) ? value : 0;
      flowHeights[y * gridResolution + x] = flowHeight;

      if (flowHeight > 0) {
        nonZeroCount++;
        if (flowHeight > maxHeight) {
          maxHeight = flowHeight;
        }
      }
    }
  }

  return {
    flowHeights,
    extent,
    width: gridResolution,
    height: gridResolution,
    maxHeight,
    nonZeroCount,
  };
}

/**
 * Preload all frames for an avalanche simulation
 * Returns a Map of time -> FlowHeightData
 */
export async function preloadAllFrames(
  config: AvalancheConfig,
  gridResolution: number,
  onProgress?: (loaded: number, total: number) => void
): Promise<Map<number, FlowHeightData>> {
  const timeSteps = generateTimeSteps(config);
  const frameCache = new Map<number, FlowHeightData>();
  let loadedCount = 0;

  for (const time of timeSteps) {
    try {
      const url = getTiffUrl(config, time);
      const data = await loadTiffFrame(url, gridResolution);
      frameCache.set(time, data);
    } catch (error) {
      console.error(`Failed to load frame ${time}s:`, error);
    }

    loadedCount++;
    onProgress?.(loadedCount, timeSteps.length);
  }

  console.log(`Loaded ${frameCache.size}/${timeSteps.length} frames for ${config.name}`);
  return frameCache;
}

/**
 * Get the extent from the first frame of an avalanche simulation
 */
export async function getAvalancheExtent(
  config: AvalancheConfig,
  gridResolution: number
): Promise<ExtentData | null> {
  try {
    const firstTime = config.timeRange[0];
    const url = getTiffUrl(config, firstTime);
    const data = await loadTiffFrame(url, gridResolution);
    return data.extent;
  } catch (error) {
    console.error(`Failed to get extent for ${config.name}:`, error);
    return null;
  }
}

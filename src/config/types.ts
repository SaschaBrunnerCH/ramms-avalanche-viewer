import type Extent from '@arcgis/core/geometry/Extent';
import type SceneView from '@arcgis/core/views/SceneView';
import type Graphic from '@arcgis/core/Graphic';

/**
 * RGBA color as array [r, g, b, a] where values are 0-255
 */
export type RGBAColor = [number, number, number, number];

/**
 * Color stop for gradient interpolation
 */
export interface ColorStop {
  value: number;
  color: RGBAColor;
}

/**
 * Terrain visualization configuration
 */
export interface TerrainConfig {
  exaggerationFactor: number;
  gridResolution: number;
}

/**
 * Avalanche simulation configuration from JSON
 */
export interface AvalancheConfig {
  id: string;
  name: string;
  folder: string;
  prefix: string;
  suffix: string;
  timeInterval: number;
  timeRange: [number, number];
  description?: string;
}

/**
 * Application configuration loaded from avalanches.json
 */
export interface AppConfig {
  avalanches: AvalancheConfig[];
  defaults?: {
    gridResolution?: number;
    exaggerationFactor?: number;
    smoothingFactor?: number;
    flattenPasses?: number;
  };
}

/**
 * Extent data for spatial reference
 */
export interface ExtentData {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  spatialReference: { wkid: number };
}

/**
 * Parsed flow height data from TIFF
 */
export interface FlowHeightData {
  flowHeights: Float32Array;
  extent: ExtentData;
  width: number;
  height: number;
  maxHeight: number;
  nonZeroCount: number;
}

/**
 * Grid data for mesh generation
 */
export interface GridData {
  points: [number, number][];
  elevations: Float64Array;
  resolution: number;
}

/**
 * Animation state for a simulation
 */
export interface AnimationState {
  currentFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  smoothingFactor: number;
  flattenPasses: number;
}

/**
 * Playback options for animation control
 */
export interface PlaybackOptions {
  speed: number;
  loop: boolean;
}

/**
 * Animation event types
 */
export type AnimationEventType =
  | 'frameChange'
  | 'playStateChange'
  | 'loadProgress'
  | 'ready'
  | 'error';

/**
 * Animation event payload
 */
export interface AnimationEvent {
  type: AnimationEventType;
  frameIndex?: number;
  totalFrames?: number;
  isPlaying?: boolean;
  progress?: number;
  total?: number;
  error?: Error;
  time?: number;
}

/**
 * Animation event handler function
 */
export type AnimationEventHandler = (event: AnimationEvent) => void;

/**
 * Simulation context for rendering
 */
export interface SimulationContext {
  view: SceneView;
  meshGraphic: Graphic | null;
  extent: Extent | null;
}

/**
 * Frame cache entry
 */
export interface FrameCacheEntry {
  data: FlowHeightData;
  timestamp: number;
}

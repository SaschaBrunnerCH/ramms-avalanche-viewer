import type { ColorStop, TerrainConfig } from './types';

/**
 * Color stops for flow height visualization (matching prototype colors)
 */
export const COLOR_STOPS: ColorStop[] = [
  { value: 0.01, color: [74, 144, 194, 220] },   // Blue-gray
  { value: 0.2, color: [139, 196, 234, 230] },   // Light blue
  { value: 0.5, color: [180, 220, 180, 240] },   // Light green
  { value: 0.8, color: [240, 230, 140, 245] },   // Light yellow
  { value: 1.0, color: [255, 165, 80, 250] },    // Orange
  { value: 1.5, color: [255, 107, 107, 255] },   // Light red
  { value: 2.0, color: [200, 50, 50, 255] },     // Dark red - high flow
];

/**
 * Default terrain visualization configuration
 */
export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  exaggerationFactor: 20,
  gridResolution: 100
};

/**
 * Default animation settings
 */
export const DEFAULT_ANIMATION = {
  playbackSpeed: 1000,    // ms per frame
  smoothingFactor: 2,
  flattenPasses: 5,
  loop: true
};

/**
 * Playback speed options (label -> milliseconds)
 */
export const PLAYBACK_SPEEDS: Record<string, number> = {
  '4x': 250,
  '2x': 500,
  '1x': 1000,
  '0.5x': 2000
};

/**
 * Grid resolution options
 */
export const GRID_RESOLUTIONS = [50, 100, 150, 200];

/**
 * Flatten pass options
 */
export const FLATTEN_PASS_OPTIONS = [0, 1, 2, 3, 5, 10];

/**
 * Smoothing factor options
 */
export const SMOOTHING_FACTOR_OPTIONS = [1, 2, 3, 4];

/**
 * ESRI World Elevation service URL
 */
export const ELEVATION_SERVICE_URL =
  'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer';

/**
 * Spatial reference WKID for Web Mercator
 */
export const WEB_MERCATOR_WKID = 3857;

/**
 * Data folder path (uses Vite's base URL for correct deployment path)
 */
export const DATA_FOLDER = `${import.meta.env.BASE_URL}data`;

/**
 * Avalanche config file path
 */
export const AVALANCHE_CONFIG_PATH = `${import.meta.env.BASE_URL}data/avalanches.json`;

/**
 * Mesh material properties
 */
export const MESH_MATERIAL = {
  metallic: 0.2,
  roughness: 0.7
};

/**
 * Camera animation duration in milliseconds
 */
export const CAMERA_ANIMATION_DURATION = 2000;

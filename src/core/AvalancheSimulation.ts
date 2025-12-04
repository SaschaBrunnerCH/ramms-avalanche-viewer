import Graphic from '@arcgis/core/Graphic';
import Extent from '@arcgis/core/geometry/Extent';
import type SceneView from '@arcgis/core/views/SceneView';
import type {
  AvalancheConfig,
  AnimationState,
  AnimationEvent,
  AnimationEventHandler,
  FlowHeightData,
  GridData,
  ExtentData,
} from '../config/types';
import { DEFAULT_ANIMATION, DEFAULT_TERRAIN_CONFIG } from '../config/constants';
import { preloadAllFrames, generateTimeSteps } from './TiffLoader';
import { createMesh } from './MeshGenerator';
import { getElevationService } from './ElevationService';
import { generateSmoothedGrid } from '../utils/interpolation';

/**
 * Manages a single avalanche simulation animation
 */
export class AvalancheSimulation {
  private config: AvalancheConfig;
  private view: SceneView | null = null;

  // Animation state
  private state: AnimationState;
  private animationInterval: ReturnType<typeof setInterval> | null = null;
  private timeSteps: number[] = [];

  // Cached data
  private frameCache: Map<number, FlowHeightData> = new Map();
  private meshCache: Map<number, Graphic> = new Map();
  private meshExtent: ExtentData | null = null;
  private baseGridData: GridData | null = null;
  private smoothedGridData: GridData | null = null;
  private currentFrameTime: number | null = null;

  // Event handlers
  private eventHandlers: Map<string, AnimationEventHandler[]> = new Map();

  constructor(config: AvalancheConfig) {
    this.config = config;
    this.timeSteps = generateTimeSteps(config);
    this.state = {
      currentFrameIndex: 0,
      isPlaying: false,
      playbackSpeed: DEFAULT_ANIMATION.playbackSpeed,
      smoothingFactor: DEFAULT_ANIMATION.smoothingFactor,
      flattenPasses: DEFAULT_ANIMATION.flattenPasses,
    };
  }

  /**
   * Initialize the simulation with a SceneView
   */
  async initialize(view: SceneView, onProgress?: (loaded: number, total: number) => void): Promise<void> {
    this.view = view;

    // Preload all frames
    this.frameCache = await preloadAllFrames(
      this.config,
      DEFAULT_TERRAIN_CONFIG.gridResolution,
      onProgress
    );

    if (this.frameCache.size === 0) {
      throw new Error(`No frames loaded for ${this.config.name}`);
    }

    // Get extent from first frame
    const firstFrame = this.frameCache.values().next().value;
    if (firstFrame) {
      this.meshExtent = firstFrame.extent;
    }

    if (!this.meshExtent) {
      throw new Error(`Could not determine extent for ${this.config.name}`);
    }

    // Query ground elevations
    const elevationService = getElevationService();
    this.baseGridData = await elevationService.queryGridElevations(
      this.meshExtent,
      DEFAULT_TERRAIN_CONFIG.gridResolution
    );

    // Generate smoothed grid
    this.updateSmoothedGrid();

    // Pre-build all mesh graphics
    this.rebuildMeshCache();

    this.emit({ type: 'ready' });
  }

  /**
   * Build mesh graphics for all frames
   */
  private rebuildMeshCache(): void {
    if (!this.view || !this.baseGridData || !this.meshExtent) return;

    // Remove existing meshes from view
    this.meshCache.forEach((graphic) => {
      this.view!.graphics.remove(graphic);
    });
    this.meshCache.clear();

    // Build a mesh for each frame
    for (const time of this.timeSteps) {
      const flowData = this.frameCache.get(time);
      if (!flowData) continue;

      const mesh = createMesh(
        flowData,
        this.baseGridData,
        this.smoothedGridData,
        DEFAULT_TERRAIN_CONFIG,
        this.state.smoothingFactor,
        this.state.flattenPasses
      );

      if (mesh) {
        const graphic = new Graphic({
          geometry: mesh,
          symbol: {
            type: 'mesh-3d',
            symbolLayers: [
              {
                type: 'fill',
                material: {
                  color: [255, 255, 255, 255],
                  colorMixMode: 'multiply',
                },
                edges: null,
              },
            ],
          } as unknown as __esri.MeshSymbol3D,
          visible: false,
        });

        (graphic as unknown as { elevationInfo: { mode: string } }).elevationInfo = {
          mode: 'absolute-height',
        };

        this.meshCache.set(time, graphic);
        this.view.graphics.add(graphic);
      }
    }
  }

  /**
   * Get the simulation extent
   */
  getExtent(): Extent | null {
    if (!this.meshExtent) return null;
    return new Extent(this.meshExtent);
  }

  /**
   * Get current animation state
   */
  getState(): Readonly<AnimationState> {
    return { ...this.state };
  }

  /**
   * Get the avalanche configuration
   */
  getConfig(): AvalancheConfig {
    return this.config;
  }

  /**
   * Get current time in seconds
   */
  getCurrentTime(): number {
    return this.timeSteps[this.state.currentFrameIndex] ?? 0;
  }

  /**
   * Get total number of frames
   */
  getTotalFrames(): number {
    return this.timeSteps.length;
  }

  /**
   * Display a specific frame by index
   */
  displayFrame(frameIndex: number): void {
    if (!this.view) return;

    const time = this.timeSteps[frameIndex];
    if (time === undefined) return;

    // Hide previous frame
    if (this.currentFrameTime !== null) {
      const prevGraphic = this.meshCache.get(this.currentFrameTime);
      if (prevGraphic) {
        prevGraphic.visible = false;
      }
    }

    // Show new frame
    const graphic = this.meshCache.get(time);
    if (graphic) {
      graphic.visible = true;
    }

    this.currentFrameTime = time;
    this.state.currentFrameIndex = frameIndex;
    this.emit({
      type: 'frameChange',
      frameIndex,
      totalFrames: this.timeSteps.length,
      time,
    });
  }

  /**
   * Start animation playback
   */
  play(): void {
    if (this.state.isPlaying) return;

    this.state.isPlaying = true;
    this.emit({ type: 'playStateChange', isPlaying: true });

    this.animationInterval = setInterval(() => {
      let nextIndex = this.state.currentFrameIndex + 1;
      if (nextIndex >= this.timeSteps.length) {
        nextIndex = 0;
      }
      this.displayFrame(nextIndex);
    }, this.state.playbackSpeed);
  }

  /**
   * Pause animation playback
   */
  pause(): void {
    this.state.isPlaying = false;
    this.emit({ type: 'playStateChange', isPlaying: false });

    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }
  }

  /**
   * Toggle play/pause
   */
  togglePlay(): void {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  /**
   * Reset animation to first frame
   */
  reset(): void {
    this.pause();
    this.displayFrame(0);
  }

  /**
   * Set playback speed
   */
  setSpeed(speed: number): void {
    this.state.playbackSpeed = speed;
    if (this.state.isPlaying) {
      this.pause();
      this.play();
    }
  }

  /**
   * Set smoothing factor
   */
  setSmoothing(factor: number): void {
    this.state.smoothingFactor = factor;
    this.updateSmoothedGrid();
    this.rebuildMeshCache();
    this.displayFrame(this.state.currentFrameIndex);
  }

  /**
   * Set flatten passes
   */
  setFlattenPasses(passes: number): void {
    this.state.flattenPasses = passes;
    this.rebuildMeshCache();
    this.displayFrame(this.state.currentFrameIndex);
  }

  /**
   * Seek to a specific time
   */
  seekToTime(time: number): void {
    const frameIndex = this.timeSteps.findIndex((t) => t >= time);
    if (frameIndex !== -1) {
      this.displayFrame(frameIndex);
    }
  }

  /**
   * Update smoothed grid when smoothing factor changes
   */
  private updateSmoothedGrid(): void {
    if (!this.baseGridData) return;

    if (this.state.smoothingFactor > 1) {
      const result = generateSmoothedGrid(
        this.baseGridData.points,
        this.baseGridData.elevations,
        DEFAULT_TERRAIN_CONFIG.gridResolution,
        this.state.smoothingFactor
      );
      this.smoothedGridData = result;
    } else {
      this.smoothedGridData = null;
    }
  }

  /**
   * Subscribe to events
   */
  on(eventType: string, handler: AnimationEventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  /**
   * Unsubscribe from events
   */
  off(eventType: string, handler: AnimationEventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Emit an event
   */
  private emit(event: AnimationEvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];
    handlers.forEach((handler) => handler(event));
  }

  /**
   * Hide all mesh graphics
   */
  hide(): void {
    this.meshCache.forEach((graphic) => {
      graphic.visible = false;
    });
  }

  /**
   * Show the current frame mesh graphic
   */
  show(): void {
    if (this.currentFrameTime !== null) {
      const graphic = this.meshCache.get(this.currentFrameTime);
      if (graphic) {
        graphic.visible = true;
      }
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.pause();

    // Remove all cached meshes from view
    if (this.view) {
      this.meshCache.forEach((graphic) => {
        this.view!.graphics.remove(graphic);
      });
    }

    this.frameCache.clear();
    this.meshCache.clear();
    this.eventHandlers.clear();
    this.view = null;
    this.currentFrameTime = null;
    this.baseGridData = null;
    this.smoothedGridData = null;
    this.meshExtent = null;
  }
}

import type SceneView from '@arcgis/core/views/SceneView';
import Extent from '@arcgis/core/geometry/Extent';
import { AvalancheSimulation } from './AvalancheSimulation';
import type { AvalancheConfig } from '../config/types';
import { CAMERA_ANIMATION_DURATION } from '../config/constants';

export interface AvalanchesData {
  avalanches: AvalancheConfig[];
  defaults?: {
    gridResolution?: number;
    exaggerationFactor?: number;
    smoothingFactor?: number;
    flattenPasses?: number;
  };
}

export type SimulationEventType = 'avalancheChange' | 'loadProgress' | 'ready';

export interface SimulationEvent {
  type: SimulationEventType;
  avalancheId?: string;
  loaded?: number;
  total?: number;
}

export type SimulationEventHandler = (event: SimulationEvent) => void;

/**
 * Manages multiple avalanche simulations
 */
export class SimulationManager {
  private view: SceneView | null = null;
  private simulations: Map<string, AvalancheSimulation> = new Map();
  private configs: AvalancheConfig[] = [];
  private activeSimulationId: string | null = null;
  private eventHandlers: Map<string, SimulationEventHandler[]> = new Map();
  private playAllMode: boolean = false;

  /**
   * Load avalanche configurations from JSON
   */
  async loadConfigs(url: string = `${import.meta.env.BASE_URL}data/avalanches.json`): Promise<AvalancheConfig[]> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load avalanche configs: ${response.statusText}`);
    }
    const data: AvalanchesData = await response.json();
    this.configs = data.avalanches;
    return this.configs;
  }

  /**
   * Get all avalanche configurations
   */
  getConfigs(): AvalancheConfig[] {
    return this.configs;
  }

  /**
   * Initialize manager with a SceneView
   */
  setView(view: SceneView): void {
    this.view = view;
  }

  /**
   * Load and initialize a specific avalanche simulation
   */
  async loadSimulation(
    configOrId: AvalancheConfig | string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<AvalancheSimulation> {
    if (!this.view) {
      throw new Error('View not set. Call setView() first.');
    }

    const config = typeof configOrId === 'string'
      ? this.configs.find(c => c.id === configOrId)
      : configOrId;

    if (!config) {
      throw new Error(`Avalanche config not found: ${configOrId}`);
    }

    // Check if already loaded
    let simulation = this.simulations.get(config.id);
    if (simulation) {
      return simulation;
    }

    // Create and initialize new simulation
    simulation = new AvalancheSimulation(config);
    await simulation.initialize(this.view, onProgress);
    this.simulations.set(config.id, simulation);

    return simulation;
  }

  /**
   * Switch to a different avalanche
   */
  async switchToAvalanche(
    id: string,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    if (!this.view) {
      throw new Error('View not set');
    }

    // Pause and hide current simulation
    const currentSim = this.getActiveSimulation();
    if (currentSim) {
      currentSim.pause();
      currentSim.hide();
    }

    // Load the new simulation if needed
    const simulation = await this.loadSimulation(id, onProgress);

    // Show and display first frame
    simulation.show();
    simulation.displayFrame(0);

    // Update active simulation
    this.activeSimulationId = id;

    // Zoom to extent
    const extent = simulation.getExtent();
    if (extent) {
      await this.zoomToExtent(extent);
    }

    this.emit({ type: 'avalancheChange', avalancheId: id });
  }

  /**
   * Get the currently active simulation
   */
  getActiveSimulation(): AvalancheSimulation | null {
    if (!this.activeSimulationId) return null;
    return this.simulations.get(this.activeSimulationId) || null;
  }

  /**
   * Get active avalanche config
   */
  getActiveConfig(): AvalancheConfig | null {
    if (!this.activeSimulationId) return null;
    return this.configs.find(c => c.id === this.activeSimulationId) || null;
  }

  /**
   * Zoom to an extent with animation
   */
  private async zoomToExtent(extent: Extent): Promise<void> {
    if (!this.view) return;

    await this.view.goTo(
      {
        target: extent.expand(1.3),
        heading: 320,
        tilt: 65,
      },
      {
        duration: CAMERA_ANIMATION_DURATION,
        easing: 'out-expo',
      }
    );
  }

  /**
   * Subscribe to events
   */
  on(eventType: SimulationEventType, handler: SimulationEventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  /**
   * Emit an event
   */
  private emit(event: SimulationEvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];
    handlers.forEach(handler => handler(event));
  }

  /**
   * Load all simulations
   */
  async loadAllSimulations(
    onProgress?: (loaded: number, total: number) => void
  ): Promise<void> {
    if (!this.view) {
      throw new Error('View not set');
    }

    const total = this.configs.length;
    let loaded = 0;

    for (const config of this.configs) {
      await this.loadSimulation(config.id);
      loaded++;
      onProgress?.(loaded, total);
    }
  }

  /**
   * Get combined extent of all loaded simulations
   */
  getCombinedExtent(): Extent | null {
    let combinedExtent: Extent | null = null;

    this.simulations.forEach((sim) => {
      const extent = sim.getExtent();
      if (extent) {
        if (combinedExtent) {
          combinedExtent = combinedExtent.union(extent);
        } else {
          combinedExtent = extent.clone();
        }
      }
    });

    return combinedExtent;
  }

  /**
   * Play all simulations simultaneously
   */
  async playAll(): Promise<void> {
    if (!this.view) {
      throw new Error('View not set');
    }

    this.playAllMode = true;

    // Show all simulations and reset to frame 0
    this.simulations.forEach((sim) => {
      sim.displayFrame(0);
      sim.show();
    });

    // Zoom to combined extent
    const combinedExtent = this.getCombinedExtent();
    if (combinedExtent) {
      await this.zoomToExtent(combinedExtent);
    }

    // Start all simulations
    this.simulations.forEach((sim) => {
      sim.play();
    });
  }

  /**
   * Stop all simulations and exit play all mode
   */
  stopAll(): void {
    this.playAllMode = false;

    this.simulations.forEach((sim) => {
      sim.pause();
      sim.hide();
    });

    // Show only the active simulation if there is one
    const activeSim = this.getActiveSimulation();
    if (activeSim) {
      activeSim.show();
    }
  }

  /**
   * Check if in play all mode
   */
  isPlayAllMode(): boolean {
    return this.playAllMode;
  }

  /**
   * Toggle play/pause for all simulations in play all mode
   */
  togglePlayAll(): void {
    if (!this.playAllMode) return;

    // Check if any simulation is playing
    let anyPlaying = false;
    this.simulations.forEach((sim) => {
      if (sim.isCurrentlyPlaying()) {
        anyPlaying = true;
      }
    });

    // Toggle all simulations
    this.simulations.forEach((sim) => {
      if (anyPlaying) {
        sim.pause();
      } else {
        sim.play();
      }
    });
  }

  /**
   * Pause all simulations
   */
  pauseAll(): void {
    this.simulations.forEach((sim) => {
      sim.pause();
    });
  }

  /**
   * Reset all simulations to frame 0
   */
  resetAll(): void {
    this.simulations.forEach((sim) => {
      sim.reset();
    });
  }

  /**
   * Set playback speed for all simulations
   */
  setSpeedAll(speed: number): void {
    this.simulations.forEach((sim) => {
      sim.setSpeed(speed);
    });
  }

  /**
   * Set smoothing factor for all simulations
   */
  setSmoothingAll(factor: number): void {
    this.simulations.forEach((sim) => {
      sim.setSmoothing(factor);
    });
  }

  /**
   * Set flatten passes for all simulations
   */
  setFlattenPassesAll(passes: number): void {
    this.simulations.forEach((sim) => {
      sim.setFlattenPasses(passes);
    });
  }

  /**
   * Set exaggeration factor for all simulations
   */
  setExaggerationAll(factor: number): void {
    this.simulations.forEach((sim) => {
      sim.setExaggeration(factor);
    });
  }

  /**
   * Seek all simulations to a specific time
   * Simulations that don't have frames at that time stay at their last frame
   */
  seekAllToTime(time: number): void {
    this.simulations.forEach((sim) => {
      sim.seekToTime(time);
    });
  }

  /**
   * Get the maximum time range across all simulations
   */
  getMaxTimeRange(): [number, number] {
    let minTime = Infinity;
    let maxTime = 0;

    this.configs.forEach((config) => {
      const [start, end] = config.timeRange;
      if (start < minTime) minTime = start;
      if (end > maxTime) maxTime = end;
    });

    return [minTime === Infinity ? 0 : minTime, maxTime];
  }

  /**
   * Get the minimum time interval across all simulations
   */
  getMinTimeInterval(): number {
    let minInterval = Infinity;

    this.configs.forEach((config) => {
      if (config.timeInterval < minInterval) {
        minInterval = config.timeInterval;
      }
    });

    return minInterval === Infinity ? 1 : minInterval;
  }

  /**
   * Check if any simulation is currently playing
   */
  isAnyPlaying(): boolean {
    let anyPlaying = false;
    this.simulations.forEach((sim) => {
      if (sim.isCurrentlyPlaying()) {
        anyPlaying = true;
      }
    });
    return anyPlaying;
  }

  /**
   * Get all loaded simulations
   */
  getAllSimulations(): AvalancheSimulation[] {
    return Array.from(this.simulations.values());
  }

  /**
   * Dispose all simulations
   */
  dispose(): void {
    this.simulations.forEach(sim => sim.dispose());
    this.simulations.clear();
    this.activeSimulationId = null;
    this.eventHandlers.clear();
    this.playAllMode = false;
  }
}

// Singleton instance
let manager: SimulationManager | null = null;

export function getSimulationManager(): SimulationManager {
  if (!manager) {
    manager = new SimulationManager();
  }
  return manager;
}

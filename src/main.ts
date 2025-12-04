// Calcite Components
import { setAssetPath } from "@esri/calcite-components";
import { defineCustomElements } from "@esri/calcite-components/dist/loader";
import "@esri/calcite-components/dist/calcite/calcite.css";

// Set Calcite assets path to CDN and define custom elements
setAssetPath("https://js.arcgis.com/calcite-components/3.0.3/assets");
defineCustomElements(window);

// ArcGIS Map Components
import "@arcgis/map-components/dist/components/arcgis-scene";

// ArcGIS Core
import "@arcgis/core/assets/esri/themes/light/main.css";
import type SceneView from "@arcgis/core/views/SceneView";
import Graphic from "@arcgis/core/Graphic";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import Polygon from "@arcgis/core/geometry/Polygon";
import { geodesicArea } from "@arcgis/core/geometry/geometryEngine";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";

// Type for the arcgis-scene element
interface ArcgisSceneElement extends HTMLElement {
  view: SceneView | null;
}

// App modules
import { getSimulationManager } from "./core/SimulationManager";
import { getElevationService } from "./core/ElevationService";
import { createSnowCoverLayer, createSlopesLayer } from "./core/SnowCoverLayer";
import type { AvalancheConfig } from "./config/types";

// Styles
import "./styles/main.css";

// UI Elements
let playBtn: HTMLCalciteButtonElement | null;
let resetBtn: HTMLCalciteButtonElement | null;
let timeSlider: HTMLCalciteSliderElement | null;
let speedSelect: HTMLCalciteSelectElement | null;
let smoothingSelect: HTMLCalciteSelectElement | null;
let flattenSelect: HTMLCalciteSelectElement | null;
let exaggerationSelect: HTMLCalciteSelectElement | null;
let currentTimeSpan: HTMLElement | null;
let statusEl: HTMLElement | null;
let progressBar: HTMLCalciteProgressElement | null;
let progressText: HTMLElement | null;
let loadingProgress: HTMLElement | null;
let loadingOverlay: HTMLElement | null;
let avalancheList: HTMLCalciteListElement | null;
let avalancheNameEl: HTMLElement | null;
let avalancheDescEl: HTMLElement | null;
let releaseDepthEl: HTMLElement | null;
let releaseAreaEl: HTMLElement | null;
let demSourceEl: HTMLElement | null;
let demResolutionEl: HTMLElement | null;

// Application state
const manager = getSimulationManager();
let releaseZoneLayer: GraphicsLayer | null = null;
let snowCoverLayer: __esri.Layer | null = null;
let slopesLayer: __esri.Layer | null = null;

// Opacity slider elements
let snowCoverOpacitySlider: HTMLCalciteSliderElement | null;
let slopesOpacitySlider: HTMLCalciteSliderElement | null;
let releaseZoneOpacitySlider: HTMLCalciteSliderElement | null;

/**
 * Update status display
 */
function updateStatus(
  message: string,
  type: "loading" | "ready" | "error" = "loading"
): void {
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status-display ${type}`;
  }
  console.log(`[Status] ${message}`);
}

/**
 * Update progress bar
 */
function updateProgress(current: number, total: number): void {
  const percent = (current / total) * 100;
  if (progressBar) {
    progressBar.value = percent;
  }
  if (progressText) {
    progressText.textContent = `Loading ${current}/${total} frames...`;
  }
}

/**
 * Show loading progress
 */
function showLoadingProgress(): void {
  if (loadingProgress) {
    loadingProgress.style.display = "block";
  }
}

/**
 * Hide loading overlay
 */
function hideLoading(): void {
  if (loadingOverlay) {
    loadingOverlay.classList.add("hidden");
  }
  if (loadingProgress) {
    loadingProgress.style.display = "none";
  }
}

/**
 * Get the current active simulation
 */
function getSimulation() {
  return manager.getActiveSimulation();
}

/**
 * Setup UI event listeners
 */
function setupControls(): void {
  // Play/Pause button
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (manager.isPlayAllMode()) {
        manager.togglePlayAll();
        // Update button state based on whether any simulation is playing
        const isPlaying = manager.isAnyPlaying();
        onPlayStateChange(isPlaying);
      } else {
        const sim = getSimulation();
        if (!sim) return;
        sim.togglePlay();
      }
    });
  }

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (manager.isPlayAllMode()) {
        manager.resetAll();
      } else {
        getSimulation()?.reset();
      }
    });
  }

  // Speed select
  if (speedSelect) {
    speedSelect.addEventListener("calciteSelectChange", () => {
      const speed = parseInt(speedSelect!.value, 10);
      if (manager.isPlayAllMode()) {
        manager.setSpeedAll(speed);
      } else {
        getSimulation()?.setSpeed(speed);
      }
    });
  }

  // Smoothing select
  if (smoothingSelect) {
    smoothingSelect.addEventListener("calciteSelectChange", () => {
      const factor = parseInt(smoothingSelect!.value, 10);
      if (manager.isPlayAllMode()) {
        manager.setSmoothingAll(factor);
      } else {
        getSimulation()?.setSmoothing(factor);
      }
    });
  }

  // Flatten select
  if (flattenSelect) {
    flattenSelect.addEventListener("calciteSelectChange", () => {
      const passes = parseInt(flattenSelect!.value, 10);
      if (manager.isPlayAllMode()) {
        manager.setFlattenPassesAll(passes);
      } else {
        getSimulation()?.setFlattenPasses(passes);
      }
    });
  }

  // Exaggeration select
  if (exaggerationSelect) {
    exaggerationSelect.addEventListener("calciteSelectChange", () => {
      const factor = parseInt(exaggerationSelect!.value, 10);
      if (manager.isPlayAllMode()) {
        manager.setExaggerationAll(factor);
      } else {
        getSimulation()?.setExaggeration(factor);
      }
    });
  }

  // Time slider
  if (timeSlider) {
    timeSlider.addEventListener("calciteSliderInput", () => {
      const time = timeSlider!.value as number;
      if (manager.isPlayAllMode()) {
        // Pause all and seek all to the same time
        manager.pauseAll();
        manager.seekAllToTime(time);
        onPlayStateChange(false);
      } else {
        const sim = getSimulation();
        if (!sim) return;
        sim.pause();
        sim.seekToTime(time);
      }
    });
  }
}

/**
 * Update UI when simulation frame changes
 */
function onFrameChange(time: number): void {
  if (currentTimeSpan) {
    currentTimeSpan.textContent = time.toFixed(2);
  }
  if (timeSlider) {
    timeSlider.value = time;
  }
}

/**
 * Update UI when play state changes
 */
function onPlayStateChange(isPlaying: boolean): void {
  if (playBtn) {
    playBtn.textContent = isPlaying ? "Pause" : "Play";
    playBtn.iconStart = isPlaying ? "pause-f" : "play-f";
    playBtn.kind = isPlaying ? "danger" : "brand";
  }
}

/**
 * Subscribe to simulation events
 */
function subscribeToSimulation(): void {
  const sim = getSimulation();
  if (!sim) return;

  sim.on("frameChange", (event) => {
    if (event.time !== undefined) {
      onFrameChange(event.time);
    }
  });

  sim.on("playStateChange", (event) => {
    if (event.isPlaying !== undefined) {
      onPlayStateChange(event.isPlaying);
    }
  });
}

/**
 * Update slider for current avalanche config
 */
function updateSliderForConfig(config: AvalancheConfig): void {
  if (timeSlider) {
    const [min, max] = config.timeRange;
    timeSlider.min = min;
    timeSlider.max = max;
    timeSlider.step = config.timeInterval;
    timeSlider.value = min;
  }
}

/**
 * Calculate area of a GeoJSON polygon using geodesic calculation
 */
function calculatePolygonArea(geoJsonPolygon: { type: string; coordinates: number[][][] }): number {
  const polygon = new Polygon({
    rings: geoJsonPolygon.coordinates,
    spatialReference: { wkid: 4326 }
  });

  // Returns area in square meters (negative for geodesic, take absolute)
  return Math.abs(geodesicArea(polygon, "square-meters"));
}

/**
 * Draw release zone polygon on the map
 */
function drawReleaseZone(config: AvalancheConfig): void {
  if (!releaseZoneLayer) return;

  // Clear existing graphics
  releaseZoneLayer.removeAll();

  if (!config.releaseArea) return;

  const polygon = new Polygon({
    rings: config.releaseArea.coordinates,
    spatialReference: { wkid: 4326 }
  });

  const symbol = new SimpleFillSymbol({
    color: [255, 0, 0, 0.3],
    outline: {
      color: [255, 0, 0, 1],
      width: 2
    }
  });

  const graphic = new Graphic({
    geometry: polygon,
    symbol: symbol
  });

  releaseZoneLayer.add(graphic);
}

/**
 * Update info panel with avalanche details
 */
function updateInfoPanel(config: AvalancheConfig): void {
  if (avalancheNameEl) {
    avalancheNameEl.textContent = config.name;
  }
  if (avalancheDescEl) {
    avalancheDescEl.textContent = config.description || "Flow Height Visualization";
  }

  // Release zone info
  if (releaseDepthEl) {
    releaseDepthEl.textContent = config.releaseDepth
      ? `${config.releaseDepth} m`
      : "-";
  }
  if (releaseAreaEl) {
    if (config.releaseArea) {
      const area = calculatePolygonArea(config.releaseArea);
      releaseAreaEl.textContent = `${area.toFixed(0)} m²`;
    } else {
      releaseAreaEl.textContent = "-";
    }
  }

  // DEM info
  if (demSourceEl) {
    demSourceEl.textContent = config.demSource || "-";
  }
  if (demResolutionEl) {
    demResolutionEl.textContent = config.demGridResolution
      ? `${config.demGridResolution} m`
      : "-";
  }

  // Draw the release zone on the map
  drawReleaseZone(config);
}

/**
 * Populate the avalanche list
 */
function populateAvalancheList(configs: AvalancheConfig[]): void {
  if (!avalancheList) return;

  avalancheList.innerHTML = "";

  // Add "All Avalanches" option first
  const allItem = document.createElement("calcite-list-item");
  allItem.label = "All Avalanches";
  allItem.value = "all";
  avalancheList.appendChild(allItem);

  // Add individual avalanches
  configs.forEach((config) => {
    const item = document.createElement("calcite-list-item");
    item.label = config.name;
    item.value = config.id;
    avalancheList!.appendChild(item);
  });

  // Handle selection
  avalancheList.addEventListener("calciteListChange", async (event) => {
    const selectedItems = (event.target as HTMLCalciteListElement).selectedItems;
    if (selectedItems.length === 0) return;

    const selectedId = (selectedItems[0] as HTMLCalciteListItemElement).value;
    if (!selectedId) return;

    if (selectedId === "all") {
      await handlePlayAll();
    } else {
      await switchToAvalanche(selectedId);
    }
  });
}

/**
 * Handle Play All selection
 */
async function handlePlayAll(): Promise<void> {
  updateStatus("Loading all avalanches...");
  showLoadingProgress();

  // Clear release zone when playing all
  if (releaseZoneLayer) {
    releaseZoneLayer.removeAll();
  }

  try {
    await manager.loadAllSimulations((loaded, total) => {
      updateProgress(loaded, total);
    });

    hideLoading();
    updateStatus("Playing all avalanches", "ready");

    // Update info panel for "all" mode
    if (avalancheNameEl) {
      avalancheNameEl.textContent = "All Avalanches";
    }
    if (avalancheDescEl) {
      avalancheDescEl.textContent = "Playing all simulations simultaneously";
    }
    if (releaseDepthEl) {
      releaseDepthEl.textContent = "-";
    }
    if (releaseAreaEl) {
      releaseAreaEl.textContent = "-";
    }
    if (demSourceEl) {
      demSourceEl.textContent = "-";
    }
    if (demResolutionEl) {
      demResolutionEl.textContent = "-";
    }

    // Set slider to max range across all simulations
    if (timeSlider) {
      const [min, max] = manager.getMaxTimeRange();
      const step = manager.getMinTimeInterval();
      timeSlider.min = min;
      timeSlider.max = max;
      timeSlider.step = step;
      timeSlider.value = min;
    }

    // Subscribe to play state changes from all simulations
    subscribeToAllSimulations();

    await manager.playAll();

    // Update play button to show playing state
    onPlayStateChange(true);
  } catch (error) {
    console.error("Failed to play all:", error);
    updateStatus("Failed to load all avalanches", "error");
  }
}

/**
 * Subscribe to events from all simulations in play all mode
 */
function subscribeToAllSimulations(): void {
  const simulations = manager.getAllSimulations();
  simulations.forEach((sim) => {
    sim.on("playStateChange", (event) => {
      if (manager.isPlayAllMode() && event.isPlaying !== undefined) {
        // Update button based on whether any simulation is playing
        const isPlaying = manager.isAnyPlaying();
        onPlayStateChange(isPlaying);
      }
    });
  });
}

/**
 * Switch to a different avalanche
 */
async function switchToAvalanche(id: string): Promise<void> {
  // Exit play all mode if active
  if (manager.isPlayAllMode()) {
    manager.stopAll();
  }

  const config = manager.getConfigs().find((c) => c.id === id);
  if (!config) return;

  updateStatus(`Loading ${config.name}...`);
  showLoadingProgress();

  try {
    await manager.switchToAvalanche(id, updateProgress);

    // Subscribe to new simulation events
    subscribeToSimulation();

    // Update UI
    updateSliderForConfig(config);
    updateInfoPanel(config);
    hideLoading();

    // Reset play button state
    onPlayStateChange(false);

    updateStatus("Ready - Press Play to animate", "ready");
  } catch (error) {
    console.error("Failed to switch avalanche:", error);
    updateStatus(`Failed to load ${config.name}`, "error");
  }
}

/**
 * Setup layer opacity sliders
 */
function setupOpacitySliders(): void {
  // Snow Cover opacity
  if (snowCoverOpacitySlider && snowCoverLayer) {
    // Set initial slider value from layer opacity
    snowCoverOpacitySlider.value = snowCoverLayer.opacity * 100;
    snowCoverOpacitySlider.addEventListener("calciteSliderInput", () => {
      if (snowCoverLayer) {
        snowCoverLayer.opacity = (snowCoverOpacitySlider!.value as number) / 100;
      }
    });
  }

  // Slopes opacity
  if (slopesOpacitySlider && slopesLayer) {
    // Set initial slider value from layer opacity
    slopesOpacitySlider.value = slopesLayer.opacity * 100;
    slopesOpacitySlider.addEventListener("calciteSliderInput", () => {
      if (slopesLayer) {
        slopesLayer.opacity = (slopesOpacitySlider!.value as number) / 100;
      }
    });
  }

  // Release Zone opacity
  if (releaseZoneOpacitySlider && releaseZoneLayer) {
    // Set initial slider value from layer opacity
    releaseZoneOpacitySlider.value = releaseZoneLayer.opacity * 100;
    releaseZoneOpacitySlider.addEventListener("calciteSliderInput", () => {
      if (releaseZoneLayer) {
        releaseZoneLayer.opacity = (releaseZoneOpacitySlider!.value as number) / 100;
      }
    });
  }
}

/**
 * Handle scene view ready event
 */
async function onSceneViewReady(view: SceneView): Promise<void> {
  // Load elevation service
  const elevationService = getElevationService();
  await elevationService.load();

  // Create layers
  snowCoverLayer = createSnowCoverLayer();
  slopesLayer = createSlopesLayer();

  // Create release zone layer
  releaseZoneLayer = new GraphicsLayer({
    title: "Release Zone",
    elevationInfo: {
      mode: "on-the-ground"
    }
  });

  // Add elevation layer to ground and layers to map
  if (view.map) {
    view.map.ground.layers.add(elevationService.getLayer());
    view.map.addMany([snowCoverLayer, slopesLayer, releaseZoneLayer]);
  }

  // Setup opacity sliders
  setupOpacitySliders();

  // Set view in simulation manager
  manager.setView(view);

  // Load avalanche configurations
  updateStatus("Loading avalanche configurations...");
  const configs = await manager.loadConfigs();

  // Populate avalanche list
  populateAvalancheList(configs);

  // Hide initial loading overlay
  if (loadingOverlay) {
    loadingOverlay.classList.add("hidden");
  }

  // Auto-select first avalanche (skip "All Avalanches" which is first)
  if (configs.length > 0) {
    // Set the second item (first actual avalanche) as selected in the list
    const items = avalancheList?.querySelectorAll("calcite-list-item");
    if (items && items.length > 1) {
      (items[1] as HTMLCalciteListItemElement).selected = true;
    }

    await switchToAvalanche(configs[0].id);
  } else {
    updateStatus("No avalanche configurations found", "error");
  }
}

/**
 * Initialize the application
 */
function init(): void {
  updateStatus("Initializing...");

  // Get UI elements
  playBtn = document.getElementById("play-btn") as HTMLCalciteButtonElement;
  resetBtn = document.getElementById("reset-btn") as HTMLCalciteButtonElement;
  timeSlider = document.getElementById("time-slider") as HTMLCalciteSliderElement;
  speedSelect = document.getElementById("speed-select") as HTMLCalciteSelectElement;
  smoothingSelect = document.getElementById("smoothing-select") as HTMLCalciteSelectElement;
  flattenSelect = document.getElementById("flatten-select") as HTMLCalciteSelectElement;
  exaggerationSelect = document.getElementById("exaggeration-select") as HTMLCalciteSelectElement;
  currentTimeSpan = document.getElementById("current-time");
  statusEl = document.getElementById("status");
  progressBar = document.getElementById("progress-bar") as HTMLCalciteProgressElement;
  progressText = document.getElementById("progress-text");
  loadingProgress = document.getElementById("loading-progress");
  loadingOverlay = document.getElementById("loading-overlay");
  avalancheList = document.getElementById("avalanche-list") as HTMLCalciteListElement;
  avalancheNameEl = document.getElementById("avalanche-name");
  avalancheDescEl = document.getElementById("avalanche-description");
  releaseDepthEl = document.getElementById("release-depth");
  releaseAreaEl = document.getElementById("release-area");
  demSourceEl = document.getElementById("dem-source");
  demResolutionEl = document.getElementById("dem-resolution");

  // Opacity sliders
  snowCoverOpacitySlider = document.getElementById("snow-cover-opacity") as HTMLCalciteSliderElement;
  slopesOpacitySlider = document.getElementById("slopes-opacity") as HTMLCalciteSliderElement;
  releaseZoneOpacitySlider = document.getElementById("release-zone-opacity") as HTMLCalciteSliderElement;

  // Setup controls
  setupControls();

  // Get the arcgis-scene component and listen for ready event
  const sceneElement = document.querySelector("arcgis-scene") as ArcgisSceneElement | null;
  if (sceneElement) {
    sceneElement.addEventListener("arcgisViewReadyChange", async (event: Event) => {
      const view = (event.target as ArcgisSceneElement).view;
      if (view) {
        try {
          await onSceneViewReady(view);
        } catch (error) {
          console.error("Application initialization failed:", error);
          updateStatus(`Initialization failed: ${(error as Error).message}`, "error");
        }
      }
    });
  } else {
    console.error("arcgis-scene element not found");
    updateStatus("Scene element not found", "error");
  }
}

// Start the application
init();

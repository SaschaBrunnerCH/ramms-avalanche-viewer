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
let playAllBtn: HTMLCalciteActionElement | null;
let timeSlider: HTMLCalciteSliderElement | null;
let speedSelect: HTMLCalciteSelectElement | null;
let smoothingSelect: HTMLCalciteSelectElement | null;
let flattenSelect: HTMLCalciteSelectElement | null;
let currentTimeSpan: HTMLElement | null;
let statusEl: HTMLElement | null;
let progressBar: HTMLCalciteProgressElement | null;
let progressText: HTMLElement | null;
let loadingProgress: HTMLElement | null;
let loadingOverlay: HTMLElement | null;
let avalancheList: HTMLCalciteListElement | null;
let avalancheNameEl: HTMLElement | null;
let avalancheDescEl: HTMLElement | null;

// Application state
const manager = getSimulationManager();

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
      const sim = getSimulation();
      if (!sim) return;
      sim.togglePlay();
    });
  }

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      getSimulation()?.reset();
    });
  }

  // Speed select
  if (speedSelect) {
    speedSelect.addEventListener("calciteSelectChange", () => {
      const speed = parseInt(speedSelect!.value, 10);
      getSimulation()?.setSpeed(speed);
    });
  }

  // Smoothing select
  if (smoothingSelect) {
    smoothingSelect.addEventListener("calciteSelectChange", () => {
      const factor = parseInt(smoothingSelect!.value, 10);
      getSimulation()?.setSmoothing(factor);
    });
  }

  // Flatten select
  if (flattenSelect) {
    flattenSelect.addEventListener("calciteSelectChange", () => {
      const passes = parseInt(flattenSelect!.value, 10);
      getSimulation()?.setFlattenPasses(passes);
    });
  }

  // Time slider
  if (timeSlider) {
    timeSlider.addEventListener("calciteSliderInput", () => {
      const sim = getSimulation();
      if (!sim) return;
      sim.pause();
      const time = timeSlider!.value as number;
      sim.seekToTime(time);
    });
  }

  // Play All button
  if (playAllBtn) {
    playAllBtn.addEventListener("click", handlePlayAll);
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
 * Update info panel with avalanche details
 */
function updateInfoPanel(config: AvalancheConfig): void {
  if (avalancheNameEl) {
    avalancheNameEl.textContent = config.name;
  }
  if (avalancheDescEl) {
    avalancheDescEl.textContent = config.description || "Flow Height Visualization";
  }
}

/**
 * Populate the avalanche list
 */
function populateAvalancheList(configs: AvalancheConfig[]): void {
  if (!avalancheList) return;

  avalancheList.innerHTML = "";

  configs.forEach((config) => {
    const item = document.createElement("calcite-list-item");
    item.label = config.name;
    item.description = config.description || "";
    item.value = config.id;
    avalancheList!.appendChild(item);
  });

  // Handle selection
  avalancheList.addEventListener("calciteListChange", async (event) => {
    const selectedItems = (event.target as HTMLCalciteListElement).selectedItems;
    if (selectedItems.length === 0) return;

    const selectedId = (selectedItems[0] as HTMLCalciteListItemElement).value;
    if (!selectedId) return;

    await switchToAvalanche(selectedId);
  });
}

/**
 * Handle Play All button click
 */
async function handlePlayAll(): Promise<void> {
  if (manager.isPlayAllMode()) {
    // Stop all simulations
    manager.stopAll();
    updatePlayAllButton(false);
    updateStatus("Ready - Press Play to animate", "ready");
    updateInfoPanel(manager.getActiveConfig()!);
  } else {
    // Load and play all simulations
    updateStatus("Loading all avalanches...");
    showLoadingProgress();

    try {
      await manager.loadAllSimulations((loaded, total) => {
        updateProgress(loaded, total);
      });

      hideLoading();
      updateStatus("Playing all avalanches", "ready");
      updateInfoPanel({
        id: "all",
        name: "All Avalanches",
        description: "Playing all simulations simultaneously",
        folder: "",
        prefix: "",
        suffix: "",
        timeInterval: 1,
        timeRange: [0, 0],
      });

      await manager.playAll();
      updatePlayAllButton(true);
    } catch (error) {
      console.error("Failed to play all:", error);
      updateStatus("Failed to load all avalanches", "error");
    }
  }
}

/**
 * Update Play All button state
 */
function updatePlayAllButton(isPlaying: boolean): void {
  if (playAllBtn) {
    playAllBtn.icon = isPlaying ? "stop-f" : "play-all-f";
    playAllBtn.text = isPlaying ? "Stop All" : "Play All";
  }
}

/**
 * Switch to a different avalanche
 */
async function switchToAvalanche(id: string): Promise<void> {
  // Exit play all mode if active
  if (manager.isPlayAllMode()) {
    manager.stopAll();
    updatePlayAllButton(false);
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

    updateStatus("Ready - Press Play to animate", "ready");
  } catch (error) {
    console.error("Failed to switch avalanche:", error);
    updateStatus(`Failed to load ${config.name}`, "error");
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
  const snowCoverLayer = createSnowCoverLayer();
  const slopeLayer = createSlopesLayer();

  // Add elevation layer to ground and layers to map
  if (view.map) {
    view.map.ground.layers.add(elevationService.getLayer());
    view.map.addMany([snowCoverLayer, slopeLayer]);
  }

  // Configure environment
  view.environment = {
    background: {
      type: "color",
      color: [26, 26, 46, 1],
    },
    starsEnabled: false,
    atmosphereEnabled: true,
    lighting: {
      type: "sun",
      date: new Date("2024-06-21T10:00:00"),
      directShadowsEnabled: true,
    },
  };
  view.qualityProfile = "high";

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

  // Auto-select first avalanche
  if (configs.length > 0) {
    // Set the first item as selected in the list
    const firstItem = avalancheList?.querySelector("calcite-list-item");
    if (firstItem) {
      (firstItem as HTMLCalciteListItemElement).selected = true;
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
  currentTimeSpan = document.getElementById("current-time");
  statusEl = document.getElementById("status");
  progressBar = document.getElementById("progress-bar") as HTMLCalciteProgressElement;
  progressText = document.getElementById("progress-text");
  loadingProgress = document.getElementById("loading-progress");
  loadingOverlay = document.getElementById("loading-overlay");
  avalancheList = document.getElementById("avalanche-list") as HTMLCalciteListElement;
  avalancheNameEl = document.getElementById("avalanche-name");
  avalancheDescEl = document.getElementById("avalanche-description");
  playAllBtn = document.getElementById("play-all-btn") as HTMLCalciteActionElement;

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

// Calcite Components
import { setAssetPath } from "@esri/calcite-components";
import { defineCustomElements } from "@esri/calcite-components/dist/loader";
import "@esri/calcite-components/dist/calcite/calcite.css";

// Set Calcite assets path to CDN and define custom elements
setAssetPath("https://js.arcgis.com/calcite-components/3.0.3/assets");
defineCustomElements(window);

// ArcGIS Core
import "@arcgis/core/assets/esri/themes/light/main.css";
import Map from "@arcgis/core/Map";
import SceneView from "@arcgis/core/views/SceneView";
import Extent from "@arcgis/core/geometry/Extent";
import Camera from "@arcgis/core/Camera";
import Point from "@arcgis/core/geometry/Point";

// App modules
import { AvalancheSimulation } from "./core/AvalancheSimulation";
import { getElevationService } from "./core/ElevationService";
import { createSnowCoverLayer, createSlopesLayer } from "./core/SnowCoverLayer";
import type { AvalancheConfig } from "./config/types";
import { CAMERA_ANIMATION_DURATION } from "./config/constants";

// Styles
import "./styles/main.css";

// Default configuration for Spilauersee (matching prototype)
const DEFAULT_AVALANCHE_CONFIG: AvalancheConfig = {
  id: "spilauersee",
  name: "Spilauersee",
  folder: "Spilauersee",
  prefix: "spilauersee_Flowheight_",
  suffix: "s.tif",
  timeInterval: 2,
  timeRange: [0, 66],
  description: "Spilauersee avalanche simulation",
};

// UI Elements
let playBtn: HTMLCalciteButtonElement | null;
let resetBtn: HTMLCalciteButtonElement | null;
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

// Application state
let simulation: AvalancheSimulation | null = null;
let view: SceneView | null = null;

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
 * Setup UI event listeners
 */
function setupControls(): void {
  // Play/Pause button
  if (playBtn) {
    playBtn.addEventListener("click", () => {
      if (!simulation) return;
      simulation.togglePlay();
    });
  }

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      simulation?.reset();
    });
  }

  // Speed select
  if (speedSelect) {
    speedSelect.addEventListener("calciteSelectChange", () => {
      const speed = parseInt(speedSelect!.value, 10);
      simulation?.setSpeed(speed);
    });
  }

  // Smoothing select
  if (smoothingSelect) {
    smoothingSelect.addEventListener("calciteSelectChange", () => {
      const factor = parseInt(smoothingSelect!.value, 10);
      simulation?.setSmoothing(factor);
    });
  }

  // Flatten select
  if (flattenSelect) {
    flattenSelect.addEventListener("calciteSelectChange", () => {
      const passes = parseInt(flattenSelect!.value, 10);
      simulation?.setFlattenPasses(passes);
    });
  }

  // Time slider
  if (timeSlider) {
    timeSlider.addEventListener("calciteSliderInput", () => {
      if (!simulation) return;
      simulation.pause();
      const time = timeSlider!.value as number;
      simulation.seekToTime(time);
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
 * Initialize the application
 */
async function init(): Promise<void> {
  updateStatus("Initializing...");

  // Get UI elements
  playBtn = document.getElementById("play-btn") as HTMLCalciteButtonElement;
  resetBtn = document.getElementById("reset-btn") as HTMLCalciteButtonElement;
  timeSlider = document.getElementById(
    "time-slider"
  ) as HTMLCalciteSliderElement;
  speedSelect = document.getElementById(
    "speed-select"
  ) as HTMLCalciteSelectElement;
  smoothingSelect = document.getElementById(
    "smoothing-select"
  ) as HTMLCalciteSelectElement;
  flattenSelect = document.getElementById(
    "flatten-select"
  ) as HTMLCalciteSelectElement;
  currentTimeSpan = document.getElementById("current-time");
  statusEl = document.getElementById("status");
  progressBar = document.getElementById(
    "progress-bar"
  ) as HTMLCalciteProgressElement;
  progressText = document.getElementById("progress-text");
  loadingProgress = document.getElementById("loading-progress");
  loadingOverlay = document.getElementById("loading-overlay");

  // Setup controls
  setupControls();

  // Load elevation service
  const elevationService = getElevationService();
  await elevationService.load();

  // Create snow cover layer
  const snowCoverLayer = createSnowCoverLayer();
  const slopeLayer = createSlopesLayer();

  // Create map
  const map = new Map({
    basemap: "satellite",
    ground: {
      layers: [elevationService.getLayer()],
      surfaceColor: "#2d3436",
    },
    layers: [snowCoverLayer, slopeLayer],
  });

  // Create SceneView
  view = new SceneView({
    container: "viewDiv",
    map: map,
    environment: {
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
    },
    qualityProfile: "high",
    viewingMode: "local",
  });

  await view.when();

  // Create simulation
  simulation = new AvalancheSimulation(DEFAULT_AVALANCHE_CONFIG);

  // Subscribe to events
  simulation.on("frameChange", (event) => {
    if (event.time !== undefined) {
      onFrameChange(event.time);
    }
  });

  simulation.on("playStateChange", (event) => {
    if (event.isPlaying !== undefined) {
      onPlayStateChange(event.isPlaying);
    }
  });

  // Initialize simulation
  updateStatus("Preloading animation frames...");
  await simulation.initialize(view, updateProgress);

  // Configure slider based on time range
  if (timeSlider) {
    const [min, max] = DEFAULT_AVALANCHE_CONFIG.timeRange;
    timeSlider.min = min;
    timeSlider.max = max;
    timeSlider.step = DEFAULT_AVALANCHE_CONFIG.timeInterval;
  }

  // Hide loading
  hideLoading();

  // Display first frame
  simulation.displayFrame(0);

  // Get extent and animate camera
  const extent = simulation.getExtent();
  if (extent) {
    const centerX = (extent.xmin + extent.xmax) / 2;
    const centerY = (extent.ymin + extent.ymax) / 2;
    const extentWidth = extent.xmax - extent.xmin;
    const extentHeight = extent.ymax - extent.ymin;
    const diagonal = Math.sqrt(
      extentWidth * extentWidth + extentHeight * extentHeight
    );

    // Set initial camera position
    view.camera = new Camera({
      position: new Point({
        x: centerX - diagonal * 0.6,
        y: centerY - diagonal * 0.6,
        z: diagonal * 1.0,
        spatialReference: extent.spatialReference,
      }),
      heading: 45,
      tilt: 60,
    });

    // Animate to target view
    await view.goTo(
      {
        target: new Extent({
          xmin: extent.xmin,
          ymin: extent.ymin,
          xmax: extent.xmax,
          ymax: extent.ymax,
          spatialReference: extent.spatialReference,
        }).expand(1.3),
        heading: 320,
        tilt: 65,
      },
      {
        duration: CAMERA_ANIMATION_DURATION,
        easing: "out-expo",
      }
    );
  }

  updateStatus("Ready - Press Play to animate", "ready");
}

// Start the application
init().catch((error) => {
  console.error("Application initialization failed:", error);
  updateStatus(`Initialization failed: ${error.message}`, "error");
});

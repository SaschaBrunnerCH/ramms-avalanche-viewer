# RAMMS Avalanche Viewer - Implementation Plan

## Overview

Web application to visualize 3D animated avalanche simulations from RAMMS::AVALANCHE with multi-simulation navigation.

**Tech Stack:** TypeScript, Vite, ArcGIS Maps SDK 4.34, Calcite Design System 3.0

---

## Project Structure

```
ramms-avalanche-viewer/
├── .github/workflows/deploy.yml
├── public/
│   └── data/
│       ├── avalanches.json
│       ├── Diepen/
│       ├── Hundstock/
│       ├── Siwfass/
│       └── Spilauersee/
├── src/
│   ├── core/
│   │   ├── AvalancheSimulation.ts
│   │   ├── SimulationManager.ts
│   │   ├── TiffLoader.ts
│   │   ├── MeshGenerator.ts
│   │   ├── ElevationService.ts
│   │   └── SnowCoverLayer.ts
│   ├── config/
│   │   ├── constants.ts
│   │   └── types.ts
│   ├── utils/
│   │   ├── interpolation.ts
│   │   └── colorUtils.ts
│   ├── styles/main.css
│   └── main.ts
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Phase 1: Project Setup [COMPLETED]

### Step 1.1: Initialize Vite + TypeScript Project
- Run `npm create vite@latest . -- --template vanilla-ts`
- Install dependencies:
  ```
  @arcgis/core@^4.34.0
  @esri/calcite-components@^3.0.0
  geotiff@^2.1.0
  ```

### Step 1.2: Configure Build
- **tsconfig.json**: ES2023 target, strict mode, bundler resolution
- **vite.config.ts**: Conditional base path for GitHub Pages vs local dev

### Step 1.3: Create Type Definitions (`src/config/types.ts`)
```typescript
export interface AvalancheConfig {
  id: string;
  name: string;
  folder: string;
  prefix: string;
  suffix: string;
  timeInterval: number;
  timeRange: [number, number];
}

export interface FlowHeightData {
  flowHeights: number[];
  extent: ExtentData;
  maxHeight: number;
}

export interface AnimationState {
  currentFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;
  smoothingFactor: number;
  flattenPasses: number;
}
```

### Step 1.4: Port Prototype to TypeScript Modules

**From `prototype/app.js` (902 lines), extracted into:**

| Source Function | Target Module | Description |
|-----------------|---------------|-------------|
| `loadTiffFrame()` | `TiffLoader.ts` | GeoTIFF parsing, grid resampling |
| `createMesh()`, `generateSmoothedGrid()` | `MeshGenerator.ts` | 3D mesh from flow heights |
| `getColorForValue()` | `colorUtils.ts` | Linear color interpolation |
| `bilinearSample()`, `applyGaussianSmoothing()` | `interpolation.ts` | Grid resampling, smoothing |
| Animation state & `displayFrame()` | `AvalancheSimulation.ts` | Encapsulated animation class |
| Elevation queries | `ElevationService.ts` | Ground elevation caching |

### Step 1.5: Convert UI to Calcite Components

**Replaced native HTML with Calcite:**
- `<button>` → `<calcite-button>`
- `<input type="range">` → `<calcite-slider>`
- `<select>` → `<calcite-select>` + `<calcite-option>`
- Layout → `<calcite-shell>`, `<calcite-shell-panel>`, `<calcite-panel>`

### Step 1.6: Optimizations Applied
- Pre-cached mesh graphics to eliminate frame switching flicker
- Light theme with compact animation controls
- Calcite assets loaded from CDN

---

## Phase 2: CI/CD [COMPLETED]

### Step 2.1: Create GitHub Actions Workflow (`.github/workflows/deploy.yml`)
```yaml
name: Build&Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

### Step 2.2: npm scripts (configured)
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

---

## Phase 3: Multi-Avalanche Support [COMPLETED]

### Step 3.1: Configuration File (`public/data/avalanches.json`)
```json
{
  "avalanches": [
    {
      "id": "diepen",
      "name": "Diepen",
      "folder": "Diepen",
      "prefix": "Diepen_1s_Flowheight_",
      "suffix": "s.tif",
      "timeInterval": 1,
      "timeRange": [0, 46]
    },
    {
      "id": "hundstock",
      "name": "Hundstock",
      "folder": "Hundstock",
      "prefix": "Hundstock_1s_Flowheight_",
      "suffix": "s.tif",
      "timeInterval": 1,
      "timeRange": [0, 85]
    },
    {
      "id": "siwfass",
      "name": "Siwfass",
      "folder": "Siwfass",
      "prefix": "Siwfass_1s_Flowheight_",
      "suffix": "s.tif",
      "timeInterval": 1,
      "timeRange": [0, 44]
    },
    {
      "id": "spilauersee",
      "name": "Spilauersee",
      "folder": "Spilauersee",
      "prefix": "spilauersee_Flowheight_",
      "suffix": "s.tif",
      "timeInterval": 2,
      "timeRange": [0, 66]
    }
  ]
}
```

### Step 3.2: Implement SimulationManager (`src/core/SimulationManager.ts`)
- Manage multiple `AvalancheSimulation` instances
- Handle avalanche switching with zoom-to-extent
- Singleton pattern via `getSimulationManager()`
- Event system for avalanche changes

### Step 3.3: Implement Navigation Menu
- Left panel with `<calcite-shell-panel>` and `<calcite-panel>`
- `<calcite-list>` with `<calcite-list-item>` per avalanche (dynamically populated)
- On selection: exit Play All mode, zoom to extent, load simulation

### Step 3.4: AvalancheSimulation Updates
- Added `hide()` method to hide all mesh graphics
- Added `show()` method to show current frame mesh graphic
- Used for seamless switching between simulations

---

## Phase 4: Play All Feature [COMPLETED]

### Step 4.1: Implement "Play All" Feature
- Added "Play All" button (`<calcite-action>`) in left panel header
- Button toggles between "Play All" (play-all-f icon) and "Stop All" (stop-f icon)

### Step 4.2: SimulationManager Methods
- `loadAllSimulations()` - Preload all avalanche simulations with progress callback
- `getCombinedExtent()` - Calculate union of all simulation extents
- `playAll()` - Show all simulations, zoom to combined extent, start playback
- `stopAll()` - Pause and hide all simulations, restore active simulation
- `isPlayAllMode()` - Check if in Play All mode

### Step 4.3: UI Integration
- `handlePlayAll()` in main.ts handles button click
- `updatePlayAllButton()` toggles icon and text
- Selecting individual avalanche exits Play All mode automatically

---

## Key Files

| File | Status | Description |
|------|--------|-------------|
| `src/main.ts` | Complete | App entry point with Play All handling |
| `src/core/AvalancheSimulation.ts` | Complete | Animation class with mesh caching, hide/show |
| `src/core/SimulationManager.ts` | Complete | Multi-simulation management, Play All |
| `src/core/TiffLoader.ts` | Complete | TIFF loading |
| `src/core/MeshGenerator.ts` | Complete | Mesh generation |
| `src/core/ElevationService.ts` | Complete | Elevation queries |
| `src/core/SnowCoverLayer.ts` | Complete | Snow cover and slope raster functions |
| `src/config/types.ts` | Complete | TypeScript interfaces |
| `src/config/constants.ts` | Complete | Color stops, terrain config |
| `src/utils/interpolation.ts` | Complete | Grid resampling, smoothing |
| `src/utils/colorUtils.ts` | Complete | Color interpolation |
| `public/data/avalanches.json` | Complete | Avalanche configuration |
| `.github/workflows/deploy.yml` | Complete | CI/CD workflow |
| `index.html` | Complete | UI with left panel and Play All button |

---

## Technical Considerations

1. **Memory**: Pre-cached mesh graphics for flicker-free animation
2. **File naming**: Spilauersee uses lowercase + different prefix pattern
3. **Calcite events**: Use `calciteSliderInput`, `calciteSelectChange` (not native events)
4. **Asset paths**: Configure `setAssetPath()` for Calcite icons via CDN
5. **Build paths**: Conditional base path for GitHub Pages vs local development
6. **Play All sync**: All simulations play independently at their configured speeds
7. **Visibility management**: Use `hide()`/`show()` methods for seamless transitions

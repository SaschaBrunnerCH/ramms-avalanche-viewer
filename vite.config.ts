import { defineConfig } from 'vite';

// Set to true when deploying to GitHub Pages at username.github.io/ramms-avalanche-viewer/
// Set to false for local testing or deployment at root
const useGitHubPagesBase = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  base: useGitHubPagesBase ? '/ramms-avalanche-viewer/' : '/',
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 3000,
    open: true
  },
  preview: {
    port: 4173
  }
});

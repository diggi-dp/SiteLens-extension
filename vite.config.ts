import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';

const isContentScript = process.env.BUILD_TARGET === 'content';

// Load feature flags from .env files so they can be injected via `define`
const env = loadEnv('', process.cwd(), 'VITE_FEATURE_');

/** Build a `define` map that replaces `import.meta.env.VITE_FEATURE_*` at compile time. */
function featureFlagDefines(): Record<string, string> {
  const defines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('VITE_FEATURE_')) {
      defines[`import.meta.env.${key}`] = JSON.stringify(value);
    }
  }
  return defines;
}

// Custom plugin to finalize Chrome extension output
function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',
    writeBundle() {
      // Only run finalization on the main build (not the content script build)
      if (isContentScript) return;

      const distDir = resolve(__dirname, 'dist');
      const publicDir = resolve(__dirname, 'public');

      if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true });

      // Read source manifest and transform paths for dist
      const manifestSrc = resolve(publicDir, 'manifest.json');
      if (existsSync(manifestSrc)) {
        const manifest = JSON.parse(readFileSync(manifestSrc, 'utf-8'));

        manifest.background = { service_worker: 'background.js', type: 'module' };
        // No default_popup — panel is injected as floating iframe by content script
        delete manifest.action.default_popup;
        if (!manifest.permissions.includes('scripting')) {
          manifest.permissions.push('scripting');
        }
        manifest.content_scripts = [{
          matches: ['<all_urls>'],
          js: ['content.js'],
          css: ['content.css'],
          run_at: 'document_idle'
        }];
        manifest.web_accessible_resources = [{
          resources: ['index.html', 'sidepanel.html', 'content.css', 'content.js', 'assets/*'],
          matches: ['<all_urls>']
        }];
        // No side_panel in manifest — path is set per-tab via setOptions()

        writeFileSync(resolve(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
      }

      // Copy icons
      const iconsDir = resolve(publicDir, 'icons');
      const distIconsDir = resolve(distDir, 'icons');
      if (!existsSync(distIconsDir)) mkdirSync(distIconsDir, { recursive: true });
      if (existsSync(iconsDir)) {
        readdirSync(iconsDir).forEach(file => {
          if (file.endsWith('.png')) {
            copyFileSync(resolve(iconsDir, file), resolve(distIconsDir, file));
          }
        });
      }

      // Copy content.css
      const contentCssSrc = resolve(__dirname, 'src/content/styles/content.css');
      const contentCssDist = resolve(distDir, 'content.css');
      if (existsSync(contentCssSrc)) {
        copyFileSync(contentCssSrc, contentCssDist);
      }

      console.log('\n✅ Chrome extension built successfully!');
      console.log('📂 Load as unpacked extension from: dist/\n');
    }
  };
}

// Content script build — IIFE format, no code splitting, self-contained bundle
const contentConfig = defineConfig({
  plugins: [],
  define: featureFlagDefines(),
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,  // Don't wipe the main build output
    copyPublicDir: false,  // Don't copy public/ again (main build already did)
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'SiteLensContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        // No code splitting for content scripts
        inlineDynamicImports: true,
      },
    },
  },
});

// Main build — Panel, Side Panel, Background (ESM is fine for extension pages)
const mainConfig = defineConfig({
  plugins: [react(), chromeExtensionPlugin()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        panel: resolve(__dirname, 'index.html'),
        sidepanel: resolve(__dirname, 'sidepanel.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        injectDetector: resolve(__dirname, 'src/content/utils/injectDetector.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') return 'background.js';
          if (chunkInfo.name === 'injectDetector') return 'assets/injectDetector.js';
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});

export default isContentScript ? contentConfig : mainConfig;

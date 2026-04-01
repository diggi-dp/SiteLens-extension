import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

build({
  configFile: false,
  build: {
    outDir: resolve(__dirname, 'dist/assets'),
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/utils/injectDetector.ts'),
      name: 'injectDetector',
      formats: ['iife'],
      fileName: () => 'injectDetector.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    }
  }
}).then(() => console.log('Successfully built injectDetector.js'));

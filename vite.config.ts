import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
  plugins: [
    webExtension({
      manifest: './public/manifest.json',
      watchFilePaths: ['src/**/*', 'public/**/*'],
      browser: 'chrome',
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});

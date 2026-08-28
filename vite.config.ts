import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Served from https://<user>.github.io/inboxes/ on GitHub Pages.
  // Relative base keeps asset URLs correct under the repo subpath and would
  // also work if later hosted at a domain root.
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});

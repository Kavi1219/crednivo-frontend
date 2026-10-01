import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One id per build. The app knows its own id; /version.json tells it the id that
// is live now. When they differ, UpdateWatcher reloads on the next page change.
const BUILD_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

function versionFile() {
  return {
    name: 'crednivo-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ buildId: BUILD_ID }) });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile()],
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
  },
});

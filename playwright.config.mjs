import { defineConfig } from '@playwright/test';

const port = Number(process.env.SHEETFLOW_TEST_PORT || 4587);
const url = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  use: {
    baseURL: url,
    channel: 'msedge',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'edge' }],
  webServer: {
    command: 'npm run build && node scripts/serve.mjs',
    url,
    env: { PORT: String(port) },
    reuseExistingServer: false
  }
});

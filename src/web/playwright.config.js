const { defineConfig, devices } = require('@playwright/test');

const frontendPort = Number(process.env.MORNING_BRIEFING_E2E_FRONTEND_PORT || 38123);
const backendPort = Number(process.env.MORNING_BRIEFING_E2E_BACKEND_PORT || 39123);

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: `http://127.0.0.1:${frontendPort}`,
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
      }
    }
  ],
  webServer: [
    {
      command: `env PORT=${backendPort} SNAPSHOT_QUEUE_ENABLED=false node dist/src/app/server.js`,
      url: `http://127.0.0.1:${backendPort}/health`,
      reuseExistingServer: false,
      timeout: 600000,
      cwd: '../backend'
    },
    {
      command: `npm run build && npx vite preview --host 127.0.0.1 --port ${frontendPort}`,
      url: `http://127.0.0.1:${frontendPort}`,
      reuseExistingServer: false,
      timeout: 600000,
      cwd: __dirname
    }
  ]
});

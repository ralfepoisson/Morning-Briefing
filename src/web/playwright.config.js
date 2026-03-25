const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8080',
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
      command: 'env SNAPSHOT_QUEUE_ENABLED=false npm start',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: true,
      cwd: '../backend'
    },
    {
      command: 'npx http-server . -p 8080 -c-1',
      url: 'http://127.0.0.1:8080',
      reuseExistingServer: true,
      cwd: __dirname
    }
  ]
});

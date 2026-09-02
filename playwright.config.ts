import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 5_000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    channel: 'chrome',
    trace: 'on-first-retry'
  },
  webServer: [
    {
      command: 'npm run start -w @marfia/server',
      url: 'http://127.0.0.1:3000/health',
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'npm run dev -w @marfia/web -- --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI
    }
  ]
});

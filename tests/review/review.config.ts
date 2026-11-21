import { defineConfig } from '@playwright/test'

// Independent reviewer config. Serve the production build first:
//   npm run build && npx vite preview --port 4180 --strictPort
export default defineConfig({
  testDir: '.',
  outputDir: '/tmp/review-results',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4180',
    trace: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})

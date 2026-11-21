import { defineConfig } from '@playwright/test'

// Independent reviewer config. Serve the production build first:
//   npm run build && npx vite preview --port 4180 --strictPort
// A second copy can run elsewhere with REVIEW_BASE=http://localhost:<port> REVIEW_OUTPUT=… REVIEW_SHOTS=…
export default defineConfig({
  testDir: '.',
  outputDir: process.env.REVIEW_OUTPUT ?? '/tmp/review-results',
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.REVIEW_BASE ?? 'http://localhost:4180',
    trace: 'off',
    screenshot: 'off',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})

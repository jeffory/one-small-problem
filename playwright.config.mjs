import { defineConfig } from '@playwright/test';

// Headless Firefox gets no WebGL2 on a GPU-less runner (no display for Mesa); CI runs it headed under xvfb-run instead.
const projects = [
  { name: 'chromium', use: { browserName: 'chromium', launchOptions: { args: ['--enable-unsafe-swiftshader'] } } },
  { name: 'firefox', use: { browserName: 'firefox', headless: !process.env.CI } },
];
if (process.env.OSP_WEBKIT) projects.push({ name: 'webkit', use: { browserName: 'webkit' } });

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.mjs',
  webServer: { command: 'node tools/serve.mjs 4173', url: 'http://localhost:4173/index.html', reuseExistingServer: true },
  retries: process.env.CI ? 1 : 0,
  projects,
});

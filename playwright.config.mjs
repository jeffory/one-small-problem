import { defineConfig } from '@playwright/test';

const projects = [
  { name: 'chromium', use: { browserName: 'chromium', launchOptions: { args: ['--enable-unsafe-swiftshader'] } } },
  { name: 'firefox', use: { browserName: 'firefox' } },
];
if (process.env.OSP_WEBKIT) projects.push({ name: 'webkit', use: { browserName: 'webkit' } });

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.mjs',
  webServer: { command: 'node tools/serve.mjs 4173', url: 'http://localhost:4173/index.html', reuseExistingServer: true },
  projects,
});

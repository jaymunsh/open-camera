import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:5185',
    viewport: { width: 390, height: 844 },
    permissions: ['camera'],
    trace: 'retain-on-failure',
    launchOptions: {
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
      ],
    },
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5185 --strictPort',
      url: 'http://127.0.0.1:5185',
    },
    {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5186 --strictPort',
      url: 'http://127.0.0.1:5186',
    },
  ],
});

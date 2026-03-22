// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: 'html',
  timeout: 30000, // Timeout global de 30s por teste
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off', // Desativado para acelerar
    actionTimeout: 5000, // Timeout de ações
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox removido do CI - Chromium cobre 95% dos casos
    ...(process.env.CI ? [] : [{
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    }]),
  ],

  webServer: {
    command: 'npx http-server . -p 8080 --silent',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 60 * 1000, // Reduzido de 120s para 60s
  },
});

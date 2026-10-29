import { defineConfig, devices } from '@playwright/test'

/**
 * Kiểm thử đầu-cuối chạy trên Supabase cục bộ đã seed (npm run db:reset).
 * Ảnh chụp màn hình lưu ở test-results/ (không đưa lên git).
 *
 * - Cổng 3000: website đã cấu hình qua .env.local (các trang công khai, quản trị).
 * - Cổng 3001: cùng mã nguồn nhưng cố ý không có cấu hình, để chạy trình cài đặt từ bước 1.
 * Kiểm thử cài đặt tạm đưa CSDL về trạng thái "chưa cài" nên mọi test chạy tuần tự (workers: 1).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /install\.spec/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /install\.spec/ },
    { name: 'install', use: { ...devices['Desktop Chrome'] }, testMatch: /install\.spec/ },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 3001',
      url: 'http://localhost:3001',
      reuseExistingServer: true,
      timeout: 60_000,
      // Biến tiến trình được ưu tiên hơn .env.local; giá trị không hợp lệ = chưa cấu hình
      env: { VITE_SUPABASE_URL: 'none', VITE_SUPABASE_ANON_KEY: 'none' },
    },
  ],
})

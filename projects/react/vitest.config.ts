import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'

// https://vitest.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./__tests__/setupTests.ts'],
    include: ['./__tests__/**/*.{test,spec}.{ts,tsx}'],
  },
})
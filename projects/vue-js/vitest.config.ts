import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'url';

export default defineConfig({
  plugins: [vue()],
  test: {
    // Test environment configuration
    environment: 'jsdom',
    // Enable Vue components support
    globals: true,
    // Test file extensions configuration
    include: ['**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
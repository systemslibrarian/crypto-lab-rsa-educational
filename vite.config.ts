import { defineConfig } from 'vite';

// Served from a GitHub Pages project subpath. The standardization pass (Part C)
// verifies this matches the repo name exactly.
export default defineConfig({
  base: '/crypto-lab-rsa-educational/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

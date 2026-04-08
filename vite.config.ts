/// <reference types="node" />

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { PluginOption } from "vite";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from "path";

const configuredProjectRoot = process.env.PROJECT_ROOT?.trim()

// NOTE: PROJECT_ROOT is intentionally preferred over import.meta.dirname so that builds
// can be driven from a different working directory (e.g. monorepos or CI) while still
// resolving aliases relative to the logical project root. import.meta.dirname and
// process.cwd() act as fallbacks when PROJECT_ROOT is not provided.
const projectRoot = configuredProjectRoot || import.meta.dirname || process.cwd();
const isTest = Boolean(process.env.VITEST)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // DO NOT REMOVE (excluded in test mode to avoid Spark/browser-only plugin side effects)
    ...(isTest ? [] : [createIconImportProxy() as PluginOption, sparkPlugin() as PluginOption]),
  ],
  base: '/orchestrate/',
  build: {
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          if (!normalizedId.includes('node_modules')) {
            return undefined
          }

          if (normalizedId.includes('/react/') || normalizedId.includes('/react-dom/')) {
            return 'vendor-react'
          }

          if (normalizedId.includes('/@radix-ui/')) {
            return 'vendor-radix'
          }

          if (
            normalizedId.includes('/d3') ||
            normalizedId.includes('/recharts') ||
            normalizedId.includes('/framer-motion') ||
            normalizedId.includes('/three')
          ) {
            return 'vendor-viz'
          }

          if (normalizedId.includes('/@octokit/') || normalizedId.includes('/octokit/')) {
            return 'vendor-octokit'
          }

          return 'vendor'
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(projectRoot, "src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    watch: {
      usePolling: false,
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    testTimeout: 15000,
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/components/ui/**',
      ]
    }
  }
});

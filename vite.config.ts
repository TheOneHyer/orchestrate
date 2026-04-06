/// <reference types="node" />

import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
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
    babel({
      presets: [reactCompilerPreset()]
    }),
    tailwindcss(),
    // DO NOT REMOVE (excluded in test mode to prevent react-swc preamble conflicts)
    ...(isTest ? [] : [createIconImportProxy() as PluginOption, sparkPlugin() as PluginOption]),
  ],
  base: '/orchestrate/',
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

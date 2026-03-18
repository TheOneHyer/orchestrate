import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import type { PluginOption } from "vite";
import { coverageConfigDefaults, defineConfig } from "vitest/config";

import sparkPlugin from "@github/spark/spark-vite-plugin";
import createIconImportProxy from "@github/spark/vitePhosphorIconProxyPlugin";
import { resolve } from "path";

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname
const isTest = Boolean(process.env.VITEST)

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
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
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
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
        'src/components/ui/**'
      ]
    }
  }
});

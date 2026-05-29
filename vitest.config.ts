import { defineConfig } from 'vitest/config'

// Smoke tests rodam só sobre funções puras (sem Electron/DOM), então o
// environment 'node' é suficiente e mais rápido. Testes ficam ao lado do
// código em *.test.ts.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: true
  }
})

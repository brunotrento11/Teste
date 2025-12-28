import { beforeEach, afterEach, vi } from 'vitest';

/**
 * Mock completo do localStorage para testes
 * Simula comportamento do browser localStorage
 */
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] || null
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Limpar estado antes de cada teste
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
});

// Restaurar estado após cada teste
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

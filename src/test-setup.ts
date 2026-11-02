import '@testing-library/jest-dom/vitest';

// jsdom não tem ResizeObserver (usado pela capa de reserva dos cards)
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
// Initialize i18n once for all component tests so `t()` returns real strings.
import '@/i18n';

// Unmount React trees after every test to keep the DOM isolated.
afterEach(() => {
  cleanup();
});

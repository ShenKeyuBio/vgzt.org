import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
} from '../src/lib/browser-storage';

const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage',
);

afterEach(() => {
  if (originalStorage)
    Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('safe browser storage', () => {
  test('reads, writes, and removes values', () => {
    const storage = {
      getItem: vi.fn(() => 'Europe/London'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage,
    });

    expect(safeStorageGet('zone')).toBe('Europe/London');
    expect(safeStorageSet('zone', 'Asia/Tokyo')).toBe(true);
    expect(safeStorageRemove('zone')).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith('zone', 'Asia/Tokyo');
    expect(storage.removeItem).toHaveBeenCalledWith('zone');
  });

  test('does not throw when storage access is blocked', () => {
    const blocked = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: blocked, setItem: blocked, removeItem: blocked },
    });

    expect(safeStorageGet('zone')).toBeNull();
    expect(safeStorageSet('zone', 'UTC')).toBe(false);
    expect(safeStorageRemove('zone')).toBe(false);
  });
});

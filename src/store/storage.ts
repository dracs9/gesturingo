import type { StateStorage } from "zustand/middleware";

/**
 * localStorage that never throws: private mode, blocked storage or a full quota
 * must not break the app — progress is then simply not remembered.
 */
export const safeStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // Not critical.
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // Not critical.
    }
  },
};

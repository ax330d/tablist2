export const DEBUG = false;

/** Logs an error to the console with a consistent prefix. */
export const logError = (type: string, message: string, error?: unknown): void => {
  console.error(`[${type}] ${message}`, error);
};

export const logInfo = (type: string, message: string, info?: unknown): void => {
  console.log(`[${type}] ${message}`, info);
};

export const checkChromeError = (type: string, message: string): boolean => {
  if (chrome.runtime.lastError) {
    logError(type, message, chrome.runtime.lastError);
    return false;
  }

  return true;
}

/** Logs a critical error and throws an exception, halting execution. */
export const logCritical = (type: string, message: string, error?: unknown): never => {
  throw new Error(`[${type}] ${message}${error ? `: ${String(error)}` : ''}`);
};

export function assertElement<T>(value: T | null | undefined, message: string): asserts value is T {
  if (!value) {
    throw new Error(`[DragDropManager] ${message}`);
  }
}
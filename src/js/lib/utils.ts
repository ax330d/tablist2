import { logError } from "./logging";

/**
 * Checks if the provided URL uses a secure protocol.
 * @param url - The URL string to check.
 * @returns `true` if the URL uses a secure protocol (e.g., HTTPS, Chrome, Chrome-extension, or file), `false` otherwise.
 * @throws {Error} Logs an error to the console if the URL is invalid.
 */
export function isSecureUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsedUrl = new URL(url);
    const secureProtocols = ['https:', 'chrome:', 'chrome-extension:', 'file:'];
    return secureProtocols.includes(parsedUrl.protocol);
  } catch (error) {
    logError('[isSecureUrl]', `Invalid URL provided: ${url}`, error);
    return false;
  }
}

export function isOwnUrl(url: string): boolean {
  if (!url) return false;
  const prefixedPage = chrome.runtime.getURL("newtab.html");
  return ['chrome://newtab/', prefixedPage].includes(url);
}

/**
 * Converts a hexadecimal color code to an RGBA string.
 * @param hex - The hexadecimal color code (e.g., '#FFF' or '#FFFFFF').
 * @param opacity - The opacity value, between 0 (fully transparent) and 1 (fully opaque).
 * @returns The RGBA color string (e.g., 'rgba(255, 255, 255, 0.5)').
 * @throws {Error} Throws an error if the hex code is invalid.
 */
export const hexToRGBA = (hex: string, opacity: number): string => {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Normalizes a hexadecimal RGB color code to a 6-character format with a leading '#'.
 * @param text - The hexadecimal color code (e.g., 'abc', '#ff0000').
 * @returns The normalized hexadecimal color code (e.g., '#FF0000').
 * @throws {Error} Throws an error if the input is not a valid hex RGB color.
 */
export function normalizeHexRGB(text: string): string {
  const cleanedText = text.trim().toUpperCase();
  const hexPattern = /^#?([0-9A-F]{3}|[0-9A-F]{6})$/;

  if (!hexPattern.test(cleanedText)) {
    throw new Error('Input must be a valid hex RGB color (3 or 6 characters, e.g., "abc" or "#ff0000")');
  }

  let hexValue = cleanedText.startsWith('#') ? cleanedText.slice(1) : cleanedText;

  if (hexValue.length === 3) {
    hexValue = hexValue.split('').map((char) => char + char).join('');
  }

  if (hexValue.length < 6) {
    while (hexValue.length < 6) {
      hexValue += hexValue;
    }
    hexValue = hexValue.substring(0, 6);
  }

  return `#${hexValue}`;
}

/**
 * Updates the DOM indices of tab elements and group headers for accessibility and ordering.
 * @param container - The HTML element containing the tab elements and group headers.
 * @throws {Error} Throws an error if the container is not provided or is destroyed.
 */
export function updateDomIndices(container: HTMLElement): void {
  if (!container) {
    throw new Error('main container is destroyed!');
  }
  const tabElements = container.querySelectorAll('.data-container') as NodeListOf<HTMLElement>;
  tabElements.forEach((el, index) => {
    el.dataset['tabIndex'] = index.toString();
  });

  const groupHeaders = container.querySelectorAll('.tab-group-header') as NodeListOf<HTMLElement>;
  groupHeaders.forEach((header) => header.setAttribute('tabindex', '0'));
}

export const hours = (h: number) => {
  return h * 60 * 60 * 1000;
};

export const days = (d: number) => {
  return d * hours(24);
};
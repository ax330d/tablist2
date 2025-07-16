// Type definitions for color objects and maps
interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface HslColor {
  h: number;
  s: number;
  l: number;
}

/**
 * Converts a hex color string to an RGB object.
 * Handles "#RRGGBB" or "RRGGBB" formats.
 * @param {string} hex - The hex color string.
 * @returns {RgbColor} An object with r, g, b components (0-255).
 */
function hexToRgb(hex: string): RgbColor {
  let r = 0, g = 0, b = 0;

  // Remove '#' if present
  const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;

  // Handle 3-digit hex (e.g., "FFF")
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0]! + cleanHex[0], 16);
    g = parseInt(cleanHex[1]! + cleanHex[1], 16);
    b = parseInt(cleanHex[2]! + cleanHex[2], 16);
  }
  // Handle 6-digit hex (e.g., "FFFFFF")
  else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  } else {
    // Fallback for invalid hex, though not expected with COLOR_MAP
    console.warn(`Invalid hex color input: ${hex}. Returning black.`);
    return { r: 0, g: 0, b: 0 };
  }

  return { r, g, b };
}

/**
 * Converts an RGB color value to HSL.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 * @param {number} r - The red color value
 * @param {number} g - The green color value
 * @param {number} b - The blue color value
 * @returns {HslColor} The HSL representation.
 */
function rgbToHsl(r: number, g: number, b: number): HslColor {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h: number = 0, s: number = 0, l: number = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h, s, l };
}

/**
 * Converts an HSL color value to RGB.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 * @param {number} h - The hue
 * @param {number} s - The saturation
 * @param {number} l - The lightness
 * @returns {RgbColor} The RGB representation.
 */
function hslToRgb(h: number, s: number, l: number): RgbColor {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

/**
 * Converts an RGB color value to a hex string.
 * @param {RgbColor} rgb - The RGB color object.
 * @returns {string} The hex color string (e.g., "#RRGGBB").
 */
function rgbToHex(rgb: RgbColor): string {
  // Ensure values are within 0-255 range
  const r = Math.max(0, Math.min(255, Math.round(rgb.r)));
  const g = Math.max(0, Math.min(255, Math.round(rgb.g)));
  const b = Math.max(0, Math.min(255, Math.round(rgb.b)));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Lightens or darkens a hex color by a given percentage.
 * @param {string} hex - The hex color string.
 * @param {number} percent - The percentage to lighten/darken (e.g., 0.1 for 10% lighter, -0.1 for 10% darker).
 * @returns {string} The new hex color string.
 */
function lightenDarkenHexColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Adjust lightness and clamp between 0 and 1
  l = Math.max(0, Math.min(1, l + percent));

  const newRgb = hslToRgb(h, s, l);
  return rgbToHex(newRgb);
}

// Your original ColorMap
export const COLOR_MAP: { [key: string]: string } = {
  grey: '#ccc',
  blue: '#4285f4',
  red: '#ea4335',
  yellow: '#fbbc05',
  green: '#34a853',
  pink: '#e91e63',
  purple: '#9c27b0',
  cyan: '#00acc1',
  orange: '#FF9800',
};

// Generate ColorMapGrad
export const ColorMapGrad: { [key: string]: string[] } = {};

for (const key in COLOR_MAP) {
  // Ensure the property belongs to COLOR_MAP itself, not its prototype chain
  if (Object.prototype.hasOwnProperty.call(COLOR_MAP, key)) {
    const baseColor = COLOR_MAP[key];
    if (!baseColor) throw new Error(`Missing color for ${key}!`);
    ColorMapGrad[key] = [
      lightenDarkenHexColor(baseColor, -0.1), // Darker
      lightenDarkenHexColor(baseColor, -0.05), // Slightly darker
      baseColor,                              // Original
      lightenDarkenHexColor(baseColor, 0.05),  // Slightly lighter
      lightenDarkenHexColor(baseColor, 0.1)   // Lighter
    ];
  }
}

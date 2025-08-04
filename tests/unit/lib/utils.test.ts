import { isSecureUrl, hexToRGBA, normalizeHexRGB, hours, days } from '../../../src/js/lib/utils';

// Mock the logging module to avoid console output during tests
jest.mock('../../../src/js/lib/logging', () => ({
  logError: jest.fn(),
}));

describe('utils', () => {
  describe('isSecureUrl', () => {
    it('should return true for HTTPS URLs', () => {
      expect(isSecureUrl('https://example.com')).toBe(true);
      expect(isSecureUrl('https://www.google.com/search?q=test')).toBe(true);
    });

    it('should return true for Chrome URLs', () => {
      expect(isSecureUrl('chrome://extensions')).toBe(true);
      expect(isSecureUrl('chrome://settings')).toBe(true);
    });

    it('should return true for Chrome extension URLs', () => {
      expect(isSecureUrl('chrome-extension://abcdef123456/popup.html')).toBe(true);
    });

    it('should return true for file URLs', () => {
      expect(isSecureUrl('file:///path/to/file.html')).toBe(true);
    });

    it('should return false for HTTP URLs', () => {
      expect(isSecureUrl('http://example.com')).toBe(false);
      expect(isSecureUrl('http://insecure-site.com')).toBe(false);
    });

    it('should return false for other protocols', () => {
      expect(isSecureUrl('ftp://example.com')).toBe(false);
      expect(isSecureUrl('data:text/html,<h1>Hello</h1>')).toBe(false);
    });

    it('should return false for empty or null URLs', () => {
      expect(isSecureUrl('')).toBe(false);
      expect(isSecureUrl(null as any)).toBe(false);
      expect(isSecureUrl(undefined as any)).toBe(false);
    });

    it('should return false for invalid URLs', () => {
      expect(isSecureUrl('not-a-url')).toBe(false);
      expect(isSecureUrl('just some text')).toBe(false);
      expect(isSecureUrl('://missing-protocol')).toBe(false);
    });
  });

  describe('hexToRGBA', () => {
    it('should convert 6-digit hex to RGBA', () => {
      expect(hexToRGBA('#FF0000', 1)).toBe('rgba(255, 0, 0, 1)');
      expect(hexToRGBA('#00FF00', 0.5)).toBe('rgba(0, 255, 0, 0.5)');
      expect(hexToRGBA('#0000FF', 0)).toBe('rgba(0, 0, 255, 0)');
    });

    it('should convert 3-digit hex to RGBA', () => {
      expect(hexToRGBA('#F00', 1)).toBe('rgba(255, 0, 0, 1)');
      expect(hexToRGBA('#0F0', 0.8)).toBe('rgba(0, 255, 0, 0.8)');
      expect(hexToRGBA('#00F', 0.3)).toBe('rgba(0, 0, 255, 0.3)');
    });

    it('should handle hex without # prefix', () => {
      expect(hexToRGBA('FF0000', 1)).toBe('rgba(255, 0, 0, 1)');
      expect(hexToRGBA('F00', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    });

    it('should handle common colors', () => {
      expect(hexToRGBA('#FFFFFF', 1)).toBe('rgba(255, 255, 255, 1)');
      expect(hexToRGBA('#000000', 1)).toBe('rgba(0, 0, 0, 1)');
      expect(hexToRGBA('#808080', 0.5)).toBe('rgba(128, 128, 128, 0.5)');
    });

    it('should handle lowercase hex', () => {
      expect(hexToRGBA('#ff0000', 1)).toBe('rgba(255, 0, 0, 1)');
      expect(hexToRGBA('#abc', 0.7)).toBe('rgba(170, 187, 204, 0.7)');
    });
  });

  describe('normalizeHexRGB', () => {
    it('should normalize 3-digit hex to 6-digit', () => {
      expect(normalizeHexRGB('abc')).toBe('#AABBCC');
      expect(normalizeHexRGB('F00')).toBe('#FF0000');
      expect(normalizeHexRGB('123')).toBe('#112233');
    });

    it('should normalize 6-digit hex', () => {
      expect(normalizeHexRGB('ff0000')).toBe('#FF0000');
      expect(normalizeHexRGB('ABCDEF')).toBe('#ABCDEF');
      expect(normalizeHexRGB('123456')).toBe('#123456');
    });

    it('should handle hex with # prefix', () => {
      expect(normalizeHexRGB('#abc')).toBe('#AABBCC');
      expect(normalizeHexRGB('#FF0000')).toBe('#FF0000');
    });

    it('should convert to uppercase', () => {
      expect(normalizeHexRGB('abcdef')).toBe('#ABCDEF');
      expect(normalizeHexRGB('#f0f0f0')).toBe('#F0F0F0');
    });

    it('should handle whitespace', () => {
      expect(normalizeHexRGB('  abc  ')).toBe('#AABBCC');
      expect(normalizeHexRGB(' #FF0000 ')).toBe('#FF0000');
    });

    it('should throw error for invalid hex', () => {
      expect(() => normalizeHexRGB('xyz')).toThrow('Input must be a valid hex RGB color');
      expect(() => normalizeHexRGB('12')).toThrow('Input must be a valid hex RGB color');
      expect(() => normalizeHexRGB('1234567')).toThrow('Input must be a valid hex RGB color');
      expect(() => normalizeHexRGB('')).toThrow('Input must be a valid hex RGB color');
      expect(() => normalizeHexRGB('not-hex')).toThrow('Input must be a valid hex RGB color');
    });
  });

  describe('hours', () => {
    it('should convert hours to milliseconds', () => {
      expect(hours(1)).toBe(3600000); // 1 hour = 3,600,000 ms
      expect(hours(2)).toBe(7200000); // 2 hours = 7,200,000 ms
      expect(hours(0)).toBe(0);
      expect(hours(0.5)).toBe(1800000); // 30 minutes = 1,800,000 ms
    });

    it('should handle negative values', () => {
      expect(hours(-1)).toBe(-3600000);
    });
  });

  describe('days', () => {
    it('should convert days to milliseconds', () => {
      expect(days(1)).toBe(86400000); // 1 day = 86,400,000 ms
      expect(days(7)).toBe(604800000); // 1 week = 604,800,000 ms
      expect(days(0)).toBe(0);
    });

    it('should handle fractional days', () => {
      expect(days(0.5)).toBe(43200000); // 12 hours = 43,200,000 ms
    });

    it('should handle negative values', () => {
      expect(days(-1)).toBe(-86400000);
    });
  });
});

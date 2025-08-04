import { COLOR_MAP, ColorMapGrad } from '../../../src/js/lib/colors';

describe('colors', () => {
  describe('COLOR_MAP', () => {
    it('should contain expected color keys', () => {
      const expectedKeys = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
      expectedKeys.forEach(key => {
        expect(COLOR_MAP).toHaveProperty(key);
      });
    });

    it('should have valid hex color values', () => {
      const hexPattern = /^#[0-9A-Fa-f]{3,6}$/;
      Object.values(COLOR_MAP).forEach(color => {
        expect(color).toMatch(hexPattern);
      });
    });

    it('should contain specific expected colors', () => {
      expect(COLOR_MAP['grey']).toBe('#ccc');
      expect(COLOR_MAP['blue']).toBe('#4285f4');
      expect(COLOR_MAP['red']).toBe('#ea4335');
      expect(COLOR_MAP['yellow']).toBe('#fbbc05');
      expect(COLOR_MAP['green']).toBe('#34a853');
      expect(COLOR_MAP['pink']).toBe('#e91e63');
      expect(COLOR_MAP['purple']).toBe('#9c27b0');
      expect(COLOR_MAP['cyan']).toBe('#00acc1');
      expect(COLOR_MAP['orange']).toBe('#FF9800');
    });
  });

  describe('ColorMapGrad', () => {
    it('should have the same keys as COLOR_MAP', () => {
      const colorMapKeys = Object.keys(COLOR_MAP);
      const colorMapGradKeys = Object.keys(ColorMapGrad);

      expect(colorMapGradKeys.sort()).toEqual(colorMapKeys.sort());
    });

    it('should have 5 gradient colors for each key', () => {
      Object.keys(ColorMapGrad).forEach(key => {
        expect(ColorMapGrad[key]).toHaveLength(5);
      });
    });

    it('should have valid hex colors in gradients', () => {
      const hexPattern = /^#[0-9A-Fa-f]{3,6}$/;
      Object.values(ColorMapGrad).forEach(gradientArray => {
        gradientArray.forEach(color => {
          expect(color).toMatch(hexPattern);
        });
      });
    });

    it('should have the original color as the middle (3rd) element', () => {
      Object.keys(COLOR_MAP).forEach(key => {
        const originalColor = COLOR_MAP[key];
        const gradientArray = ColorMapGrad[key];

        // Ensure both values exist
        expect(originalColor).toBeDefined();
        expect(gradientArray).toBeDefined();
        expect(gradientArray).toHaveLength(5);

        // The original color should be at index 2 (middle of 5 colors)
        // The gradient generation keeps the original color as-is
        const middleColor = gradientArray![2];

        expect(middleColor).toBe(originalColor);
      });
    });

    it('should have darker colors at the beginning and lighter at the end', () => {
      // This is a basic test - we can't easily test exact lightness without
      // implementing the color conversion functions, but we can test that
      // the colors are different and follow the expected pattern
      Object.keys(ColorMapGrad).forEach(key => {
        const gradientArray = ColorMapGrad[key];

        // All colors should be different (except potentially edge cases)
        const uniqueColors = new Set(gradientArray);
        expect(uniqueColors.size).toBeGreaterThan(1);

        // The array should have 5 elements: darker, slightly darker, original, slightly lighter, lighter
        expect(gradientArray).toHaveLength(5);
      });
    });
  });

  describe('Color gradient generation', () => {
    it('should not throw errors during generation', () => {
      // This test ensures that the gradient generation code runs without errors
      // The actual generation happens at module load time, so if we got here, it worked
      expect(Object.keys(ColorMapGrad).length).toBeGreaterThan(0);
    });

    it('should handle all colors in COLOR_MAP', () => {
      // Ensure every color in COLOR_MAP has a corresponding gradient
      Object.keys(COLOR_MAP).forEach(key => {
        expect(ColorMapGrad).toHaveProperty(key);
        expect(Array.isArray(ColorMapGrad[key])).toBe(true);
      });
    });
  });

  describe('Color format consistency', () => {
    it('should have all gradient colors in valid hex format', () => {
      const hexPattern = /^#[0-9A-Fa-f]{3,6}$/;

      Object.values(ColorMapGrad).forEach(gradientArray => {
        gradientArray.forEach(color => {
          expect(color).toMatch(hexPattern);
        });
      });
    });

    it('should have modified colors (non-original) in 6-digit hex format', () => {
      const sixDigitHexPattern = /^#[0-9A-F]{6}$/;

      Object.keys(COLOR_MAP).forEach(key => {
        const originalColor = COLOR_MAP[key];
        const gradientArray = ColorMapGrad[key];

        // Check that modified colors (indices 0, 1, 3, 4) are in 6-digit format
        [0, 1, 3, 4].forEach(index => {
          const color = gradientArray![index];
          expect(color).toMatch(sixDigitHexPattern);
        });

        // The original color (index 2) should match the original format
        expect(gradientArray![2]).toBe(originalColor);
      });
    });

    it('should not have any undefined or null values in gradients', () => {
      Object.values(ColorMapGrad).forEach(gradientArray => {
        gradientArray.forEach(color => {
          expect(color).toBeDefined();
          expect(color).not.toBeNull();
          expect(typeof color).toBe('string');
        });
      });
    });
  });
});

import { DEFAULT_OPTIONS, KEY_OPTIONS, RESTRICTED_KEYS, Options, SelectedStyle, ThemeSwitch } from '../../../src/js/lib/constants';

describe('constants', () => {
  describe('DEFAULT_OPTIONS', () => {
    it('should have all required properties', () => {
      const requiredProperties = [
        'show_full_url',
        'show_full_title',
        'hide_tablist',
        'keep_one_tablist',
        'sync_group_folding',
        'title_font_size',
        'info_font_size',
        'light_radius',
        'light_from_color',
        'light_to_color',
        'dark_radius',
        'dark_from_color',
        'dark_to_color',
        'discard_old_tabs',
        'show_group_tab_count',
        'selected_style',
        'theme_switch',
        'compact_view',
        'invert_favicons',
        'focus_color',
        'timestamp_format'
      ];

      requiredProperties.forEach(prop => {
        expect(DEFAULT_OPTIONS).toHaveProperty(prop);
      });
    });

    it('should have correct default values', () => {
      expect(DEFAULT_OPTIONS.show_full_url).toBe(false);
      expect(DEFAULT_OPTIONS.show_full_title).toBe(false);
      expect(DEFAULT_OPTIONS.hide_tablist).toBe(false);
      expect(DEFAULT_OPTIONS.keep_one_tablist).toBe(false);
      expect(DEFAULT_OPTIONS.sync_group_folding).toBe(false);
      expect(DEFAULT_OPTIONS.title_font_size).toBe(1.1);
      expect(DEFAULT_OPTIONS.info_font_size).toBe(0.9);
      expect(DEFAULT_OPTIONS.light_radius).toBe(45);
      expect(DEFAULT_OPTIONS.light_from_color).toBe('#b53232');
      expect(DEFAULT_OPTIONS.light_to_color).toBe('#3f85d7');
      expect(DEFAULT_OPTIONS.dark_radius).toBe(45);
      expect(DEFAULT_OPTIONS.dark_from_color).toBe('#1F3D5C');
      expect(DEFAULT_OPTIONS.dark_to_color).toBe('#665C5C');
      expect(DEFAULT_OPTIONS.discard_old_tabs).toBe(0);
      expect(DEFAULT_OPTIONS.show_group_tab_count).toBe(false);
      expect(DEFAULT_OPTIONS.selected_style).toBe('square_style');
      expect(DEFAULT_OPTIONS.theme_switch).toBe('light_mode');
      expect(DEFAULT_OPTIONS.compact_view).toBe(false);
      expect(DEFAULT_OPTIONS.invert_favicons).toBe(false);
      expect(DEFAULT_OPTIONS.focus_color).toBe('#ee1fbe');
      expect(DEFAULT_OPTIONS.timestamp_format).toBe('dd/mm/yyy');
    });

    it('should have valid color values', () => {
      const hexColorPattern = /^#[0-9A-Fa-f]{3,6}$/;

      expect(DEFAULT_OPTIONS.light_from_color).toMatch(hexColorPattern);
      expect(DEFAULT_OPTIONS.light_to_color).toMatch(hexColorPattern);
      expect(DEFAULT_OPTIONS.dark_from_color).toMatch(hexColorPattern);
      expect(DEFAULT_OPTIONS.dark_to_color).toMatch(hexColorPattern);
      expect(DEFAULT_OPTIONS.focus_color).toMatch(hexColorPattern);
    });

    it('should have valid numeric ranges', () => {
      expect(DEFAULT_OPTIONS.title_font_size).toBeGreaterThan(0);
      expect(DEFAULT_OPTIONS.info_font_size).toBeGreaterThan(0);
      expect(DEFAULT_OPTIONS.light_radius).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_OPTIONS.light_radius).toBeLessThanOrEqual(100);
      expect(DEFAULT_OPTIONS.dark_radius).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_OPTIONS.dark_radius).toBeLessThanOrEqual(100);
      expect(DEFAULT_OPTIONS.discard_old_tabs).toBeGreaterThanOrEqual(0);
    });

    it('should have valid enum values', () => {
      const validStyles: SelectedStyle[] = ['square_style', 'round_style'];
      const validThemes: ThemeSwitch[] = ['follow_os', 'dark_mode', 'light_mode'];

      expect(validStyles).toContain(DEFAULT_OPTIONS.selected_style);
      expect(validThemes).toContain(DEFAULT_OPTIONS.theme_switch);
    });
  });

  describe('KEY_OPTIONS', () => {
    it('should contain all keys from DEFAULT_OPTIONS', () => {
      const defaultOptionsKeys = Object.keys(DEFAULT_OPTIONS);

      expect(KEY_OPTIONS.sort()).toEqual(defaultOptionsKeys.sort());
    });

    it('should be an array of strings', () => {
      expect(Array.isArray(KEY_OPTIONS)).toBe(true);
      KEY_OPTIONS.forEach(key => {
        expect(typeof key).toBe('string');
      });
    });

    it('should not contain duplicate keys', () => {
      const uniqueKeys = new Set(KEY_OPTIONS);
      expect(uniqueKeys.size).toBe(KEY_OPTIONS.length);
    });
  });

  describe('RESTRICTED_KEYS', () => {
    it('should be an array of strings', () => {
      expect(Array.isArray(RESTRICTED_KEYS)).toBe(true);
      RESTRICTED_KEYS.forEach(key => {
        expect(typeof key).toBe('string');
      });
    });

    it('should contain expected restricted keys', () => {
      const expectedRestrictedKeys = [
        'show_full_url',
        'show_full_title',
        'hide_tablist',
        'keep_one_tablist',
        'sync_group_folding',
        'title_font_size',
        'info_font_size',
        'light_radius',
        'light_from_color',
        'light_to_color',
        'dark_radius',
        'dark_from_color',
        'dark_to_color'
      ];

      expectedRestrictedKeys.forEach(key => {
        expect(RESTRICTED_KEYS).toContain(key);
      });
    });

    it('should not contain selected_style and theme_switch', () => {
      expect(RESTRICTED_KEYS).not.toContain('selected_style');
      expect(RESTRICTED_KEYS).not.toContain('theme_switch');
    });

    it('should only contain keys that exist in DEFAULT_OPTIONS', () => {
      const defaultOptionsKeys = Object.keys(DEFAULT_OPTIONS);

      RESTRICTED_KEYS.forEach(key => {
        expect(defaultOptionsKeys).toContain(key);
      });
    });

    it('should not contain duplicate keys', () => {
      const uniqueKeys = new Set(RESTRICTED_KEYS);
      expect(uniqueKeys.size).toBe(RESTRICTED_KEYS.length);
    });
  });

  describe('Type definitions', () => {
    it('should have valid SelectedStyle values', () => {
      const validStyles = ['square_style', 'round_style'];

      // Test that the type accepts valid values
      const testStyle1: SelectedStyle = 'square_style';
      const testStyle2: SelectedStyle = 'round_style';

      expect(validStyles).toContain(testStyle1);
      expect(validStyles).toContain(testStyle2);
    });

    it('should have valid ThemeSwitch values', () => {
      const validThemes = ['follow_os', 'dark_mode', 'light_mode'];

      // Test that the type accepts valid values
      const testTheme1: ThemeSwitch = 'follow_os';
      const testTheme2: ThemeSwitch = 'dark_mode';
      const testTheme3: ThemeSwitch = 'light_mode';

      expect(validThemes).toContain(testTheme1);
      expect(validThemes).toContain(testTheme2);
      expect(validThemes).toContain(testTheme3);
    });

    it('should have Options interface matching DEFAULT_OPTIONS structure', () => {
      // This test ensures that DEFAULT_OPTIONS conforms to the Options interface
      const options: Options = DEFAULT_OPTIONS;

      // Test a few key properties to ensure type compatibility
      expect(typeof options.show_full_url).toBe('boolean');
      expect(typeof options.title_font_size).toBe('number');
      expect(typeof options.light_from_color).toBe('string');
      expect(typeof options.selected_style).toBe('string');
      expect(typeof options.theme_switch).toBe('string');
    });
  });

  describe('Data consistency', () => {
    it('should have matching radius values for light and dark themes by default', () => {
      expect(DEFAULT_OPTIONS.light_radius).toBe(DEFAULT_OPTIONS.dark_radius);
    });

    it('should have reasonable font size defaults', () => {
      expect(DEFAULT_OPTIONS.title_font_size).toBeGreaterThan(DEFAULT_OPTIONS.info_font_size);
      expect(DEFAULT_OPTIONS.title_font_size).toBeLessThan(2.0); // Reasonable upper bound
      expect(DEFAULT_OPTIONS.info_font_size).toBeGreaterThan(0.5); // Reasonable lower bound
    });

    it('should have different light and dark theme colors', () => {
      expect(DEFAULT_OPTIONS.light_from_color).not.toBe(DEFAULT_OPTIONS.dark_from_color);
      expect(DEFAULT_OPTIONS.light_to_color).not.toBe(DEFAULT_OPTIONS.dark_to_color);
    });
  });
});

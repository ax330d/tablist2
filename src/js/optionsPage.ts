// options.ts

import { normalizeHexRGB } from './lib/utils';
import { Options, SelectedStyle, ThemeSwitch, DEFAULT_OPTIONS, RESTRICTED_KEYS } from './lib/constants';
import { showPopup } from './lib/popup';
import { logError } from './lib/logging';

const E_TYPE = 'OptionsManager';

const HEX_KEYS = [
  'light-from-color-hex',
  'light-to-color-hex',
  'dark-from-color-hex',
  'dark-to-color-hex',
] as const;

const CHECKBOX_KEYS = [
  'show-full-url',
  'show-full-title',
  'hide-tablist',
  'keep-one-tablist',
  'sync-group-folding',
] as const;

type CheckboxKey = typeof CHECKBOX_KEYS[number];

type BooleanKeys = 'show_full_url' | 'show_full_title' | 'hide_tablist' | 'keep_one_tablist' | 'sync_group_folding';

/**
 * Sets the theme styles on the document's root element by applying CSS variables and a color mode.
 * @param fromColor - The starting color of the background gradient.
 * @param toColor - The ending color of the background gradient.
 * @param radius - The angle of the gradient in degrees.
 * @param colorMode - The color mode to set ('light' or 'dark').
 */
function setThemeStyles(fromColor: string, toColor: string, radius: number, colorMode: 'light' | 'dark'): void {
  const root = document.documentElement;
  root.style.setProperty('--bg-gradient-start', fromColor);
  root.style.setProperty('--bg-gradient-end', toColor);
  root.style.setProperty('--bg-gradient-deg', `${radius}deg`);
  root.setAttribute('color-mode', colorMode);
}

function convertIdToKey(elementId: string): string {
  return elementId.replace(/-/g, '_');
}

function convertUnderscoresToHyphens(text: string): string {
  return text.replace(/_/g, '-');
}

function isBooleanKey(key: keyof Options): key is BooleanKeys {
  const booleanKeys: BooleanKeys[] = CHECKBOX_KEYS.map(k => convertIdToKey(k) as BooleanKeys);
  return booleanKeys.includes(key as BooleanKeys);
}

function getSelectedRadioValue(radioName: string): SelectedStyle | ThemeSwitch | null {
  const radios = document.getElementsByName(radioName) as NodeListOf<HTMLInputElement>;
  for (const radio of radios) {
    if (radio.checked) return radio.value as SelectedStyle | ThemeSwitch;
  }
  return null;
}

function setRadioCheckedByValue(radioName: string, value: string): void {
  const radios = document.getElementsByName(radioName) as NodeListOf<HTMLInputElement>;
  for (const radio of radios) {
    radio.checked = radio.value === value;
  }
}

function setChecked(elementId: string, value: any): void {
  const element = document.getElementById(elementId) as HTMLInputElement | null;
  if (!element) {
    logError('[setChecked]', `Element with ID ${elementId} does not exist!`);
    return;
  }
  switch (element.type) {
    case 'checkbox':
      element.checked = !!value;
      break;
    case 'number':
    case 'range':
      element.value = parseFloat(value).toString();
      break;
    case 'color':
    case 'text':
      element.value = value.toString();
      break;
    default:
      logError('[setChecked]', `Unhandled input type: ${element.type}!`);
      break;
  }
}

function createSliderTooltip(elementId: string): void {
  const slider = document.getElementById(elementId) as HTMLInputElement | null;
  if (!slider) {
    logError('[createSliderTooltip]', 'Element does not exist!');
    return;
  }
  const tooltip = document.createElement('div');
  tooltip.className = 'slider-tooltip';
  tooltip.style.position = 'absolute';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  slider.addEventListener('mousemove', (e: MouseEvent) => {
    tooltip.textContent = slider.value;
    tooltip.style.left = `${e.pageX + 10}px`;
    tooltip.style.top = `${e.pageY + 10}px`;
    tooltip.style.display = 'block';
  });
  slider.addEventListener('mouseleave', () => tooltip.style.display = 'none');
  slider.addEventListener('input', (e: Event) => {
    tooltip.textContent = (e.target as HTMLInputElement).value;
  });
}

function getOptionValue<K extends keyof Options>(elementId: string): Options[K] {
  const key = convertIdToKey(elementId) as K;
  const elem = document.getElementById(elementId) as HTMLInputElement | null;
  if (!elem) {
    logError('[getOptionValue]', `Element with ID ${elementId} does not exist!`);
    return DEFAULT_OPTIONS[key];
  }
  switch (elem.type) {
    case 'checkbox':
      return elem.checked as Options[K];
    case 'number':
    case 'range':
      return (parseFloat(elem.value) || DEFAULT_OPTIONS[key]) as Options[K];
    case 'color':
    case 'text':
    case 'radio':
      return (elem.value || DEFAULT_OPTIONS[key]) as Options[K];
    default:
      logError('[getOptionValue]', `Unhandled input type for ${elementId}: ${elem.type}`);
      return DEFAULT_OPTIONS[key];
  }
}

class OptionsManager {
  private options: Options;

  constructor() {
    this.options = { ...DEFAULT_OPTIONS }; // Initialize with defaults
    this.initialize();
  }

  /**
   * Gets the current options from the form.
   */
  public getCurrentOptions(): Options {
    const opts: Partial<Options> = {
      selected_style: (getSelectedRadioValue('style_option') || DEFAULT_OPTIONS.selected_style) as SelectedStyle,
      // Not using theme_switch on this page
      theme_switch: (this.options.theme_switch || DEFAULT_OPTIONS.theme_switch) as ThemeSwitch,
      discard_old_tabs: this.options.discard_old_tabs || 0,
      compact_view: this.options.compact_view || false,
      show_group_tab_count: this.options.show_group_tab_count || false,
    };

    RESTRICTED_KEYS.forEach((key) => {
      (opts[key as keyof Options] as string | number | boolean) = getOptionValue(convertUnderscoresToHyphens(key));
    });

    return opts as Options;
  }

  /**
   * Saves the current options to Chrome storage.
   */
  public async saveOptions(): Promise<void> {
    const opts = this.getCurrentOptions();
    try {
      await chrome.storage.sync.set(opts);
      this.options = opts; // Update local state
    } catch (error) {
      logError(E_TYPE, 'Error saving options:', error);
    }
  }

  /**
   * Applies the user-selected theme.
   */
  public checkUserTheme(opts: Options): void {
    const themeSwitch: ThemeSwitch = this.options.theme_switch;
    if (themeSwitch === 'follow_os') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        this.enableDarkTheme(opts);
      } else {
        this.enableLightTheme(opts);
      }
    } else if (themeSwitch === 'dark_mode') {
      this.enableDarkTheme(opts);
    } else {
      this.enableLightTheme(opts);
    }
  }

  private async initialize(): Promise<void> {
    // Load saved options
    try {
      const savedOpts = (await chrome.storage.sync.get(DEFAULT_OPTIONS)) as Options;
      this.options = { ...this.options, ...savedOpts };
    } catch (error) {
      logError(E_TYPE, 'Error loading options:', error);
    }

    // Initialize UI
    this.setupUI();
    this.checkUserTheme(this.options);

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'sync' && changes['theme_switch']) {
        this.options.theme_switch = changes['theme_switch'].newValue;
        this.checkUserTheme(this.options);
      }
    });
  }

  private setupUI(): void {
    // Set initial values
    RESTRICTED_KEYS.forEach((optName) => {
      setChecked(convertUnderscoresToHyphens(optName), this.options[optName as keyof Options]);
    });

    this.setupColorPickers(this.options);

    createSliderTooltip('light-radius');
    createSliderTooltip('dark-radius');
    setRadioCheckedByValue('style_option', this.options.selected_style);

    // Event listeners
    this.setupEventListeners();

    const footerButtons = [
      { id: 'footer-help', popup: 'menu-help' },
      { id: 'footer-about', popup: 'menu-about' },
    ];
    footerButtons.forEach(({ id, popup }) => {
      const btn = document.getElementById(id) as HTMLElement | null;
      btn?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          showPopup(popup, btn);
        }
      });
      btn?.addEventListener('click', (e: Event) => {
        e.preventDefault();
        showPopup(popup, btn);
      });
    });
  }

  private setupColorPickers (opts: Options) {
    HEX_KEYS.forEach((optName) => {
      const uk = convertIdToKey(optName).substring(0, optName.length - 4) as keyof Options;
      setChecked(optName, (opts[uk] as string).toUpperCase());
    });
  }

  private setupEventListeners(): void {
    const restoreBtn = document.getElementById('restore-defaults') as HTMLButtonElement | null;
    restoreBtn?.addEventListener('click', async () => {
      if (!confirm('Are you sure you want to restore default settings?')) return;
      try {
        await chrome.storage.sync.set(DEFAULT_OPTIONS);
        this.options = { ...DEFAULT_OPTIONS };
        this.setupUI();
        this.checkUserTheme(this.options);
      } catch (error) {
        logError(E_TYPE, 'Error restoring defaults:', error);
      }
    });

    document.querySelectorAll<HTMLInputElement>("input[type='number'], input[type='color'], input[type='range']")
      .forEach((input) => {
        input.addEventListener('input', () => {
          const currOpts = this.getCurrentOptions();
          this.checkUserTheme(currOpts);
          this.setupColorPickers(currOpts);
        });
        input.addEventListener('change', async () => await this.saveOptions());
      });

    document.querySelectorAll<HTMLInputElement>("input[type='text']").forEach((input) => {
      input.addEventListener('input', () => {
        if (input.id.endsWith('-hex')) {
          const colorId = input.id.substring(0, input.id.length - 4);
          const colorElem = document.getElementById(colorId) as HTMLInputElement | null;
          if (colorElem) {
            try {
              colorElem.value = normalizeHexRGB(input.value);
              input.parentElement!.classList.remove('error');
            } catch (e) {
              input.parentElement!.classList.add('error');
            }
          }
        }
      });
      input.addEventListener('change', async () => await this.saveOptions());
    });

    CHECKBOX_KEYS.forEach((key: CheckboxKey) => {
      const elem = document.getElementById(key) as HTMLInputElement | null;
      elem?.addEventListener('click', async () => {
        try {
          const value = getOptionValue(key);
          const keyConverted = convertIdToKey(key) as keyof Options;
          await chrome.storage.sync.set({ [keyConverted]: value });
          if (isBooleanKey(keyConverted)) {
            this.options[keyConverted] = value as boolean; // TypeScript knows this is boolean
          } else {
            throw new Error(`Unexpected non-boolean key: ${keyConverted}`);
          }
        } catch (error) {
          logError(E_TYPE, `Error updating ${key}:`, error);
        }
      });
    });

    const radios = document.querySelectorAll<HTMLInputElement>('input[name="style_option"]') as NodeListOf<HTMLInputElement>;
    radios.forEach((radio) => {
      radio.addEventListener('change', async () => {
        if (radio.checked) {
          await chrome.storage.sync.set({ selected_style: radio.value });
          this.options.selected_style = radio.value as SelectedStyle;
        }
      });
    });
  }

  /**
   * Enables the light theme by setting CSS variables and the color mode attribute.
   * @private
   */
  private enableLightTheme(opts: Options): void {
    setThemeStyles(
      opts.light_from_color,
      opts.light_to_color,
      opts.light_radius,
      'light'
    );
  }

  /**
   * Enables the dark theme by setting CSS variables and the color mode attribute.
   * @private
   */
  private enableDarkTheme(opts: Options): void {
    setThemeStyles(
      opts.dark_from_color,
      opts.dark_to_color,
      opts.dark_radius,
      'dark'
    );
  }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => new OptionsManager());
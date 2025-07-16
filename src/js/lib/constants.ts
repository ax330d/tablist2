
export type SelectedStyle = 'square_style' | 'round_style';
export type ThemeSwitch = 'follow_os' | 'dark_mode' | 'light_mode';

/**
 * Interface defining the structure of the extension's options.
 */
export interface Options {
  show_full_url: boolean;
  show_full_title: boolean;
  hide_tablist: boolean;
  keep_one_tablist: boolean;
  sync_group_folding: boolean;
  title_font_size: number;
  info_font_size: number;
  light_radius: number;
  light_from_color: string;
  light_to_color: string;
  dark_radius: number;
  dark_from_color: string;
  dark_to_color: string;

  show_group_tab_count: boolean;
  discard_old_tabs: number;
  selected_style: SelectedStyle;
  theme_switch: ThemeSwitch;
  compact_view: boolean;
  invert_favicons: boolean;
  focus_color: string;
  timestamp_format: string;
}

/**
 * Default options for the extension.
 */
export const DEFAULT_OPTIONS: Options = {
  show_full_url: false,
  show_full_title: false,
  hide_tablist: false,
  keep_one_tablist: false,
  sync_group_folding: false,
  title_font_size: 1.1,
  info_font_size: 0.9,
  light_radius: 45,
  light_from_color: '#b53232',
  light_to_color: '#3f85d7',
  dark_radius: 45,
  dark_from_color: '#1F3D5C',
  dark_to_color: '#665C5C',
  // TODO: Discard tabs that are older than N days
  discard_old_tabs: 0,

  show_group_tab_count: false,
  selected_style: 'square_style',
  theme_switch: 'light_mode',
  // TODO: ...
  compact_view: false,
  invert_favicons: false,
  focus_color: '#ee1fbe',
  timestamp_format: 'dd/mm/yyy',
};

// Keys w/o selected_style, theme_switch
export const RESTRICTED_KEYS = [
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
];

/**
 * Array of keys from DEFAULT_OPTIONS for easy iteration.
 */
export const KEY_OPTIONS: string[] = Object.keys(DEFAULT_OPTIONS);

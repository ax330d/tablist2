import { Options } from './constants';
import { DEBUG, logError, logInfo } from './logging';
import { showPopup } from './popup';
import { TabManager } from './TabManager';

const E_TYPE = 'UIManager';

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

export class UIManager {
  private options: Options;
  private container: HTMLElement | null = null;
  private tabManager: TabManager | null = null;
  public localChange = false;

  constructor(options: Options) {
    this.options = options;
    this.localChange = false;

    // Re-apply styles whenever theme_switch changes in sync storage :contentReference[oaicite:5]{index=5}
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync' && changes['theme_switch']) {
        this.options.theme_switch = changes['theme_switch'].newValue as Options['theme_switch'];
        this.checkStyles();
        this.checkUserTheme();
      }
    });
  }

  public checkStyles(): void {
    const root = document.documentElement;
    root.style.setProperty('--dynamic-font-size-title', `${this.options.title_font_size.toFixed(2)}rem`);
    root.style.setProperty('--dynamic-font-size-info',  `${this.options.info_font_size.toFixed(2)}rem`);

    switch (this.options.theme_switch) {
      case 'follow_os':
        window.matchMedia('(prefers-color-scheme: dark)').matches
          ? this.enableDarkTheme()
          : this.enableLightTheme();
        break;
      case 'dark_mode':
        this.enableDarkTheme();
        break;
      default:
        this.enableLightTheme();
    }

    const style = this.options.selected_style;
    if (style === 'square_style' || style === 'round_style') {
      root.setAttribute('ui-style', style);
    } else {
      logError(E_TYPE, `No such style: ${style}!`);
    }

    this.options.compact_view
      ? root.setAttribute('ui-view', 'compact')
      : root.removeAttribute('ui-view');
  }

  public checkUserTheme(): void {
    document.querySelectorAll('.mode-item').forEach(label => label.classList.remove('selected'));
    const label = document.querySelector(`label[for="${this.options.theme_switch}"]`) as HTMLElement | null;
    if (label) label.classList.add('selected');
    document.body.classList.remove('preload');
  }

  public initializeToggleButton(): void {
    document.querySelectorAll<HTMLInputElement>('input[name="theme_switch"]')
      .forEach(radio => radio.addEventListener('change', () => {
        if (!radio.checked) return;
        // the onChanged handler will pick this up and re-apply styles/UI
        chrome.storage.sync.set({ theme_switch: radio.value });
        this.localChange = true;
        localStorage.setItem('theme_switch', radio.value);
      }));
  }

  /**
   * Sets up the UI by initializing the container, tab manager, and event listeners for footer buttons and header interactions.
   * @param container - The HTML element that will contain the tab list.
   * @param tabManager - The TabManager instance for managing tab lines.
   * @throws {Error} Throws an error if the container is not set.
   */
  public setupUI(container: HTMLElement, tabManager: TabManager): void {
    this.container = container;
    this.tabManager = tabManager;

    if (!this.container) throw new Error('Container not set for setupUI');
    this.container.setAttribute('role', 'list');

    const footerButtons = [
      { id: 'footer-help', popup: 'menu-help' },
      { id: 'footer-about', popup: 'menu-about' },
      { id: 'footer-a11y', popup: 'menu-a11y' },
      { id: 'footer-options', action: () => this.openOptions() },
      { id: 'page-scroll-up', action: () => this.scrollUp() },
      { id: 'page-scroll-down', action: () => this.scrollDown() },
      { id: 'go-to-recent', action: () => this.goToRecentTab() },
    ];
    if (DEBUG) {
      footerButtons.push({ id: 'footer-check', action: () => this.checkIntegrity() });
    }

    footerButtons.forEach(({ id, popup, action }) => {
      const btn = document.getElementById(id) as HTMLElement | null;
      btn?.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          popup ? showPopup(popup, btn) : action?.();
        }
      });
      btn?.addEventListener('click', (e: Event) => {
        e.preventDefault();
        popup ? showPopup(popup, btn) : action?.();
      });
    });

    const headerText = document.getElementById('headerText') as HTMLElement | null;
    if (headerText && this.tabManager) {
      headerText.style.transition = 'opacity 0.5s ease';
      const header = document.getElementById('header');
      header?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') {
          return;
        }
        this.headerShowInfo(headerText);
        setTimeout(() => {
          this.headerHideInfo(headerText);
        }, 2_000);
      });
      header?.addEventListener('mouseenter', () => {
        this.headerShowInfo(headerText);
      });
      header?.addEventListener('mouseleave', () => {
        this.headerHideInfo(headerText);
      });
    } else if (!headerText) {
      logError(E_TYPE, 'No header text!');
    }
  }

  private openOptions () {
    location.href = chrome.runtime.getURL('options.html');
  }

  private scrollUp () {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  private scrollDown () {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: 'smooth'
    });
  }

  private goToRecentTab () {
    if (this.tabManager?.recentActiveTabId) {
      const element = document.querySelector(`[data-tab-id="${this.tabManager.recentActiveTabId}"]`);
      if (element && element.parentElement) {
        const parent = element.parentElement;
        const isInGroup = parent.classList.contains('tab-group-content') || false;
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        if (isInGroup) {
          if (parent.parentElement?.classList.contains('collapsed')) {
            (parent.parentElement?.firstElementChild as HTMLElement)?.click();
          }
        }
        element.classList.add('flash');
        setTimeout(() => {
          element.classList.remove('flash');
        }, 5000);
        return;
      }
    }

    this.scrollDown();
  }

  private headerShowInfo (headerText: HTMLElement) {
    if (!headerText.dataset['originalText']) {
      headerText.dataset['originalText'] = headerText.textContent || '';
    }
    headerText.style.opacity = '0';
    setTimeout(() => {
      headerText.textContent = `${this.tabManager?.tabCount} tabs opened`;
      headerText.style.opacity = '1';
    }, 300);
  }

  private headerHideInfo (headerText: HTMLElement) {
    headerText.style.opacity = '0';
    setTimeout(() => {
      headerText.textContent = headerText.dataset['originalText'] || '';
      headerText.style.opacity = '1';
    }, 300);
  }

  private enableLightTheme(): void {
    setThemeStyles(
      this.options.light_from_color,
      this.options.light_to_color,
      this.options.light_radius,
      'light'
    );
  }

  private enableDarkTheme(): void {
    setThemeStyles(
      this.options.dark_from_color,
      this.options.dark_to_color,
      this.options.dark_radius,
      'dark'
    );
  }

  /**
   * Sets up a MutationObserver to maintain scroll position when the container's content changes.
   * @param container - The HTML element to observe for changes.
   */
  public setObserver(container: HTMLElement): void {
    const currentScrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const observer = new MutationObserver((_mutations, obs) => {
      if (container.childElementCount > 0) {
        window.scrollTo({ top: currentScrollTop, left: 0, behavior: 'instant' });
        obs.disconnect();
      }
    });
    observer.observe(container, { childList: true });
  }

  /**
   * Performs an integrity check to ensure the DOM matches the current tabs, reporting any discrepancies.
   * @throws {Error} Throws an error if the container or TabManager is not set.
   * @private
   */
  private checkIntegrity(): void {
    if (!this.container || !this.tabManager) throw new Error('Container or TabManager not set');
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      const errors: string[] = [];
      const domElements = Array.from(this.container!.querySelectorAll('.data-container')) as HTMLElement[];

      tabs.sort((a, b) => a.index - b.index).forEach((tab, i) => {
        const tabElement = domElements.find((el) => el.dataset['tabId'] === String(tab.id));
        const domTabIndex = tabElement?.dataset['tabIndex'];
        if (parseInt(domTabIndex || '', 10) !== tab.index) {
          errors.push(`Tab ${tab.id} has wrong DOM tabindex: ${domTabIndex} vs ${tab.index}`);
        }

        if (!tabElement) {
          errors.push(`Tab ${tab.id} not found in DOM. URL: ${tab.url}`);
        } else if (domElements.indexOf(tabElement) !== i) {
          errors.push(
            `Tab ${tab.id} index mismatch: DOM index = ${domElements.indexOf(tabElement)}, expected = ${i}`
          );
        }
      });

      const footerCheck = document.querySelector('#footer-check') as HTMLElement | null;
      if (errors.length > 0) {
        logError('[checkIntegrity]', 'Integrity check errors:', errors);
        if (footerCheck) footerCheck.style.color = 'red';
        alert('IC Error!');
      } else {
        logInfo('[checkIntegrity]', 'Integrity check passed.');
        if (footerCheck) footerCheck.style.color = 'green';
      }
    });
  }
}

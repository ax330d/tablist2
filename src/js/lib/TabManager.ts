// tabManager.ts
import { Options } from './constants';
import { FaviconHandler } from './Favicons';
import { GroupManager } from './GroupManager';
import { logError, logInfo } from './logging';
import { isSecureUrl, days, isOwnUrl } from './utils';

const E_TYPE = 'TabManager';

/**
 * Manages the creation and rendering of tab lines in a Chrome extension.
 * This class is responsible for creating, updating, and handling interactions with tab lines,
 * which represent individual tabs in the extension's UI.
 */
export class TabManager {
  private favHandler: FaviconHandler;
  private container: HTMLElement;
  private options: Options;
  public tabCount: number = 0;
  private currentOpenTabLine: HTMLElement | null = null;
  public recentActiveTabId: number;
  private recentActiveTime: number;
  private lastTimestamp = 0;
  /**
   * Creates a new TabManager instance.
   * @param container - The HTML element that will contain the tab lines.
   * @param options - Configuration options for tab rendering and behavior.
   */
  constructor(container: HTMLElement, options: Options) {
    this.container = container;
    this.options = options;

    this.recentActiveTabId = 0;
    this.recentActiveTime = 0;
    this.favHandler = new FaviconHandler();
  }

  /**
   * Creates a new tab line element for a given Chrome tab.
   * @param tab - The Chrome tab to create a line for.
   * @returns The created tab line element, or `null` if the template is not found.
   */
  public async createTabLine(tab: chrome.tabs.Tab): Promise<HTMLElement | null> {
    const template = document.querySelector('#line-template') as HTMLTemplateElement | null;
    if (!template) return null;

    const timestamp = Date.now();
    if (this.options.discard_old_tabs > 0 && !tab.discarded && tab.lastAccessed) {
      if (timestamp - days(this.options.discard_old_tabs) > tab.lastAccessed) {
        chrome.tabs.discard(tab.id).catch((err) => logError(E_TYPE, err));
        logInfo(E_TYPE, `Auto discarded old tab: ${tab.lastAccessed} - ${tab.url}`);
      }
    }

    const tabLine = template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    tabLine.setAttribute('tabindex', '0');
    tabLine.dataset['tabId'] = tab.id!.toString();
    tabLine.dataset['tabIndex'] = tab.index.toString();

    tabLine.querySelector('.drag-handle')?.setAttribute('draggable', 'true');
    await this.updateTabContent(tabLine, tab);
    this.setupTabActions(tabLine);

    if (tab.url && isOwnUrl(tab.url) && this.options.hide_tablist) {
      tabLine.classList.add('hidden');
    }
    if (!this.options.show_full_title) {
      tabLine.querySelector('.text-container-title')?.classList.add('hide-text-overflow');
    }
    if (!this.options.show_full_url) {
      tabLine.querySelector('.tab-url-time')?.classList.add('hide-text-overflow');
    }

    this.tabCount++;

    return tabLine;
  }

  /**
   * Updates the content of a tab line element based on the tab's properties.
   * @param tabLine - The tab line element to update.
   * @param tab - The Chrome tab containing the updated information.
   * @param changeInfo - Optional change information for partial updates (e.g., favicon or status).
   */
  public async updateTabContent(
    tabLine: HTMLElement,
    tab: chrome.tabs.Tab,
    changeInfo: chrome.tabs.TabChangeInfo | null = null
  ): Promise<void> {
    const selectors = {
      title: '.text-container-title',
      url: '.text-container-url',
      lock: '.text-container-lock',
      pin: '.text-container-pin',
      mute: '.text-container-mute',
      audio: '.text-container-audio',
      froze: '.text-container-froze',
      favicon: '.favicon-container-image',
      lastAccessed: '.text-container-la',
    };

    const faviconElement = tabLine.querySelector(selectors.favicon) as HTMLImageElement | null;

    if (changeInfo) {
      if (changeInfo.status === 'loading') tabLine.classList.add('reload');
      if (changeInfo.status === 'complete') tabLine.classList.remove('reload');
      // This is sort of a hack. Sometimes Chrome does not load favicon for us?
      if (changeInfo.favIconUrl && tab.url) {
        const newFaviconUrl = await this.favHandler.faviconURL(tab.url, true);
        this.loadFavicon(newFaviconUrl, faviconElement);
      }
    }

    const titleElement = tabLine.querySelector(selectors.title) as HTMLElement | null;
    if (titleElement) titleElement.textContent = tab.title || '';

    const urlElement = tabLine.querySelector(selectors.url) as HTMLElement | null;
    if (urlElement) urlElement.textContent = tab.url || '';

    const lockIcon = tabLine.querySelector(selectors.lock) as HTMLElement | null;
    if (lockIcon) lockIcon.style.display = isSecureUrl(tab.url || '') ? 'none' : 'initial';

    const pinIcon = tabLine.querySelector(selectors.pin) as HTMLElement | null;
    if (pinIcon) pinIcon.style.display = tab.pinned ? 'initial' : 'none';

    const muteIcon = tabLine.querySelector(selectors.mute) as HTMLElement | null;
    if (muteIcon) muteIcon.style.display = tab.mutedInfo?.muted ? 'initial' : 'none';

    const audioIcon = tabLine.querySelector(selectors.audio) as HTMLElement | null;
    if (audioIcon) audioIcon.style.display = tab.audible ? 'inline-block' : 'none';

    const frozeIcon = tabLine.querySelector(selectors.froze) as HTMLElement | null;
    if (frozeIcon) frozeIcon.style.display = tab.frozen ? 'inline-block' : 'none';

    if (tab.url) {
      const newFaviconUrl = await this.favHandler.faviconURL(tab.url);
      this.loadFavicon(newFaviconUrl, faviconElement);
    }

    const laElement = tabLine.querySelector(selectors.lastAccessed) as HTMLElement | null;
    if (laElement && tab.lastAccessed) {
      laElement.textContent = new Date(tab.lastAccessed).toLocaleString();
      if (tab.lastAccessed > this.recentActiveTime && !isOwnUrl(tab.url || '')) {
        this.recentActiveTime = tab.lastAccessed;
        this.recentActiveTabId = tab.id || 0;
      }
    }

    tabLine.classList.toggle('discarded-tab', !!tab.discarded);
    tabLine.dataset['tabIndex'] = tab.index.toString();
  }

  /**
   * Renders a list of tabs into the container, organizing them into groups if applicable.
   * @param tabs - The list of Chrome tabs to render.
   * @param groupManager - The GroupManager instance for handling tab groups.
   */
  public async renderTabs(tabs: chrome.tabs.Tab[], groupManager: GroupManager): Promise<void> {
    this.container.innerHTML = '';
    this.tabCount = 0;
    groupManager.resetGroupContainers();

    const fragment = document.createDocumentFragment();
    const sortedTabs = tabs.sort((a, b) => a.index - b.index);
    // Find all newtab instances
    const newtabInstances = sortedTabs.filter((tab) => tab.url === 'chrome://newtab/');
    if (newtabInstances.length > 1) {
      // Remove all newtab instances except the last one
      if (this.options?.keep_one_tablist) {
        // Remove all newtab instances except the last one
        newtabInstances.slice(0, -1).forEach((tab) => {
          if (tab.id && !tab.active) {
            chrome.tabs.remove(tab.id).catch((err) => logError(E_TYPE, err));
          }
        });
      }
    }

    const tabLinePromises = sortedTabs.map((tab) => {
      return this.createTabLine(tab);
    });

    const tabLines = await Promise.all(tabLinePromises);

    tabLines.forEach((tabLine, index) => {
      const tab = sortedTabs[index];
      if (tab && tabLine) {
        if (tab.groupId !== -1) {
          groupManager.appendToGroup(tab, tabLine, fragment);
        } else {
          fragment.appendChild(tabLine);
        }
      }
    });

    this.container.appendChild(fragment);
    this.setupKeyboardNavigation();
  }

  /**
   * Loads and configures a favicon for a tab line, including click and keydown handlers.
   * @param newFaviconUrl - The URL of the favicon to load.
   * @param faviconElement - The HTML image element to display the favicon.
   * @private
   */
  private loadFavicon(newFaviconUrl: string, faviconElement: HTMLImageElement | null): void {
    if (!newFaviconUrl || !faviconElement || faviconElement.src === newFaviconUrl) {
      return;
    }

    faviconElement.onload = async (event) => {
      if (event.target) {
        // const needsBust = await this.favHandler.checkForCacheBust(event.target as HTMLImageElement);
        // console.log(newFaviconUrl, needsBust);
        // TODO: retry loading image
      }
    };
    faviconElement.src = newFaviconUrl;
    // TODO: enable as option in version 2.0.1
    // Analyzes image and inverts favicon colors if it will blend with background
    if (this.options.invert_favicons) {
      this.favHandler.analyzeColor(newFaviconUrl).then((result) => {
        const attr = document.documentElement.getAttribute('color-mode');
        faviconElement.style.filter =
          (result.white && attr === 'light') || (result.black && attr === 'dark') ? 'invert(1)' : '';
      });
    }

    faviconElement.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation();
      const tabId = this.getTabLineFromEvent(e);
      if (!tabId) {
        return;
      }
      chrome.tabs.update(tabId, { active: true });
    });

    faviconElement.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.stopPropagation();
        const tabId = this.getTabLineFromEvent(e);
        if (!tabId) {
          return;
        }
        chrome.tabs.update(tabId, { active: true });
      }
      if (e.key === 'Tab') {
        faviconElement.removeAttribute('tabindex');
      }
    });
  }

  public resetActiveTabId (removedTabId: number) {
    const tabLine = document.querySelector(`[data-tab-id="${removedTabId}"]`) as HTMLElement | null;
    if (tabLine) {
      this.recentActiveTabId = 0;
      if (this.recentActiveTabId === removedTabId) {
          chrome.tabs.query({ currentWindow: true }).then((tabs) => {
          tabs.sort((a, b) => a.index - b.index).forEach(async (tab) => {
            if (tab.lastAccessed && tab.lastAccessed > this.recentActiveTime) {
              this.recentActiveTime = tab.lastAccessed;
            }
          });
        });
      }
    }
  }

  /**
   * Retrieves the tab ID from a mouse or keyboard event.
   * @param e - The mouse or keyboard event.
   * @returns The tab ID as a number, or `null` if the tab line cannot be found.
   * @private
   */
  private getTabLineFromEvent(e: MouseEvent | KeyboardEvent): number | null {
    if (!e.target) {
      logError(E_TYPE, 'e.target is nul or undefined');
      return null;
    }
    const tabLine = (e.target as HTMLElement).closest('.data-container') as HTMLElement;
    if (!tabLine) {
      logError(E_TYPE, 'tabLine is nul or undefined');
      return null;
    }
    return parseInt(tabLine.dataset['tabId']!, 10);
  }

  /**
   * Sets up actions (discard, close, reload) for a tab line, including keyboard shortcuts.
   * @param tabLine - The tab line element to configure actions for.
   * @throws {Error} Throws an error if an action button is not found.
   * @private
   */
  private setupTabActions(tabLine: HTMLElement): void {
    const actions = {
      discard: (e: Event | KeyboardEvent) => {
        if (e instanceof KeyboardEvent && (e.key !== 'Enter' && e.key !== 'm')) {
          return;
        }
        e.stopPropagation();
        const tabId = parseInt(tabLine.dataset['tabId']!, 10);
        chrome.tabs.discard(tabId).catch((err) => logError(E_TYPE, err));
      },
      close: (e: Event | KeyboardEvent) => {
        if (e instanceof KeyboardEvent && (e.key !== 'Enter' && e.key !== 'c')) {
          return;
        }
        e.stopPropagation();
        const tabId = parseInt(tabLine.dataset['tabId']!, 10);
        tabLine.classList.add('disintegrate');
        setTimeout(() => chrome.tabs.remove(tabId, () => tabLine.remove()), 400);
      },
      reload: (e: Event | KeyboardEvent) => {
        if (e instanceof KeyboardEvent && (e.key !== 'Enter' && e.key !== 'r')) {
          return;
        }
        e.stopPropagation();
        const tabId = parseInt(tabLine.dataset['tabId']!, 10);
        tabLine.classList.add('reload');
        chrome.tabs.reload(tabId);
      },
    };

    tabLine.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'x') actions.close(e);
      if (e.key === 'm') actions.discard(e);
      if (e.key === 'r') actions.reload(e);
    });

    ['discard', 'reload', 'close'].forEach((action) => {
      const btn = tabLine.querySelector(`.options-container-${action}`) as HTMLElement | null;
      if (!btn) {
        throw new Error('Unexpected!');
      }
      btn.addEventListener('click', actions[action as keyof typeof actions]);
      btn.addEventListener('keydown', actions[action as keyof typeof actions]);
    });
  }

  /**
   * Sets up keyboard navigation for tab lines, including Shift + Up/Down and Arrow key navigation.
   * @private
   */
  private setupKeyboardNavigation(): void {
    this.container.addEventListener('keydown', (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement;
      if (!activeElement || !this.container.contains(activeElement)) return;
      // For some reason sometimes I am receiving same event multiple times in a row.
      // This is a hack to fix that.
      if (this.lastTimestamp === e.timeStamp) {
        logError(E_TYPE, 'Duplicate event', e);
        return;
      }

      this.lastTimestamp = e.timeStamp;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const tabLine = activeElement.closest('.data-container') as HTMLElement | null;

        const favicon = activeElement.closest('.favicon-container-image') as HTMLElement | null;
        if (favicon && favicon.hasAttribute('tabindex')) {
          favicon.removeAttribute('tabindex');
          tabLine?.focus();
          return;
        }

        if (tabLine) {
          this.openTabOptions(tabLine);
          const firstOption = tabLine.querySelector('.options-container > [tabindex="0"]') as HTMLElement | null;
          if (firstOption) firstOption.focus();
        }
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (this.currentOpenTabLine) {
          const option = activeElement.closest('.options-container > [tabindex="0"]') as HTMLElement | null;
          if (option) {
            const tabLine = option.closest('.data-container') as HTMLElement;
            this.closeTabOptions(tabLine);
            tabLine.focus();
          }
        } else {
          const favicon = activeElement.querySelector('.favicon-container-image') as HTMLElement | null;
          if (favicon) {
            favicon.setAttribute('tabindex', '0');
            if (favicon) {
              favicon.focus();
            }
          }
        }
        return;
      }

      // Shift key is needed because we may drag smth.
      if (!e.shiftKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      // if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();

      const focusableElements = Array.from(
        this.container.querySelectorAll('.data-container[tabindex="0"], .tab-group-header[tabindex="0"]')
      ) as HTMLElement[];
      const currentIndex = focusableElements.indexOf(activeElement);
      if (currentIndex === -1) return;

      const direction = e.key === 'ArrowUp' ? -1 : 1;
      let newIndex = this.wrapIndex(currentIndex + direction, focusableElements.length);

      const nextElement = focusableElements[newIndex];
      nextElement?.focus();
    });

    // Listen for focus changes (e.g., Tab key or Shift+Arrow Down)
    document.addEventListener('focusin', this.handleFocusChange.bind(this));
  }

  /**
   * Wraps the index around the array bounds for circular navigation.
   * @param index - The current index.
   * @param length - The length of the positions array.
   * @returns The wrapped index.
   * @private
   */
  private wrapIndex(index: number, length: number): number {
    return (index + length) % length;
  }

  /**
   * Handles focus changes to close tab options when focus moves outside the current tab line.
   * @param e - The focus event.
   * @private
   */
  private handleFocusChange(e: FocusEvent): void {
    const newFocusedElement = e.target as HTMLElement;
    // If there's an open tab line and focus moves outside it, close its options
    if (this.currentOpenTabLine && !this.currentOpenTabLine.contains(newFocusedElement)) {
      this.closeTabOptions(this.currentOpenTabLine);
      this.currentOpenTabLine = null;
    }
  }

  /**
   * Opens the options menu for a tab line.
   * @param tabLine - The tab line element to open options for.
   * @private
   */
  private openTabOptions(tabLine: HTMLElement): void {
    // Close any previously open options
    if (this.currentOpenTabLine) {
      this.closeTabOptions(this.currentOpenTabLine);
    }
    const optionsContainer = tabLine.querySelector('.options-container') as HTMLElement | null;
    if (optionsContainer) {
      optionsContainer.classList.add('options-open');
      this.currentOpenTabLine = tabLine;
    }
  }

  /**
   * Closes the options menu for a tab line.
   * @param tabLine - The tab line element to close options for.
   * @private
   */
  private closeTabOptions(tabLine: HTMLElement): void {
    const optionsContainer = tabLine.querySelector('.options-container') as HTMLElement | null;
    if (optionsContainer) {
      optionsContainer.classList.remove('options-open');
    }
    this.currentOpenTabLine = null;
  }
}
// newTabPage.ts
import { TabManager } from './lib/TabManager';
import { GroupManager } from './lib/GroupManager';
import { DragDropManager } from './lib/DragDropManager';
import { EventListenerManager } from './lib/EventListenerManager';
import { DialogManager } from './lib/DialogManager';
import { DEFAULT_OPTIONS, Options } from './lib/constants';
import { logError } from './lib/logging';
import { UIManager } from './lib/UIManager';

/**
 * Creates a debounced version of a function to limit its execution rate.
 * @template T - The function type to debounce.
 * @param {T} func - The function to debounce.
 * @param {number} wait - The debounce delay in milliseconds.
 * @returns {(...args: Parameters<T>) => void} The debounced function.
 */
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Manages the new tab page functionality, initializing managers and rendering tabs.
 */
export class NewTabPage {
  private tabManager!: TabManager;
  private groupManager!: GroupManager;
  private dragDropManager!: DragDropManager;
  private dialogManager!: DialogManager;
  private container: HTMLDivElement;

  /**
   * Initializes the NewTabPage with UI manager and options, setting up all managers.
   * @param {UIManager} uiManager - The UI manager instance.
   * @param {Options} options - Configuration options for the extension.
   */
  constructor (private uiManager: UIManager, private options: Options) {
    this.container = document.getElementById('tabs-container') as HTMLDivElement;
    if (!this.container) throw new Error('Tabs container not found');
    this.uiManager = uiManager;
  }

  /**
   * Renders all tabs in the current window, updating the UI.
   */
  private async renderTabs(): Promise<void> {
    chrome.tabs.query({ currentWindow: true }).then(async (tabs) => {
      this.uiManager.setObserver(this.container);
      await this.tabManager.renderTabs(tabs, this.groupManager);
      this.uiManager.checkUserTheme();
      this.uiManager.checkStyles();
    }).catch((err) => logError('renderTabs', err as string));
  }

  /**
   * Initiates the initial rendering of tabs.
   */
  public async initRendering() {
    const sessionData = await chrome.storage.session.get();
    this.tabManager = new TabManager(this.container, this.options);
    this.groupManager = new GroupManager(this.container, sessionData['groupStates'], this.options);
    this.dragDropManager = new DragDropManager(this.container, this.groupManager);
    this.dialogManager = new DialogManager(this.container);

    new EventListenerManager(
      this.container,
      this.tabManager,
      this.groupManager,
      this.dragDropManager,
      this.uiManager,
      this.options,
      debounce(this.renderTabs.bind(this), 100)
    );

    this.uiManager.setupUI(this.container, this.tabManager);
    this.uiManager.initializeToggleButton();
    this.dialogManager.setupTabSelection();
    await this.renderTabs();
  }
}

async function main() {
  let uiManager: UIManager;
  let options: Options = DEFAULT_OPTIONS;
  try {
    options = (await chrome.storage.sync.get(DEFAULT_OPTIONS)) as Options;
    uiManager = new UIManager(options);
  } catch (err) {
    logError('main', err as string);
    uiManager = new UIManager(DEFAULT_OPTIONS);
  }
  uiManager.checkStyles();
  uiManager.checkUserTheme();
  const page = new NewTabPage(uiManager, options);
  await page.initRendering();
}

main();

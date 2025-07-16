import { TabManager } from './TabManager';
import { GroupManager } from './GroupManager';
import { DragDropManager } from './DragDropManager';
import { updateDomIndices } from './utils';
import { KEY_OPTIONS, Options } from './constants';
import { DEBUG, logError, logInfo } from './logging';
import { UIManager } from './UIManager';

const E_TYPE = 'EventListenerManager';

/**
 * Manages Chrome event listeners for tab and group operations in the tab list extension.
 * Coordinates updates between the DOM, TabManager, GroupManager, and DragDropManager.
 */
export class EventListenerManager {
  /**
   * Initializes the EventListenerManager with necessary dependencies.
   * @param {HTMLElement} tabContainer - Holds reference to the tab container element.
   * @param {TabManager} tabManager - Manages tab-related operations and DOM updates.
   * @param {GroupManager} groupManager - Manages group-related operations and states.
   * @param {DragDropManager} dragDropManager - Handles drag-and-drop functionality.
   * @param {UIManager} uiManager - Manages UI-related updates and states.
   * @param {Options} options - Configuration options for the extension.
   * @param {() => void} debounceRenderTabs - Debounced function to re-render tabs.
   */
  constructor(
    private tabContainer: HTMLElement,
    private tabManager: TabManager,
    private groupManager: GroupManager,
    private dragDropManager: DragDropManager,
    private uiManager: UIManager,
    private options: Options,
    private debounceRenderTabs: () => void
  ) {
    this.attachListeners();
  }

  /**
   * Attaches Chrome event listeners for tabs, groups, and storage changes.
   */
  private attachListeners(): void {
    // Tabs updated (title, URL, favicon, etc.)
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      await this.handleTabUpdated(tabId, changeInfo, tab);
    });

    // Tab created
    chrome.tabs.onCreated.addListener(async (tab) => {
      await this.handleTabCreated(tab);
    });

    // Tab removed
    chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
      await this.handleTabRemoved(tabId, removeInfo);
    });

    // Tab moved
    chrome.tabs.onMoved.addListener(async (tabId, moveInfo) => {
      await this.handleTabMoved(tabId, moveInfo);
    });

    // Tab attached to window
    chrome.tabs.onAttached.addListener(async (tabId, attachInfo) => {
      await this.handleTabAttached(tabId, attachInfo);
    });

    // Tab detached from window
    chrome.tabs.onDetached.addListener(async (tabId, detachInfo) => {
      await this.handleTabDetached(tabId, detachInfo);
    });

    // Tab replaced (e.g., by prerendering)
    chrome.tabs.onReplaced.addListener(async (addedTabId, removedTabId) => {
      await this.handleTabReplaced(addedTabId, removedTabId);
    });

    // Tab group created
    chrome.tabGroups.onCreated.addListener(async (group) => {
      await this.handleGroupCreated(group);
    });

    // Tab group moved
    chrome.tabGroups.onMoved.addListener(async (group) => {
      await this.handleGroupMoved(group);
    });

    // Tab group updated (title, color, collapse state)
    chrome.tabGroups.onUpdated.addListener(async (group) => {
      await this.handleGroupUpdated(group);
    });

    // Tab group removed
    chrome.tabGroups.onRemoved.addListener(async (group) => {
      await this.handleGroupRemoved(group);
    });

    // Storage changes
    chrome.storage.onChanged.addListener(async (changes, areaName) => {
      await this.handleStorageChanged(changes, areaName);
    });
  }

  /**
   * Handles updates to a tab’s properties (e.g., title, URL, favicon).
   * @param {number} tabId - The ID of the updated tab.
   * @param {chrome.tabs.TabChangeInfo} changeInfo - Information about what changed.
   * @param {chrome.tabs.Tab} tab - The updated tab object.
   * @returns {Promise<void>} Resolves when the update is complete.
   */
  private async handleTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab
  ): Promise<void> {
    const win = await chrome.windows.getCurrent();
    if (tab.windowId !== win.id) return;

    if (DEBUG) logInfo(E_TYPE, 'chrome.tabs.onUpdated', changeInfo);

    const tabLine = document.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement | null;
    if (!tabLine) return;

    await this.tabManager.updateTabContent(tabLine, tab, changeInfo);

    if (typeof changeInfo.groupId !== 'number') return;

    if (changeInfo.groupId === -1) {
      this.handleUngroup(tabLine, tab);
    } else if (changeInfo.groupId >= 0) {
      this.handleGroupChange(tabLine, tab);
    }

    // this.updateDomIndices();
    updateDomIndices(this.tabContainer);
  }

  /**
   * Handles the creation of a new tab.
   * @param {chrome.tabs.Tab} tab - The newly created tab.
   * @returns {Promise<void>} Resolves when the tab is inserted into the DOM.
   */
  private async handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
    const win = await chrome.windows.getCurrent();
    if (tab.windowId !== win.id) return;

    if (DEBUG) logInfo(E_TYPE, 'chrome.tabs.onCreated');

    const newTabLine = await this.tabManager.createTabLine(tab);
    if (!newTabLine) return;

    if (tab.groupId !== undefined && tab.groupId !== -1) {
      this.groupManager.appendToGroup(tab, newTabLine, this.tabContainer);
    } else {
      await this.insertTabInOrderNew(newTabLine, tab, this.tabContainer);
    }

    updateDomIndices(this.tabContainer);
  }

  /**
   * Handles the removal of a tab from the window.
   * @param {number} tabId - The ID of the removed tab.
   * @param {chrome.tabs.TabRemoveInfo} removeInfo - Information about the removal.
   * @returns {Promise<void>} Resolves when the tab is removed from the DOM.
   */
  private async handleTabRemoved(tabId: number, removeInfo: chrome.tabs.TabRemoveInfo): Promise<void> {
    const win = await chrome.windows.getCurrent();
    if (removeInfo.windowId !== win.id) return;

    if (DEBUG) logInfo(E_TYPE, 'chrome.tabs.onRemoved', tabId);

    const tabLine = document.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement | null;
    if (tabLine) {
      this.tabManager.tabCount--;
      this.tabManager.resetActiveTabId(tabId);
      tabLine.remove();
    }

    updateDomIndices(this.tabContainer);
  }

  /**
   * Handles the movement of a tab within the window.
   * @param {number} tabId - The ID of the moved tab.
   * @param {chrome.tabs.TabMoveInfo} moveInfo - Information about the move.
   * @returns {Promise<void>} Resolves when the move is processed or skipped.
   */
  private async handleTabMoved(tabId: number, moveInfo: chrome.tabs.TabMoveInfo): Promise<void> {
    const win = await chrome.windows.getCurrent();
    if (moveInfo.windowId !== win.id) return;

    if (DEBUG) logInfo(E_TYPE, 'chrome.tabs.onMoved', { tabIdsInMove: this.dragDropManager.dragState.tabIdsInMove, tabId, moveInfo });

    const dragState = this.dragDropManager.dragState;
    if (dragState.tabIdsInMove.length) {
      const idx = dragState.tabIdsInMove.indexOf(tabId);
      if (idx !== -1) {
        dragState.tabIdsInMove.splice(idx, 1);
        return;
      }
    }

    if (this.dragDropManager.suppressOnMoved) return;

    this.debounceRenderTabs();
  }

  /**
   * Handles a tab being attached to the current window.
   * @param {number} _tabId - The ID of the attached tab.
   * @param {chrome.tabs.TabAttachInfo} attachInfo - Information about the attachment.
   * @returns {Promise<void>} Resolves when the attachment is processed.
   */
  private async handleTabAttached(_tabId: number, attachInfo: chrome.tabs.TabAttachInfo): Promise<void> {
    const win = await chrome.windows.getCurrent();
    if (attachInfo.newWindowId !== win.id) return;

    if (DEBUG) logInfo(E_TYPE, 'chrome.tabs.onAttached');
    this.debounceRenderTabs();
  }

  /**
   * Handles a tab being detached from the current window.
   * @param {number} tabId - The ID of the detached tab.
   * @param {chrome.tabs.TabDetachInfo} detachInfo - Information about the detachment.
   * @returns {Promise<void>} Resolves when the detachment is processed.
   */
  private async handleTabDetached(tabId: number, detachInfo: chrome.tabs.TabDetachInfo): Promise<void> {
    const win = await chrome.windows.getCurrent();
    if (detachInfo.oldWindowId !== win.id) return;

    if (DEBUG) logInfo(E_TYPE, 'chrome.tabs.onDetached');

    const tabLine = document.querySelector(`[data-tab-id="${tabId}"]`) as HTMLElement | null;
    if (tabLine) {
      tabLine.remove();
      this.tabManager.tabCount--;
    }

    updateDomIndices(this.tabContainer);
  }

  /**
   * Handles a tab being replaced (e.g., due to prerendering).
   * @param {number} addedTabId - The ID of the new tab.
   * @param {number} removedTabId - The ID of the replaced tab.
   */
  private handleTabReplaced(addedTabId: number, removedTabId: number): void {
    if (DEBUG) logInfo(E_TYPE, 'chrome.tabs.onReplaced');

    const tabLine = document.querySelector(`[data-tab-id="${removedTabId}"]`) as HTMLElement | null;
    if (tabLine) {
      tabLine.dataset['tabId'] = addedTabId.toString();
      chrome.tabs.get(addedTabId, async (tab) => await this.tabManager.updateTabContent(tabLine, tab));
    }

    updateDomIndices(this.tabContainer);
  }

  /**
   * Handles the creation of a new tab group.
   * @param {chrome.tabGroups.TabGroup} group - The newly created group.
   * @returns {Promise<void>} Resolves when the group creation is processed.
   */
  private async handleGroupCreated(group: chrome.tabGroups.TabGroup): Promise<void> {
    const win = await chrome.windows.getCurrent();
    if (group.windowId !== win.id) return;

    if (DEBUG) logInfo(E_TYPE, 'chrome.tabGroups.onCreated');

    const groupId = group.id;
    const groupStates = this.groupManager.groupStates;
    if (!(groupId in groupStates)) {
      groupStates[groupId] = false;
      this.groupManager.saveGroupStates();
    }
    this.debounceRenderTabs();
  }

  /**
   * Handles the movement of a tab group.
   * @param {chrome.tabGroups.TabGroup} group - The moved group.
   * @returns {Promise<void>} Resolves when the move is processed or skipped.
   */
  private async handleGroupMoved(group: chrome.tabGroups.TabGroup): Promise<void> {
    const win = await chrome.windows.getCurrent();
    if (group.windowId !== win.id) return;

    if (DEBUG) logInfo(E_TYPE, 'chrome.tabGroups.onMoved', this.dragDropManager.dragState.isGroupDrag);

    const dragState = this.dragDropManager.dragState;
    if (dragState.isGroupDrag) {
      dragState.isGroupDrag = false;
      return;
    }

    this.debounceRenderTabs();
  }

  /**
   * Handles updates to a tab group (e.g., title, color, collapse state).
   * @param {chrome.tabGroups.TabGroup} group - The updated group.
   * @returns {Promise<void>} Resolves when the update is processed.
   */
  private async handleGroupUpdated(group: chrome.tabGroups.TabGroup): Promise<void> {
    const win = await chrome.windows.getCurrent();
    if (group.windowId !== win.id) return;

    if (DEBUG) logInfo(E_TYPE, 'chrome.tabGroups.onUpdated', group);

    const groupContainer = document.querySelector(`.tab-group-container[data-group-id="${group.id}"]`) as HTMLDivElement | null;
    if (groupContainer) {
      const groupHeader = groupContainer.querySelector('.tab-group-header') as HTMLDivElement | null;
      if (groupHeader) {
        if (this.options.sync_group_folding) {
          const userInitiatedFold = this.groupManager.userInitiatedFold;
          if (!userInitiatedFold) {
            group.collapsed ? this.groupManager.collapseGroup(groupContainer, group.id) : this.groupManager.expandGroup(groupContainer, group.id);
            this.groupManager.saveGroupStates();
          }
          if (userInitiatedFold) {
            this.groupManager.userInitiatedFold = false;
          }
        }

        this.groupManager.updateInfo(group, groupContainer);
      }
    }
  }

  /**
   * Handles the removal of a tab group.
   * @param {chrome.tabGroups.TabGroup} group - The removed group.
   * @returns {Promise<void>} Resolves when the removal is processed.
   */
  private async handleGroupRemoved(group: chrome.tabGroups.TabGroup): Promise<void> {
    const win = await chrome.windows.getCurrent();
    if (group.windowId !== win.id) return;

    if (DEBUG) logInfo(E_TYPE, 'chrome.tabGroups.onRemoved');

    const groupId = group.id;
    const groupStates = this.groupManager.groupStates;
    if (!(groupId in groupStates)) {
      delete groupStates[groupId];
      this.groupManager.saveGroupStates();
    }
    this.debounceRenderTabs();
  }

  /**
   * Handles changes in Chrome storage, updating options if applicable.
   * @param {{ [key: string]: chrome.storage.StorageChange }} changes - The storage changes.
   * @param {string} areaName - The storage area (e.g., 'sync').
   */
  private handleStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void {
    if (DEBUG) logInfo(E_TYPE, 'chrome.storage.onChanged');

    const requiresRender = ['hide_tablist', 'keep_one_tablist', 'sync_group_folding'];
    let render = false;
    if (areaName === 'sync') {
      const localChange = this.uiManager.localChange;
      if (localChange) {
        this.uiManager.localChange = false;
        return;
      }

      for (const key in changes) {
        if (changes[key] === undefined) {
          throw new Error('Unexpected!');
        }
        if (requiresRender.includes(key)) {
          render = true;
        }
        if (KEY_OPTIONS.includes(key)) {
          (this.options[key as keyof Options] as string | number | boolean) = changes[key].newValue;
        } else {
          logError(E_TYPE, `Such option does not exist: ${key}!`);
          return;
        }
      }

      this.debounceRenderTabs();
    }
  }

  /**
   * Handles ungrouping a tab from a group, repositioning it in the main container.
   * @param {HTMLElement} tabLine - The tab element to ungroup.
   * @param {chrome.tabs.Tab} tab - The tab data.
   */
  private handleUngroup(tabLine: HTMLElement, tab: chrome.tabs.Tab): void {
    const groupContainer = tabLine.closest('.tab-group-container') as HTMLElement | null;
    if (groupContainer) {
      const groupContent = groupContainer.querySelector('.tab-group-content') || groupContainer;
      const groupTabs = Array.from(groupContent.querySelectorAll('.data-container'));
      groupContent.removeChild(tabLine);

      const mainContainer = this.tabContainer;
      if (groupTabs.length > 0) {
        if (groupTabs[0] === tabLine) {
          mainContainer.insertBefore(tabLine, groupContainer);
        } else if (groupTabs[groupTabs.length - 1] === tabLine) {
          mainContainer.insertBefore(tabLine, groupContainer.nextSibling);
        } else {
          this.insertTabInOrder(tabLine, tab.index, mainContainer);
        }
      } else {
        this.insertTabInOrder(tabLine, tab.index, mainContainer);
      }
    }
  }

  /**
   * Handles a tab’s group change, moving it to the appropriate group container.
   * @param {HTMLElement} tabLine - The tab element to regroup.
   * @param {chrome.tabs.Tab} tab - The tab data with updated group info.
   */
  private handleGroupChange(tabLine: HTMLElement, tab: chrome.tabs.Tab): void {
    const currentGroup = tabLine.closest('.tab-group-container') as HTMLElement | null;
    if (!currentGroup) {
      const mainContainer = this.tabContainer;
      const targetGroup = mainContainer.querySelector(`.tab-group-container[data-group-id="${tab.groupId}"]`) as HTMLElement | null;
      if (targetGroup) {
        const groupContent = targetGroup.querySelector('.tab-group-content') || targetGroup;
        const children = Array.from(mainContainer.children);
        const tabLineIndex = children.indexOf(tabLine);
        const groupContainerIndex = children.indexOf(targetGroup);
        if (tabLineIndex < groupContainerIndex) {
          groupContent.insertBefore(tabLine, groupContent.firstChild);
        } else {
          groupContent.appendChild(tabLine);
        }
      } else {
        this.insertTabInOrder(tabLine, tab.index, mainContainer);
      }
    }
  }

  /**
   * Inserts a tab into the main container in order based on its index.
   * @param {HTMLElement} tabLine - The tab element to insert.
   * @param {number} tabIndex - The tab’s index in the window.
   * @param {HTMLElement} container - The main container to insert into.
   */
  private insertTabInOrder(tabLine: HTMLElement, tabIndex: number, container: HTMLElement): void {
    const children = Array.from(container.querySelectorAll('.data-container')) as HTMLElement[];
    let inserted = false;
    for (const child of children) {
      const childIndex = parseInt(child.dataset['tabIndex']!, 10);
      if (!isNaN(childIndex) && childIndex > tabIndex) {
        container.insertBefore(tabLine, child);
        inserted = true;
        break;
      }
    }
    if (!inserted) container.appendChild(tabLine);
    // this.updateDomIndices();
    updateDomIndices(this.tabContainer);
  }

  /**
   * Inserts a new tab into the main container, respecting group and tab order.
   * @param {HTMLElement} tabLine - The new tab element to insert.
   * @param {chrome.tabs.Tab} tab - The tab data.
   * @param {HTMLElement} container - The main container to insert into.
   * @returns {Promise<void>} Resolves when insertion is complete.
   */
  private async insertTabInOrderNew(tabLine: HTMLElement, tab: chrome.tabs.Tab, container: HTMLElement): Promise<void> {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    tabs.sort((a, b) => a.index - b.index);
    const newTabIndex = tabs.findIndex(t => t.id === tab.id);
    if (DEBUG) logInfo(E_TYPE, `Inserting tab ${tab.id} at index ${newTabIndex}, groupId: ${tab.groupId || 'none'}`);

    const allChildren = Array.from(container.children) as HTMLElement[];
    let inserted = false;

    for (const child of allChildren) {
      if (child.classList.contains('data-container')) {
        const childTabId = parseInt(child.dataset['tabId']!, 10);
        const childTab = tabs.find(t => t.id === childTabId);
        if (childTab && tabs.findIndex(t => t.id === childTab.id) > newTabIndex) {
          container.insertBefore(tabLine, child);
          inserted = true;
          break;
        }
      } else if (child.classList.contains('tab-group-container')) {
        const firstTab = child.querySelector('.data-container') as HTMLElement | null;
        if (firstTab) {
          const firstTabId = parseInt(firstTab.dataset['tabId']!, 10);
          const firstTabInGroup = tabs.find(t => t.id === firstTabId);
          if (firstTabInGroup && tabs.findIndex(t => t.id === firstTabInGroup.id) > newTabIndex) {
            container.insertBefore(tabLine, child);
            inserted = true;
            break;
          }
        }
      }
    }

    if (!inserted) {
      container.appendChild(tabLine);
    }
  }
}
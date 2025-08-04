import { COLOR_MAP } from './colors';
import { logError } from './logging';
import { hexToRGBA } from './utils';

const E_TYPE = 'DialogManager';

/**
 * Interface representing the state of tab selection.
 */
interface SelectionState {
  selectedTabIds: Set<string>;
  selectedGroupIds: Set<string>;
  isSelecting: boolean;
  isKbdMode: boolean;
  inDialog: boolean;
}

/**
 * Manages dialog interactions for tab selection and group management.
 */
export class DialogManager {
  private tabContainer: HTMLElement;
  private selectionState: SelectionState;
  // private lastTimestamp = 0;

  constructor(tabContainer: HTMLElement) {
    this.tabContainer = tabContainer;
    this.selectionState = {
      selectedTabIds: new Set(),
      selectedGroupIds: new Set(),
      isSelecting: false,
      isKbdMode: false,
      inDialog: false,
    };
  }

  /**
   * Handles tab and group selection for grouping when clicking or using Enter key.
   * @param e - The triggering event (MouseEvent or KeyboardEvent).
   */
  private selectTabForGroup(e: KeyboardEvent | MouseEvent): void {
    const target = e.target as HTMLElement;

    // Check if it's a group header
    const groupHeader = target.closest('.tab-group-header') as HTMLElement | null;
    if (groupHeader) {
      const groupContainer = groupHeader.closest('.tab-group-container') as HTMLElement | null;
      if (groupContainer && groupContainer.dataset['groupId']) {
        const groupId = groupContainer.dataset['groupId'];

        // Prevent group expansion/collapse during selection
        e.preventDefault();
        e.stopPropagation();

        if (!this.selectionState.selectedGroupIds.has(groupId)) {
          this.selectionState.selectedGroupIds.add(groupId);
          groupHeader.classList.add('selected');
        } else {
          this.selectionState.selectedGroupIds.delete(groupId);
          groupHeader.classList.remove('selected');
        }
        return;
      }
    }

    // Handle tab selection (existing logic)
    const tabLine = target.closest('.data-container') as HTMLElement | null;
    if (!tabLine || tabLine.dataset['tabId'] === undefined) {
      return;
    }

    const tabId = tabLine.dataset['tabId'];
    if (!this.selectionState.selectedTabIds.has(tabId)) {
      this.selectionState.selectedTabIds.add(tabId);
      tabLine.classList.add('selected');
    } else {
      this.selectionState.selectedTabIds.delete(tabId);
      tabLine.classList.remove('selected');
    }
  }

  /**
   * Sets up tab selection mode using Shift + click or 's' key to select and group tabs.
   */
  public setupTabSelection() {
    // Event listeners for keyboard selection with Enter
    this.tabContainer.addEventListener('keyup', (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !this.selectionState.isKbdMode || !this.selectionState.isSelecting) return;
      this.selectTabForGroup(e);
    });

    // Event listeners for mouse selection with Shift + Click
    this.tabContainer.addEventListener('click', (e: MouseEvent) => {
      if (!this.selectionState.isSelecting || !e.shiftKey) return;
      this.selectTabForGroup(e);
    });

    // Start selection with Shift press or 's' key
    document.addEventListener('keydown', async (e: KeyboardEvent) => {
      if (e.key === 's' && !this.selectionState.isSelecting) {
        this.selectionState.isKbdMode = true;
        this.selectionState.isSelecting = true;
        this.setSelectionStyle();
      } else if (e.key === 's' && this.selectionState.isSelecting) {
        this.selectionState.isKbdMode = false;
        this.selectionState.isSelecting = false;
        await this.endSelection();
      } else if (e.key === 'Shift' && !this.selectionState.isKbdMode && !this.selectionState.isSelecting && !this.selectionState.inDialog) {
        this.selectionState.selectedTabIds.clear();
        this.selectionState.selectedGroupIds.clear();
        this.selectionState.isSelecting = true;
        this.setSelectionStyle(false);
      } else if (e.key === 'Escape' && this.selectionState.isSelecting) {
        this.selectionState.isSelecting = false;
        this.clearSelection();
      }
    });

    // Detect Shift release for mouse mode
    document.addEventListener('keyup', async (e: KeyboardEvent) => {
      if (this.selectionState.inDialog) {
        return;
      }
      if (e.key === 'Shift' && this.selectionState.isSelecting && !this.selectionState.isKbdMode) {
        this.selectionState.isSelecting = false;
        await this.endSelection();
      } else if (e.key === 'Escape' && this.selectionState.isSelecting) {
        this.selectionState.isSelecting = false;
        this.clearSelection();
      }
    });

    // Ensure Shift release triggers dialog even if focus shifts
    this.tabContainer.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.shiftKey && !this.selectionState.isSelecting) {
        this.selectionState.isSelecting = true;
        this.selectionState.selectedTabIds.clear();
        this.selectionState.selectedGroupIds.clear();
        this.setSelectionStyle(false);
      }
    });
  }

  /**
   * Ends the selection process, showing the action dialog if tabs are selected.
   */
  private async endSelection(): Promise<void> {
    this.removeSelectionStyle();
    if (this.selectionState.selectedTabIds.size === 0 && this.selectionState.selectedGroupIds.size === 0) {
      this.selectionState.selectedTabIds.clear();
      this.selectionState.selectedGroupIds.clear();
      return;
    }
    this.selectionState.inDialog = true;
    await this.processSelectedTabs();
    this.selectionState.inDialog = false;
    this.clearSelection();
  }

  /**
   * Applies visual styles to indicate selection mode.
   * @param setBorder - Whether to apply a rolling border (default: true).
   */
  private setSelectionStyle(setBorder = true): void {
    this.tabContainer.classList.add('no-select');
    if (setBorder) this.tabContainer.classList.add('rolling-border');
  }

  /**
   * Removes selection mode visual styles.
   */
  private removeSelectionStyle(): void {
    this.tabContainer.classList.remove('no-select');
    this.tabContainer.classList.remove('rolling-border');
  }

  /**
   * Processes selected tabs and groups based on user action choice.
   */
  private async processSelectedTabs(): Promise<void> {
    const hasGroups = this.selectionState.selectedGroupIds.size > 0;
    const hasTabs = this.selectionState.selectedTabIds.size > 0;

    const actionChoice = await this.showActionDialog(hasGroups, hasTabs);
    if (!actionChoice) {
      return;
    }

    const choice = actionChoice.trim().toLowerCase();

    if (choice === 'window') {
      await this.moveToOtherWindow();
      return;
    }

    if (choice === 'new-window') {
      await this.moveToNewWindow();
      return;
    }

    if (!hasGroups && hasTabs) {
      // Only tabs selected, handle existing functionality
      if (choice !== 'create' && choice !== 'move') {
        alert("Invalid choice. Please select a valid option.");
        return;
      }

      const tabIds = Array.from(this.selectionState.selectedTabIds).map(id => parseInt(id, 10));
      if (choice === 'create') {
        const groupName = await this.showNameDialog();
        if (!groupName || groupName.trim() === "") {
          return;
        }
        chrome.tabs.group({ tabIds }, (groupId: number) => {
          chrome.tabGroups.update(groupId, { title: groupName });
        });
      } else if (choice === 'move') {
        const groupIdStr = await this.showGroupNameDialog();
        if (!groupIdStr) {
          return;
        }
        const groupId = parseInt(groupIdStr, 10);
        if (!isNaN(groupId)) {
          chrome.tabs.group({ tabIds, groupId });
        } else {
          logError(E_TYPE, "Invalid group ID selected.");
        }
      }
    }
  }

  /**
   * Moves selected tabs and/or groups to a new window.
   */
  private async moveToNewWindow(): Promise<void> {
    try {
      // Create new window first
      const newWindow = await new Promise<chrome.windows.Window>((resolve, reject) => {
        chrome.windows.create({}, (window) => {
          if (chrome.runtime.lastError || !window) {
            reject(chrome.runtime.lastError || new Error('Failed to create window'));
          } else {
            resolve(window);
          }
        });
      });

      if (!newWindow.id) {
        throw new Error('Failed to get new window ID');
      }

      // Move selected groups
      for (const groupIdStr of this.selectionState.selectedGroupIds) {
        const groupId = parseInt(groupIdStr, 10);
        if (!isNaN(groupId)) {
          await new Promise<void>((resolve, reject) => {
            chrome.tabGroups.move(groupId, { windowId: newWindow.id!, index: -1 }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        }
      }

      // Move selected individual tabs
      if (this.selectionState.selectedTabIds.size > 0) {
        const tabIds = Array.from(this.selectionState.selectedTabIds).map(id => parseInt(id, 10));
        await new Promise<void>((resolve, reject) => {
          chrome.tabs.move(tabIds, { windowId: newWindow.id!, index: -1 }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      logError(E_TYPE, "Failed to move tabs/groups to a new window:", error);
      alert("Failed to move tabs/groups to a new window. Please try again.");
    }
  }

  /**
   * Moves selected tabs and/or groups to another window.
   */
  private async moveToOtherWindow(): Promise<void> {
    const targetWindowId = await this.showWindowSelectionDialog();
    if (!targetWindowId) {
      return;
    }

    try {
      // Move selected groups
      for (const groupIdStr of this.selectionState.selectedGroupIds) {
        const groupId = parseInt(groupIdStr, 10);
        if (!isNaN(groupId)) {
          await new Promise<void>((resolve, reject) => {
            chrome.tabGroups.move(groupId, { windowId: targetWindowId, index: -1 }, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        }
      }

      // Move selected individual tabs
      if (this.selectionState.selectedTabIds.size > 0) {
        const tabIds = Array.from(this.selectionState.selectedTabIds).map(id => parseInt(id, 10));
        await new Promise<void>((resolve, reject) => {
          chrome.tabs.move(tabIds, { windowId: targetWindowId, index: -1 }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
    } catch (error) {
      logError(E_TYPE, "Failed to move tabs/groups to the other window:", error);
      alert("Failed to move tabs/groups to the other window. Please try again.");
    }
  }

  /**
   * Shows a dialog to select target window for moving tabs/groups.
   */
  private async showWindowSelectionDialog(): Promise<number | null> {
    return new Promise(async (resolve) => {
      const dialog = document.createElement('dialog');
      dialog.id = 'window-selection-dialog';
      document.body.appendChild(dialog);

      try {
        const windows = await chrome.windows.getAll({ populate: true, windowTypes: ['normal'] });
        const currentWindow = await chrome.windows.getCurrent();
        console.log(windows);
        // Filter out current window and get window info
        const otherWindows = windows.filter(w => w.id !== currentWindow.id);

        let windowOptions = '';
        if (otherWindows.length > 0) {
          windowOptions = await Promise.all(otherWindows
            .map(async (window, index) => {
              const tabCount = window.tabs ? window.tabs.length : 0;
              let incognito = '';
              if (window.incognito) {
                incognito = ' <span class="inline-symbol material-symbols-rounded">domino_mask</span>';
              }
              const groups = await chrome.tabGroups.query({ windowId: window.id });
              const groupTabCount = groups.length;
              const windowTitle = window.tabs && window.tabs.length > 0 && window.tabs[0]!.title
                ? window.tabs[0]!.title
                : `Window ${window.id}`;
              return `
              <input tabindex="0" type="radio" name="target-window" id="window-${window.id}" value="${window.id}" ${index === 0 ? 'checked' : ''}/>
              <label for="window-${window.id}" class="window-option">
                  <div class="dialog-window-name">
                    ${incognito}
                    ${windowTitle}
                  </div>
                  <div class="group-count-badge">${groupTabCount} groups</div>
                  <div class="tab-count-badge">${tabCount} tabs</div>
                </label>
                <br/>
              `;
            })
          ).then(options => options.join(''));
        }

        dialog.innerHTML = `
          <form method="dialog">
            <p class="dialog-title">Select the target window:</p>
            <div class="radio-group">
              ${windowOptions || '<p>No other windows available.</p>'}
            </div>
            <menu>
              <button class="confirm" value="confirm" ${otherWindows.length === 0 ? 'disabled' : ''}>Ok</button>
              <button class="cancel" value="cancel" formnovalidate>Cancel</button>
            </menu>
          </form>
        `;

        dialog.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            dialog.close('cancel');
          }
        });

        dialog.showModal();
        dialog.addEventListener('close', async () => {
          if (dialog.returnValue === 'confirm') {
            const selectedOption = (dialog.querySelector('input[name="target-window"]:checked') as HTMLInputElement)?.value;
            resolve(selectedOption ? parseInt(selectedOption, 10) : null);
            dialog.remove();
          } else {
            resolve(null);
            dialog.remove();
          }
        }, { once: true });
      } catch (error) {
        logError(E_TYPE, "Failed to get windows:", error);
        resolve(null);
        dialog.remove();
      }
    });
  }

  /**
   * Clears the selection state of tabs and groups.
   */
  private clearSelection(): void {
    this.selectionState.selectedTabIds.forEach((id) => {
      const el = this.tabContainer.querySelector(`[data-tab-id="${id}"]`) as HTMLElement | null;
      if (el) el.classList.remove('selected');
    });
    this.selectionState.selectedGroupIds.forEach((id) => {
      const el = this.tabContainer.querySelector(`[data-group-id="${id}"] .tab-group-header`) as HTMLElement | null;
      if (el) el.classList.remove('selected');
    });
    this.selectionState.selectedTabIds.clear();
    this.selectionState.selectedGroupIds.clear();
    this.removeSelectionStyle();
  }

  /**
   * Prompts the user to choose an action based on selection type.
   * @param hasGroups - Whether groups are selected.
   * @param hasTabs - Whether individual tabs are selected.
   * @returns A promise resolving to the chosen action or null if canceled.
   */
  public async showActionDialog(hasGroups: boolean, hasTabs: boolean): Promise<string | null> {
    return new Promise((resolve) => {
      let dialog = document.getElementById('action-dialog') as HTMLDialogElement | null;
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'action-dialog';
        document.body.appendChild(dialog);
      }

      let buttons = '';
      if (hasGroups || (hasGroups && hasTabs)) {
        // Groups selected (with or without tabs) - show window move options
        buttons = `
          <button tabindex="0" class="option main-dialog-option" value="window"><span title="Move to other window" class="inline-symbol material-symbols-rounded">window</span>Move to other window</button><br/>
          <button tabindex="0" class="option main-dialog-option" value="new-window"><span title="Move to new window" class="inline-symbol material-symbols-rounded">window</span>Move to new window</button><br/>
          <button class="cancel" value="cancel">Cancel</button>
        `;
      } else if (hasTabs && !hasGroups) {
        // Only tabs selected - show all options
        buttons = `
          <button tabindex="0" class="option main-dialog-option" value="create"><span title="Create group" class="inline-symbol material-symbols-rounded">create_new_folder</span>Move to new group</button><br/>
          <button tabindex="0" class="option main-dialog-option" value="move"><span title="Move to existing group" class="inline-symbol material-symbols-rounded">group_add</span>Move to existing group</button><br/>
          <button tabindex="0" class="option main-dialog-option" value="window"><span title="Move to other window" class="inline-symbol material-symbols-rounded">open_in_browser</span>Move to other window</button><br/>
          <button tabindex="0" class="option main-dialog-option" value="new-window"><span title="Move to new window" class="inline-symbol material-symbols-rounded">open_in_new</span>Move to new window</button><br/>
          <button class="cancel" value="cancel">Cancel</button>
        `;
      }

      dialog.innerHTML = `
        <form method="dialog">
          <p class="dialog-title">Please choose an action:</p>
          <menu>
            ${buttons}
          </menu>
        </form>
      `;

      dialog.returnValue = '';
      dialog.showModal();
      dialog.addEventListener('close', () => {
        resolve(dialog!.returnValue === 'cancel' ? null : dialog!.returnValue);
      }, { once: true });
    });
  }

  /**
   * Prompts the user to enter a new group name.
   * @returns A promise resolving to the entered group name or null if canceled.
   */
  public async showNameDialog(): Promise<string | null> {
    return new Promise((resolve) => {
      let dialog = document.getElementById('name-create-dialog') as HTMLDialogElement | null;
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'name-create-dialog';
        document.body.appendChild(dialog);
      }
      dialog.innerHTML = `
        <form method="dialog">
          <p class="dialog-title">Please enter the group name:</p>
          <p>
            <input tabindex="0" placeholder="Group name" type="text" id="group-name-input" required />
          </p>
          <menu>
            <button class="confirm" value="confirm">Ok</button>
            <button class="cancel" value="cancel" formnovalidate>Cancel</button>
          </menu>
        </form>
      `;
      const input = dialog.querySelector('#group-name-input') as HTMLInputElement;
      input.value = '';
      dialog.returnValue = '';
      dialog.showModal();

      dialog.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          dialog!.close('cancel');
        }
      });

      dialog.addEventListener('close', () => {
        resolve(dialog!.returnValue === 'cancel' ? null : input.value);
      }, { once: true });
    });
  }

  /**
   * Displays a dialog with radio options for selecting an existing group.
   * @returns A promise resolving to the selected group ID (as a string) or null if canceled.
   */
  public async showGroupNameDialog(): Promise<string | null> {
    const dialog = document.createElement('dialog');
    dialog.id = 'name-move-dialog';
    document.body.appendChild(dialog);

    const currentWindow = await chrome.windows.getCurrent();
    if (!currentWindow.id) {
      dialog.remove();
      return null;
    }

    const groups = await chrome.tabGroups.query({ windowId: currentWindow.id });
    const tabs = await chrome.tabs.query({ windowId: currentWindow.id });

    const groupTabCountMap = new Map<number, number>();
    const groupOrderMap = new Map<number, number>();
    groups.forEach((group) => {
      const firstTab = tabs.find((tab) => tab.groupId === group.id);
      groupOrderMap.set(group.id, firstTab ? firstTab.index : Infinity);
      groupTabCountMap.set(group.id, tabs.filter((tab) => tab.groupId === group.id).length);
    });

    const orderedGroups = groups.sort((a, b) => {
      const aIndex = groupOrderMap.get(a.id) ?? Infinity;
      const bIndex = groupOrderMap.get(b.id) ?? Infinity;
      return aIndex - bIndex;
    });

    const groupOptions = orderedGroups
      .map((group, index) => `
      <input tabindex="0" type="radio" name="group-name" id="group-${group.id}" value="${group.id}" ${index === 0 ? 'checked' : ''}/>
      <label for="group-${group.id}" class="group-option">
          <span style="color: ${hexToRGBA(COLOR_MAP[group.color] || group.color, 0.7)};" class="material-symbols-rounded dialog-tab-icon">tab</span>
          <div class="dialog-group-name">${group.title || `Group ${group.id}`}</div>
          <div class="tab-count-badge">${groupTabCountMap.get(group.id) || 0} tabs</div>
        </label>
      `)
      .join('');

    dialog.innerHTML = `
      <form method="dialog">
        <p class="dialog-title">Select a group to move the tabs to:</p>
        <div class="radio-group">
          ${groupOptions || '<p>No existing groups found.</p>'}
        </div>
        <menu>
          <button class="confirm" value="confirm">Ok</button>
          <button class="cancel" value="cancel" formnovalidate>Cancel</button>
        </menu>
      </form>
    `;

    dialog.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dialog.close('cancel');
      }
    });

    return new Promise((resolve) => {
      dialog.showModal();
      dialog.addEventListener('close', () => {
        const selectedGroupId = dialog.returnValue === 'confirm'
          ? (dialog.querySelector('input[name="group-name"]:checked') as HTMLInputElement)?.value
          : null;
        resolve(selectedGroupId);
        dialog.remove();
      }, { once: true });
    });
  }

    /**
     * Returns whether the dialog manager is currently in selection mode.
     * @returns True if in selection mode, false otherwise.
     */
    public isSelecting(): boolean {
      return this.selectionState.isSelecting;
    }
}

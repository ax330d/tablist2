import { COLOR_MAP } from './colors';
import { logError } from './logging';
import { hexToRGBA } from './utils';

const E_TYPE = 'DialogManager';

/**
 * Interface representing the state of tab selection.
 */
interface SelectionState {
  selectedTabIds: Set<string>;
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
      isSelecting: false,
      isKbdMode: false,
      inDialog: false,
    };
  }

  /**
   * Handles tab selection for grouping when clicking or using Enter key.
   * @param e - The triggering event (MouseEvent or KeyboardEvent).
   */
  private selectTabForGroup(e: KeyboardEvent | MouseEvent): void {
    const tabLine = (e.target as HTMLElement).closest('.data-container') as HTMLElement | null;
    if (!tabLine || tabLine.dataset['tabId'] === undefined) {
      // User could have selected group title
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
        this.setSelectionStyle(false);
      }
    });
  }

  /**
   * Ends the selection process, showing the action dialog if tabs are selected.
   */
  private async endSelection(): Promise<void> {
    this.removeSelectionStyle();
    if (this.selectionState.selectedTabIds.size === 0) {
      this.selectionState.selectedTabIds.clear();
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
   * Processes selected tabs based on user action choice.
   */
  private async processSelectedTabs(): Promise<void> {
    const actionChoice = await this.showActionDialog();
    if (!actionChoice) {
      return;
    }
    const choice = actionChoice.trim().toLowerCase();
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

  /**
   * Clears the selection state of tabs.
   */
  private clearSelection(): void {
    this.selectionState.selectedTabIds.forEach((id) => {
      const el = this.tabContainer.querySelector(`[data-tab-id="${id}"]`) as HTMLElement | null;
      if (el) el.classList.remove('selected');
    });
    this.selectionState.selectedTabIds.clear();
    this.removeSelectionStyle();
  }

  /**
   * Prompts the user to choose an action (create or move) for selected tabs.
   * @returns A promise resolving to the chosen action ('create', 'move') or null if canceled.
   */
  public async showActionDialog(): Promise<string | null> {
    return new Promise((resolve) => {
      let dialog = document.getElementById('action-dialog') as HTMLDialogElement | null;
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'action-dialog';
        dialog.innerHTML = `
          <form method="dialog">
            <p>Please choose action:</p>
            <menu>
              <button value="create">Create Group</button><br/>
              <button value="move">Move to Existing Group</button><br/>
              <button class="cancel" value="cancel">Cancel</button>
            </menu>
          </form>
        `;
        document.body.appendChild(dialog);
      }
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
          <p>Please enter group name:</p>
          <p>
            <input placeholder="Group name" type="text" id="group-name-input" required />
          </p>
          <menu>
            <button value="confirm">OK</button>
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

    const groupOrderMap = new Map<number, number>();
    groups.forEach((group) => {
      const firstTab = tabs.find((tab) => tab.groupId === group.id);
      groupOrderMap.set(group.id, firstTab ? firstTab.index : Infinity);
    });

    const orderedGroups = groups.sort((a, b) => {
      const aIndex = groupOrderMap.get(a.id) ?? Infinity;
      const bIndex = groupOrderMap.get(b.id) ?? Infinity;
      return aIndex - bIndex;
    });

    const groupOptions = orderedGroups
      .map((group, index) => `
        <input tabindex="0" type="radio" name="group-name" id="group-${group.id}" value="${group.id}" ${index === 0 ? 'checked' : ''}/>
        <label for="group-${group.id}" class="group-option" style="background-color: ${hexToRGBA(COLOR_MAP[group.color] || group.color, 0.5)}">
          <span>${group.title || `Group ${group.id}`}</span>
        </label><br/>
      `)
      .join('');

    dialog.innerHTML = `
      <form method="dialog">
        <p>Select a group to add tabs to:</p>
        <div class="radio-group">
          ${groupOptions || '<p>No existing groups found.</p>'}
        </div>
        <menu>
          <button value="confirm">OK</button>
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
}
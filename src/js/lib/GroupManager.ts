import { hexToRGBA, updateDomIndices } from './utils';
import { Options } from './constants';
import { DEBUG, logInfo } from './logging';
import { COLOR_MAP } from './colors';
import { DialogManager } from './DialogManager';

const E_TYPE = 'GroupManager';

interface GroupStates {
  [key: number]: boolean;
}

interface GroupContainerData {
  container: HTMLElement;
  header: HTMLElement;
  content: HTMLElement;
}

/**
 * Manages browser tab groups and their display in the Chrome extension's tab list.
 * This class handles the creation, organization, and collapsing/expanding of tab groups,
 * ensuring tab lines are correctly grouped and styled.
 */
export class GroupManager {
  public groupStates: GroupStates;
  private groupContainers: { [key: string]: GroupContainerData } = {};
  public userInitiatedFold: boolean;
  private tabContainer: HTMLElement;
  private options: Options;
  private dialogManager: DialogManager | null = null;

  /**
   * Creates a new GroupManager instance.
   * @param tabContainer - The HTML element that contains the tab list.
   * @param options - Configuration options for group behavior and styling.
   */
  constructor(tabContainer: HTMLElement, groupStates: GroupStates, options: Options) {
    this.tabContainer = tabContainer;
    this.options = options;
    this.groupStates = groupStates || {};
    this.userInitiatedFold = false;
  }
  /**
   * Sets the DialogManager reference to check selection state.
   * @param dialogManager - The DialogManager instance.
   */
  public setDialogManager(dialogManager: any): void {
    this.dialogManager = dialogManager;
  }

  /**
   * Resets the group containers, clearing all existing group data.
   */
  public resetGroupContainers(): void {
    this.groupContainers = {};
  }

  /**
   * Saves the current group states (collapsed/expanded) to local storage.
   */
  public saveGroupStates(): void {
    chrome.storage.session.set({'groupStates': this.groupStates});
  }

  /**
   * Checks if a group is collapsed.
   * @param groupId - The ID of the group to check.
   * @returns `true` if the group is collapsed, `false` otherwise.
   * @throws {Error} Throws an error if the group state is not found.
   */
  public isCollapsed(groupId: number): boolean {
    const strGroup = groupId;
    if (this.groupStates[strGroup] === undefined) {
      throw new Error('Unexpected!');
    }
    return this.groupStates[strGroup];
  }

  /**
   * Appends a tab line to its corresponding group container.
   * @param tab - The Chrome tab to append.
   * @param tabLine - The tab line element representing the tab.
   * @param container - The parent container for the group.
   */
  public appendToGroup(tab: chrome.tabs.Tab, tabLine: HTMLElement, container: HTMLElement | DocumentFragment): void {
    if (tab.groupId === undefined || tab.groupId === -1) return;
    const groupIdStr = String(tab.groupId);

    if (!this.groupContainers[groupIdStr]) {
      this.createGroupContainer(groupIdStr, container, tab.groupId);
    }

    if (!this.groupContainers[groupIdStr]) {
      throw new Error('Unexpected!');
    }
    const groupContent = this.groupContainers[groupIdStr].content;
    this.insertTabInGroup(tab, tabLine, groupContent);
  }

  /**
   * Expands a group, making its tab lines visible.
   * @param groupContainer - The group container element.
   * @param groupId - The ID of the group.
   */
  public expandGroup(groupContainer: HTMLElement, groupId: number): void {
    this.groupStates[groupId] = false;
    const content = groupContainer.querySelector('.tab-group-content') as HTMLElement;
    content.style.maxHeight = `${content.scrollHeight + 100}px`;
    groupContainer.classList.remove('collapsed');
    // Restore tabindex for tab lines
    const tabLines = content.querySelectorAll('.data-container') as NodeListOf<HTMLElement>;
    tabLines.forEach((tabLine) => tabLine.setAttribute('tabindex', '0'));
    this.saveGroupStates();
    // this.adjustGroupHeight(content);
    if (DEBUG) logInfo(E_TYPE, 'Expanded group:', groupId);
  }

  /**
   * Collapses a group, hiding its tab lines.
   * @param groupContainer - The group container element.
   * @param groupId - The ID of the group.
   */
  public collapseGroup(groupContainer: HTMLElement, groupId: number): void {
    this.groupStates[groupId] = true;
    const content = groupContainer.querySelector('.tab-group-content') as HTMLElement;
    if (!content.style.maxHeight || content.style.maxHeight === 'none') {
      content.style.maxHeight = `${content.scrollHeight}px`;
      content.offsetHeight; // Force reflow
    }
    groupContainer.classList.add('collapsed');
    // Remove tabindex for tab lines
    const tabLines = content.querySelectorAll('.data-container') as NodeListOf<HTMLElement>;
    tabLines.forEach((tabLine) => tabLine.setAttribute('tabindex', '-1'));
    this.saveGroupStates();
    if (DEBUG) logInfo(E_TYPE, 'Collapsed group:', groupId);
  }

  /**
   * Adjusts the height of a group container based on its current content.
   * @param content - The group content element.
   * @param groupId - The ID of the group.
   */
  public adjustGroupHeight(content: HTMLElement): void {
    // Temporarily remove max-height to get accurate scrollHeight
    content.style.maxHeight = 'none';
    // console.log(content.scrollHeight);
    content.style.maxHeight = `${content.scrollHeight + 100}px`;
    // Force reflow to ensure scrollHeight updates with new content
    void content.offsetHeight;
  }

  /**
   * Creates a group container for a tab group and sets up its header and content.
   * @param groupId - The string representation of the group ID.
   * @param container - The parent container to append the group to.
   * @param tabGroupId - The numeric ID of the tab group.
   * @private
   */
  private createGroupContainer(groupId: string, container: HTMLElement | DocumentFragment, tabGroupId: number): void {
    const groupContainer = document.createElement('div');
    groupContainer.classList.add('tab-group-container');
    groupContainer.dataset['groupId'] = groupId;

    const groupHeader = document.createElement('div');
    groupHeader.classList.add('tab-group-header');
    groupHeader.textContent = `Group ${groupId}`;
    groupHeader.setAttribute('tabindex', '0');
    groupHeader.setAttribute('draggable', 'true'); // Enable dragging

    const groupContent = document.createElement('div');
    groupContent.classList.add('tab-group-content');

    groupContainer.appendChild(groupHeader);
    groupContainer.appendChild(groupContent);
    container.appendChild(groupContainer);

    this.groupContainers[groupId] = { container: groupContainer, header: groupHeader, content: groupContent };

    groupHeader.addEventListener('click', (e: MouseEvent) => {
      if (e.shiftKey || (this.dialogManager && this.dialogManager.isSelecting())) {
        // Don't toggle collapse during selection mode
        return;
      }
      this.toggleGroupCollapse(groupContainer, tabGroupId);
    });    groupHeader.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') groupHeader.click();
    });

    chrome.tabGroups.get(tabGroupId, (group) => {
      if (group) {
        this.updateInfo(group, groupContainer);
        if (this.groupStates[group.id] === undefined) {
          this.groupStates[group.id] = group.collapsed;
        }
        this.firstToggleGroupCollapse(groupContainer, group.id);
      }
    });
  }

  public updateInfo (group: chrome.tabGroups.TabGroup, groupContainer: HTMLDivElement) {
    if (!group.color || !groupContainer) {
      return;
    }
    const baseColor = COLOR_MAP[group.color] || group.color;
    const groupHeader = groupContainer.querySelector('.tab-group-header') as HTMLDivElement | null;
    const groupContent = groupContainer.querySelector('.tab-group-content') as HTMLDivElement | null;
    if (!groupHeader || !groupContent) {
      return;
    }
    if (group.title) groupHeader.textContent = group.title || `Group ${group.id}`;
    const initColor = hexToRGBA(baseColor, 0.4);
    groupHeader.style.backgroundColor = initColor;
    //groupContent.style.backgroundColor = hexToRGBA(baseColor, 0.4);
    const secondColor = hexToRGBA(baseColor, 0.7);
    groupContent.style.background = `linear-gradient(${initColor}, ${secondColor})`;
    // background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
    //const lr = hexToRGBA(baseColor, 0.3);
    //const rl = hexToRGBA(baseColor, 0.5);
    //const cg = ColorMapGrad[group.color];
    //groupContent.style.background = `linear-gradient(to right, ${cg?.at(1)} 20%, ${cg?.at(-2)} 80%)`;
    // linear-gradient(90deg, rgba(66, 133, 244, 0.3), rgba(66, 133, 244, 0.4))
    //groupContent.style.border = `1px solid ${hexToRGBA(baseColor, 0.7)}`;
  }

  /**
   * Inserts a tab line into a group, maintaining the correct order based on tab index.
   * @param tab - The Chrome tab to insert.
   * @param tabLine - The tab line element to insert.
   * @param groupContent - The group content element to insert into.
   * @private
   */
  private insertTabInGroup(tab: chrome.tabs.Tab, tabLine: HTMLElement, groupContent: HTMLElement): void {
    const replaceAbleElem = groupContent.querySelector(`[data-tab-index="${tab.index}"]`) as HTMLElement | null;
    tabLine.dataset['tabIndex'] = tab.index.toString();

    if (replaceAbleElem) {
      replaceAbleElem.dataset['tabIndex'] = (tab.index + 1).toString();
      groupContent.insertBefore(tabLine, replaceAbleElem);
    } else {
      groupContent.appendChild(tabLine);
    }

    this.adjustGroupHeight(groupContent);
    updateDomIndices(this.tabContainer);
    return;
  }

  /**
   * Toggles the collapse state of a group, syncing with Chrome's tab group state if configured.
   * @param groupContainer - The group container element.
   * @param groupId - The ID of the group.
   * @private
   */
  private toggleGroupCollapse(groupContainer: HTMLElement, groupId: number): void {
    const isCollapsed = this.groupStates[groupId];
    if (this.options.sync_group_folding) {
      this.userInitiatedFold = true;
      if (isCollapsed) {
        this.expandGroup(groupContainer, groupId);
        chrome.tabGroups.update(groupId, { collapsed: false });
      } else {
        this.collapseGroup(groupContainer, groupId);
        chrome.tabGroups.update(groupId, { collapsed: true });
      }
    } else {
      isCollapsed ? this.expandGroup(groupContainer, groupId) : this.collapseGroup(groupContainer, groupId);
    }
  }

  /**
   * Performs the initial collapse/expand toggle for a group based on its saved state or Chrome's tab group state.
   * @param groupContainer - The group container element.
   * @param groupId - The ID of the group.
   * @private
   */
  private firstToggleGroupCollapse(groupContainer: HTMLElement, groupId: number): void {
    if (this.options.sync_group_folding) {
      chrome.tabGroups.get(groupId, (tabGroup) => {
        tabGroup.collapsed ? this.collapseGroup(groupContainer, groupId) : this.expandGroup(groupContainer, groupId);
      });
    } else {
      this.groupStates[groupId]
        ? this.collapseGroup(groupContainer, groupId)
        : this.expandGroup(groupContainer, groupId);
    }
  }
}

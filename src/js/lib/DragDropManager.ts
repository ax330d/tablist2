import { GroupManager } from './GroupManager';
import { assertElement, logError, DEBUG, logInfo } from './logging';

interface DragState {
  draggedElement: HTMLElement | null;
  isGroupDrag: boolean;
  tabIdsInMove: number[];
  lastHoveredGroup?: HTMLElement | null; // Track last group hovered over
}

const E_TYPE = 'DragDropManager';

/**
 * Represents a pre-calculated position where a dragged element can be dropped.
 */
interface DragPosition {
  element: HTMLElement;        // The data-container element
  position: 'before' | 'after'; // Where the drop would occur relative to the element
  y: number;                   // Vertical position in the container (adjusted for scroll)
}

/**
 * Manages drag-and-drop operations for a tab list extension.
 * Handles dragging of tabs and groups via mouse and keyboard, including placeholder positioning and group height adjustments.
 */
export class DragDropManager {
  // Drag operation state and configuration
  public suppressOnMoved: boolean = false;          // Suppresses moved events during tab repositioning
  private dragPositions: DragPosition[] = [];       // Pre-calculated drop positions for efficient lookup
  private placeholder: HTMLDivElement | null = null; // Single reusable placeholder element
  private currentDropZone: DragPosition | null = null; // Current drop position
  private container: HTMLDivElement;                // Root container element (#tabs-container)
  private lastMouseY: number = 0;                   // Tracks last mouse Y to reduce unnecessary updates
  // private wasCollapsedBeforeDrag: boolean = false;  // Tracks if a group was collapsed before dragging
  private isKeyboardDragging: boolean = false;      // Indicates if keyboard dragging is active
  private currentDragIndex: number = -1;            // Index of the current keyboard drag position
  private tabHeight: number = 0;
  private initialScrolY: number = 0;


  // Other instance properties
  private readonly groupManager: GroupManager;
  public dragState: DragState = {
    draggedElement: null,
    isGroupDrag: false,
    tabIdsInMove: [],
    lastHoveredGroup: null,
  };

  // Constants
  private readonly DEFAULT_TAB_HEIGHT_PX = 80;
  private readonly PLACEHOLDER_HEIGHT_FACTOR = 0.5;
  private readonly POSITION_THRESHOLD = 2; // Minimum Y change to trigger placeholder update

  /**
   * Initializes the DragDropManager with a container and group manager.
   * Sets up event listeners for drag operations.
   *
   * @param container - The root container element (#tabs-container).
   * @param groupManager - Instance managing group-related operations.
   */
  constructor(container: HTMLDivElement, groupManager: GroupManager) {
    this.container = container;
    this.groupManager = groupManager;
    this.setupEventListeners();
  }

  /**
   * Retrieves the current drag state.
   * @returns The current state of the drag operation.
   */
  public getDragState(): DragState {
    return this.dragState;
  }

  /**
   * Sets up event listeners on the container for drag-and-drop events, including keyboard support.
   */
  private setupEventListeners(): void {
    this.container.addEventListener('dragstart', this.handleDragStart.bind(this));
    this.container.addEventListener('dragenter', this.handleDragEnter.bind(this));
    this.container.addEventListener('dragleave', this.handleDragLeave.bind(this));
    this.container.addEventListener('dragover', (e) => e.preventDefault());
    this.container.addEventListener('drop', this.handleDrop.bind(this));
    this.container.addEventListener('dragend', this.handleDragEnd.bind(this));
    this.container.addEventListener('keydown', this.handleKeyboardDrag.bind(this), true);
  }

  /**
   * Initializes common drag setup for both mouse and keyboard dragging.
   * @param element - The element being dragged.
   * @param isGroupDrag - Whether the drag involves a group.
   */
  private initializeDrag(element: HTMLElement, isGroupDrag: boolean): void {
    this.dragState.isGroupDrag = isGroupDrag;
    this.dragState.draggedElement = element;
    element.classList.add(isGroupDrag ? 'dragging-group' : 'dragging');
    setTimeout(() => (element.style.opacity = '0.1'), 0);
    this.initializeDragState(element);
    this.dragPositions = this.buildDragPositions();
  }

  /**
   * Handles the start of a mouse-based drag operation, initializing state and data transfer.
   * @param e - The dragstart event.
   */
  private handleDragStart(e: DragEvent): void {
    this.initialScrolY = window.scrollY;
    const target = e.target as HTMLElement;
    const dragHandle = target.closest('.drag-handle') as HTMLElement | null;
    const groupHeader = target.closest('.tab-group-header') as HTMLElement | null;

    if (!dragHandle && !groupHeader) return;

    const element = dragHandle
      ? target.closest('.data-container') as HTMLElement
      : groupHeader?.closest('.tab-group-container') as HTMLElement;
    if (!element) return;

    const isGroupDrag = !!groupHeader;
    this.initializeDrag(element, isGroupDrag);

    const dataTransfer = e.dataTransfer!;
    dataTransfer.dropEffect = 'move';
    dataTransfer.effectAllowed = 'move';
    dataTransfer.setData('text/plain', isGroupDrag ? element.dataset['groupId']! : element.dataset['tabId']!);

    if (!isGroupDrag) {
      const rect = element.getBoundingClientRect();
      dataTransfer.setDragImage(element, rect.width - 130, rect.height / 2);
    }

    element.addEventListener('drag', this.handleDrag.bind(this));
    if (DEBUG) {
      const info = `${isGroupDrag ? 'group' : 'tab'}, ${element.dataset['groupId'] || element.dataset['tabId']}`;
      logInfo(E_TYPE, 'Mouse drag started on:', info);
    }
  }

  /**
   * Updates the placeholder position during continuous mouse dragging.
   * @param e - The drag event.
   */
  private handleDrag(e: DragEvent): void {
    const mouseY = e.clientY + this.container.scrollTop;
    if (mouseY === 0 && e.clientY === 0) return;

    if (Math.abs(mouseY - this.lastMouseY) < this.POSITION_THRESHOLD) return;
    this.lastMouseY = mouseY;
    this.updatePlaceholderPosition(mouseY);
  }

  /**
   * Handles drag entering the container for mouse dragging, updating the placeholder.
   * @param e - The dragenter event.
   */
  private handleDragEnter(e: DragEvent): void {
    e.preventDefault();
    const mouseY = e.clientY + this.container.scrollTop;
    this.lastMouseY = mouseY;
    this.updatePlaceholderPosition(mouseY);
    if (DEBUG) logInfo(E_TYPE, 'Drag entered container at mouseY:', mouseY);
  }

  /**
   * Handles drag leaving the container for mouse dragging, cleaning up if necessary.
   * @param e - The dragleave event.
   */
  private handleDragLeave(e: DragEvent): void {
    const rect = this.container.getBoundingClientRect();
    const mouseY = e.clientY;
    if (mouseY < rect.top || mouseY > rect.bottom) {
      // this.resetLastHoveredGroup();
      this.removePlaceholder();
      this.currentDropZone = null;
      if (DEBUG) logInfo(E_TYPE, 'Drag left container, cleaned up placeholder');
    }
  }

  /**
   * Handles dropping an element via mouse, repositioning it in the DOM and updating state.
   * @param e - The drop event.
   */
  private handleDrop(e: DragEvent): void {
    e.preventDefault();
    if (!this.dragState.draggedElement || !this.placeholder) return;

    const targetContainer = this.placeholder.parentNode as HTMLElement;
    targetContainer.insertBefore(this.dragState.draggedElement, this.placeholder);
    this.handleDropLogic(this.dragState.draggedElement, targetContainer);
    this.finalizeDrop(targetContainer);
    if (DEBUG) logInfo(E_TYPE, 'Dropped element into container via mouse:', targetContainer);
  }

  /**
   * Cleans up after a mouse drag operation ends.
   */
  private handleDragEnd(): void {
    const element = this.dragState.draggedElement;
    if (element) {
      element.classList.remove(this.dragState.isGroupDrag ? 'dragging-group' : 'dragging');
      element.style.opacity = '1';
      element.removeEventListener('drag', this.handleDrag.bind(this));
    } else {
      logError(E_TYPE, 'draggedElement was null in handleDragEnd');
    }

    // this.resetLastHoveredGroup();
    this.removePlaceholder();
    this.dragPositions = [];
    this.currentDropZone = null;
    this.isKeyboardDragging = false;
    this.currentDragIndex = -1;
    this.dragState.draggedElement = null;
    if (DEBUG) logInfo(E_TYPE, 'Mouse drag operation ended');
  }

  /**
   * Handles keyboard events to initiate and control dragging.
   * @param e - The keydown event.
   */
  private handleKeyboardDrag(e: KeyboardEvent): void {
    if (e.code === 'Tab') return; // Allow default tab navigation

    const target = e.target as HTMLElement;
    const element = (target.closest('.data-container') || target.closest('.tab-group-container')) as HTMLElement;
    if (!element) return;

    if (e.key === 'd' && !this.isKeyboardDragging) {
      e.preventDefault();
      this.startKeyboardDrag(element);
    } else if (this.isKeyboardDragging && this.dragState.draggedElement === element) {
      e.preventDefault();
      e.stopPropagation();
      switch (e.key) {
        case 'ArrowUp':
          this.moveKeyboardDrag(-1);
          break;
        case 'ArrowDown':
          this.moveKeyboardDrag(1);
          break;
        case 'Enter':
          this.dropKeyboardDrag();
          break;
        case 'Escape':
          this.cancelKeyboardDrag();
          break;
      }
    }
  }

  /**
   * Initiates a keyboard-based drag operation on the specified element.
   * @param element - The element to start dragging.
   */
  private startKeyboardDrag(element: HTMLElement): void {
    if (this.isKeyboardDragging) return;

    this.isKeyboardDragging = true;
    const isGroupDrag = element.classList.contains('tab-group-container');
    this.initializeDrag(element, isGroupDrag);

    // Find the initial index based on the element's 'after' position
    this.currentDragIndex = this.dragPositions.findIndex(pos => pos.element === element && pos.position === 'after');
    if (this.currentDragIndex === -1) {
      // Fallback to closest position
      const elementRect = element.getBoundingClientRect();
      const elementY = elementRect.bottom + this.container.scrollTop;
      this.currentDragIndex = this.dragPositions.reduce((closestIdx, pos, idx) => {
        const currentPos = this.dragPositions[closestIdx];
        // If currentPos is null or undefined, treat it as "infinitely far" so idx wins if pos is valid
        if (currentPos == null) return idx;
        return Math.abs(pos.y - elementY) < Math.abs(currentPos.y - elementY) ? idx : closestIdx;
      }, 0);
    }

    this.moveToCurrentIndex();
    element.focus();
    if (DEBUG) {
      const info = `${isGroupDrag ? 'group' : 'tab'}, ${element.dataset['groupId'] || element.dataset['tabId']}, at index ${this.currentDragIndex}`;
      logInfo(E_TYPE, 'Keyboard drag started on:', info);
    }
  }

  /**
   * Moves the placeholder up or down during keyboard dragging.
   * @param direction - Direction to move (-1 for up, 1 for down).
   */
  private moveKeyboardDrag(direction: number): void {
    if (!this.dragState.draggedElement || !this.placeholder) return;

    this.currentDragIndex = this.wrapIndex(this.currentDragIndex + direction, this.dragPositions.length);
    this.moveToCurrentIndex();
    if (DEBUG) logInfo(E_TYPE, 'Keyboard moved to index:', this.currentDragIndex);
  }

  /**
   * Drops the dragged element at the current keyboard position.
   */
  private dropKeyboardDrag(): void {
    const draggedElement = this.dragState.draggedElement;
    const dropPlaceholder = this.placeholder;
    if (!draggedElement || !dropPlaceholder) return;

    const targetContainer = dropPlaceholder.parentNode as HTMLElement;
    targetContainer.insertBefore(draggedElement, dropPlaceholder);
    this.handleDropLogic(draggedElement, targetContainer);
    this.finalizeDrop(targetContainer);
    if (DEBUG) logInfo(E_TYPE, 'Keyboard drop completed');
  }

  /**
   * Cancels the keyboard drag operation, resetting state.
   */
  private cancelKeyboardDrag(): void {
    const draggedElement = this.dragState.draggedElement;
    const dropPlaceholder = this.placeholder;
    if (!draggedElement || !dropPlaceholder) return;

    dropPlaceholder.remove();
    this.resetDragState(draggedElement);
    if (DEBUG) logInfo(E_TYPE, 'Keyboard drag canceled');
  }

  /**
   * Moves the placeholder to the current keyboard drag index.
   */
  private moveToCurrentIndex(): void {
    const position = this.dragPositions[this.currentDragIndex];
    if (!position) {
      logError(E_TYPE, 'Invalid drag position index:', this.currentDragIndex);
      return;
    }

    this.currentDropZone = position;
    if (DEBUG) {
      const info = `${position.position} of element ${position.element.dataset['tabId'] || position.element.dataset['groupId']}`;
      logInfo(E_TYPE, 'Moving to position:', info);
    };

    this.updatePlaceholderPosition(undefined, true);
  }

  /**
   * Wraps the index around the array bounds for circular navigation.
   * @param index - The current index.
   * @param length - The length of the positions array.
   * @returns The wrapped index.
   */
  private wrapIndex(index: number, length: number): number {
    return (index + length) % length;
  }

  /**
   * Builds an array of possible drop positions for efficient lookup.
   * @returns Array of pre-calculated drop positions.
   */
  private buildDragPositions(): DragPosition[] {
    const positions: DragPosition[] = [];
    const elements = Array.from(this.container.children) as HTMLElement[];

    if (elements.length === 0) return positions;
    const element = elements[0];
    assertElement(element, 'Element is null or undefined!');
    positions.push({ element, position: 'before', y: element.getBoundingClientRect().top });

    elements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (element.classList.contains('tab-group-container') && !this.dragState.isGroupDrag && !element.classList.contains('collapsed')) {
        const groupContent = element.querySelector('.tab-group-content') as HTMLElement | null;
        if (groupContent) {
          const groupTabs = Array.from(groupContent.children) as HTMLElement[];
          groupTabs.forEach((tab, index) => {
            const tabRect = tab.getBoundingClientRect();
            if (index === 0) positions.push({ element: tab, position: 'before', y: tabRect.top });
            positions.push({ element: tab, position: 'after', y: tabRect.bottom });
          });
        }
      }
      positions.push({ element, position: 'after', y: rect.bottom });
    });
    if (DEBUG) logInfo(E_TYPE, 'Built drag positions:', positions.length);
    return positions;
  }

  /**
   * Finds the closest drop position based on the mouse Y coordinate, using a 30% threshold logic.
   * Places the placeholder before a tab if the mouse is in the upper 30%, after if below 30%.
   * Adjusts for the current scroll position.
   * @param mouseY - The current mouse Y position, adjusted for scroll.
   * @returns The closest drop position or null if none found.
   */
  private findClosestDragPosition(mouseY: number): DragPosition | null {
    if (!this.dragPositions.length) {
      logError(E_TYPE, 'No drag positions available');
      return null;
    }

    const firstPosElement = this.dragPositions[0];
    assertElement(firstPosElement, 'Element is null or undefined!');
    const closestPos = this.dragPositions.reduce((closest: DragPosition, pos: DragPosition) => {
      // Take into account scroll
      const diff = window.scrollY - this.initialScrolY;
      const distance = Math.abs(mouseY - pos.y + diff);
      return distance < Math.abs(mouseY - closest.y + diff) ? pos : closest;
    }, firstPosElement);

    const elementRect = closestPos.element.getBoundingClientRect();

    const elementTop = elementRect.top;
    const elementBottom = elementRect.bottom;

    // Use a 30% threshold instead of 50% (midpoint)
    const threshold = elementTop + (elementBottom - elementTop) * 0.2;

    const position = mouseY < threshold ? 'before' : 'after';
    return {
      element: closestPos.element,
      position,
      y: position === 'before' ? elementTop : elementBottom,
    };
  }

  /**
   * Updates the placeholder position based on mouse or keyboard input.
   * For mouse dragging, finds the closest drop zone; for keyboard, uses the current index.
   * Adjusts group heights when dropping at the bottom of a group and resets when leaving.
   * @param mouseY - Mouse Y position (required for mouse dragging, ignored for keyboard).
   * @param isKeyboard - Whether this is a keyboard-driven update (default: false).
   */
  private updatePlaceholderPosition(mouseY?: number, isKeyboard: boolean = false): void {
    let dropZone: DragPosition | null;
    if (isKeyboard) {
      dropZone = this.currentDropZone;
      if (!dropZone) {
        logError(E_TYPE, 'No currentDropZone set for keyboard dragging');
        return;
      }
    } else {
      if (mouseY === undefined) {
        logError(E_TYPE, 'mouseY required for mouse dragging');
        return;
      }
      dropZone = this.findClosestDragPosition(mouseY);
      if (!dropZone) {
        logError(E_TYPE, 'No drop zone found for mouseY:', mouseY);
        return;
      }
    }

    if (!isKeyboard && dropZone.element === this.currentDropZone?.element && dropZone.position === this.currentDropZone?.position) {
      if (DEBUG) logInfo(E_TYPE, 'Drop zone unchanged, skipping update');
      return;
    }

    this.removePlaceholder();
    this.showPlaceholder(dropZone);
    this.currentDropZone = dropZone;
    if (DEBUG) {
      const info = `${dropZone.position} of element ${dropZone.element.dataset['tabId'] || dropZone.element.dataset['groupId']}`;
      logInfo(E_TYPE, 'Placeholder updated at:', info);
    };
  }

  /**
   * Displays the placeholder at the specified drop position.
   * @param dropZone - The position where the placeholder should appear.
   */
  private showPlaceholder(dropZone: DragPosition): void {
    if (!this.placeholder) {
      const height = this.getTabHeight(this.container);
      this.placeholder = document.createElement('div');
      this.placeholder.className = 'drop-placeholder';
      this.placeholder.style.height = `${height * this.PLACEHOLDER_HEIGHT_FACTOR}px`;
    }

    const parent = dropZone.element.parentNode as HTMLElement;
    if (dropZone.position === 'before') {
      parent.insertBefore(this.placeholder, dropZone.element);
    } else {
      parent.insertBefore(this.placeholder, dropZone.element.nextSibling || null);
    }
    if (DEBUG) logInfo(E_TYPE, 'Placeholder shown at:', dropZone.position);
  }

  /**
   * Removes the placeholder from the DOM if it exists.
   */
  private removePlaceholder(): void {
    if (this.placeholder && this.placeholder.parentNode) {
      this.placeholder.remove();
      if (DEBUG) logInfo(E_TYPE, 'Removed existing placeholder');
    }
  }

  /**
   * Initializes the drag state for a new drag operation.
   * @param element - The element being dragged.
   */
  private initializeDragState(element: HTMLElement): void {
    this.dragState.tabIdsInMove = [];
    this.dragState.lastHoveredGroup = null;
    if (DEBUG) logInfo(E_TYPE, 'Drag state initialized for element:', element.dataset['groupId'] || element.dataset['tabId']);
  }

  /**
   * Resets the drag state after a keyboard drag operation ends.
   * @param element - The element that was dragged.
   */
  private resetDragState(element: HTMLElement): void {
    this.isKeyboardDragging = false;
    this.currentDragIndex = -1;
    element.classList.remove(this.dragState.isGroupDrag ? 'dragging-group' : 'dragging');
    element.style.opacity = '1';
    element.focus();
    if (DEBUG) logInfo(E_TYPE, 'Drag state reset after keyboard operation');
  }

  /**
   * Processes drop logic based on whether a group or tab was dropped.
   * @param element - The dropped element.
   * @param targetContainer - The container where the element was dropped.
   */
  private handleDropLogic(element: HTMLElement, targetContainer: HTMLElement): void {
    if (this.dragState.isGroupDrag) {
      this.handleGroupDrop(element);
    } else {
      this.handleTabDrop(element, targetContainer);
    }
  }

  /**
   * Finalizes the drop by updating the UI and resetting temporary states.
   * @param targetContainer - The container where the drop occurred.
   */
  private finalizeDrop(targetContainer: HTMLElement): void {
    const draggedElement = this.dragState.draggedElement;
    if (!draggedElement) throw new Error('Unexpected: draggedElement is null');

    this.finalizeGroupDrop(targetContainer);
    this.updateDomIndices(this.container);
    this.removePlaceholder();
    this.resetDragState(draggedElement);
    if (DEBUG) logInfo(E_TYPE, 'Drop finalized in container');
  }

  /**
   * Finalizes group-specific adjustments after a drop.
   * @param targetContainer - The container where the drop occurred.
   */
  private finalizeGroupDrop(targetContainer: HTMLElement): void {
    const groupContainer = targetContainer.closest('.tab-group-container') as HTMLElement | null;
    if (groupContainer) {
      const content = groupContainer.querySelector('.tab-group-content') as HTMLElement;
      this.groupManager.adjustGroupHeight(content);
    }
  }

  /**
   * Handles dropping a group, updating its position via Chrome API.
   * @param element - The group element being dropped.
   */
  private handleGroupDrop(element: HTMLElement): void {
    const groupId = parseInt(element.dataset['groupId'] || '', 10);
    const firstTab = element.querySelector('.data-container') as HTMLElement | null;
    const tabs = Array.from(element.querySelectorAll('.data-container')) as HTMLElement[];
    this.dragState.tabIdsInMove = tabs.map(tab => parseInt(tab.dataset['tabId'] || '', 10));
    const tabNodes = Array.from(document.querySelectorAll('.data-container')) as HTMLElement[];
    const newIndex = firstTab ? tabNodes.indexOf(firstTab) : -1;

    if (!isNaN(groupId) && newIndex !== -1) {
      chrome.tabGroups.move(groupId, { index: newIndex }, () => {
        if (chrome.runtime.lastError) logError(E_TYPE, `Failed to move group ${groupId}:`, chrome.runtime.lastError);
      });
      if (DEBUG) logInfo(E_TYPE, 'Moved group:', `${groupId}, to index: ${newIndex}`);
    }
  }

  /**
   * Handles dropping a tab, updating its position and group membership.
   * @param element - The tab element being dropped.
   * @param targetContainer - The container where the tab was dropped.
   */
  private handleTabDrop(element: HTMLElement, targetContainer: HTMLElement): void {
    const tabId = parseInt(element.dataset['tabId'] || '', 10);
    if (isNaN(tabId)) return;

    const tabNodes = Array.from(document.querySelectorAll('.data-container')) as HTMLElement[];
    const newIndex = tabNodes.indexOf(element);

    this.suppressOnMoved = true;
    chrome.tabs.move(tabId, { index: newIndex }, (movedTab) => {
      if (chrome.runtime.lastError) {
        logError(E_TYPE, 'Error moving tab:', chrome.runtime.lastError);
        return;
      }
      if (movedTab) this.updateTabGroup(tabId, targetContainer, movedTab.groupId);
      setTimeout(() => (this.suppressOnMoved = false), 500);
    });
    if (DEBUG) logInfo(E_TYPE, 'Moved tab:', `${tabId} to index: ${newIndex}`);
  }

  /**
   * Updates a tab's group membership after dropping.
   * @param tabId - The ID of the moved tab.
   * @param targetContainer - The drop target container.
   * @param currentGroupId - The tab's current group ID.
   */
  private updateTabGroup(tabId: number, targetContainer: HTMLElement, currentGroupId: number): void {
    if (targetContainer.classList.contains('tab-group-content')) {
      const groupId = parseInt(targetContainer.parentElement!.dataset['groupId'] || '', 10);
      if (!isNaN(groupId) && currentGroupId !== groupId) {
        chrome.tabs.group({ tabIds: [tabId], groupId });
        if (DEBUG) logInfo(E_TYPE, 'Grouped tab:', `${tabId} into group: ${groupId}`);
      }
    } else if (currentGroupId !== -1) {
      chrome.tabs.ungroup(tabId);
      if (DEBUG) logInfo(E_TYPE, 'Ungrouped tab:', tabId);
    }
  }

  /**
   * Updates DOM indices for tabs after a drop to maintain order.
   * @param container - The container with reordered tabs.
   */
  private updateDomIndices(container: HTMLElement): void {
    const tabElements = container.querySelectorAll('.data-container') as NodeListOf<HTMLElement>;
    tabElements.forEach((el, index) => (el.dataset['tabIndex'] = index.toString()));
    if (DEBUG) logInfo(E_TYPE, 'Updated DOM indices for', `${tabElements.length} tabs`);
  }

  /**
   * Calculates the height of a tab element or returns a default value.
   * @param container - The container to query for tab height.
   * @returns The height of a tab in pixels.
   */
  private getTabHeight(container: HTMLElement): number {
    if (this.tabHeight === 0) {
      this.tabHeight = (container.querySelector('.data-container') as HTMLElement | null)?.offsetHeight || this.DEFAULT_TAB_HEIGHT_PX;
    }
    return this.tabHeight;
  }
}
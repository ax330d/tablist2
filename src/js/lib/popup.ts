import { logError } from "./logging";

const E_TYPE = 'popup';

/**
 * Shows a popup by activating the overlay and animating the popup content.
 * @param popupId - The ID of the popup element to show.
 * @param btn - Button to focus on after closing popup.
 */
export function showPopup(popupId: string, btn: HTMLElement): void {
  const mainContent = document.getElementById('main-content') as HTMLElement | null;
  const popup = document.getElementById(popupId) as HTMLElement | null;
  const overlay = document.getElementById('modal-overlay') as HTMLElement | null;

  if (!popup || !overlay) {
    logError(E_TYPE, 'Popup or overlay not found');
    return;
  }

  // Remove hidden class to enable animation
  popup.classList.remove('hidden');

  // Append popup to overlay if not already present
  if (!overlay.contains(popup)) {
    overlay.appendChild(popup);
  }

  // Use requestAnimationFrame for smooth CSS transition
  requestAnimationFrame(() => {
    overlay.classList.add('active');
    popup.classList.add('active');
    if (mainContent) mainContent.classList.add('modal-blur');
  });

  // Setup close button
  const closeBtn = popup.querySelector('.popup-close') as HTMLElement | null;
  if (closeBtn) {
    closeBtn.onclick = hidePopup;
    setTimeout(() => {
      (closeBtn.firstElementChild as HTMLElement | null)?.focus();
    }, 100);
    closeBtn?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        hidePopup();
        btn.focus();
      }
    });
  }

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      hidePopup();
      btn.focus();
    }
  });

  // Close on overlay click (outside popup)
  overlay.onclick = (e: MouseEvent) => {
    if (e.target === overlay) {
      hidePopup();
    }
  };
}

/**
 * Hides the active popup and resets the overlay.
 */
export function hidePopup(): void {
  const overlay = document.getElementById('modal-overlay') as HTMLElement | null;
  if (!overlay) return;

  const mainContent = document.getElementById('main-content') as HTMLElement | null;
  if (mainContent) mainContent.classList.remove('modal-blur');

  // Remove active classes to trigger fade-out animation
  overlay.classList.remove('active');

  const popup = overlay.querySelector('.popup-content') as HTMLElement | null;
  if (popup) {
    popup.classList.remove('active');
    // Move popup back to body after animation (300ms matches CSS transition)
    setTimeout(() => {
      popup.classList.add('hidden');
      document.body.appendChild(popup);
    }, 300);
  }
}

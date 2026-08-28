import { useEffect, useRef } from 'react';

/**
 * Custom hook to intercept phone/browser back button presses when a modal, popup, or camera scanner is open.
 * Closes the modal instead of navigating back to previous tab/page.
 */
export function useBackButtonClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const modalId = 'modal_' + Math.random().toString(36).substring(2, 9);

    // 1. Push a temporary history entry for this modal
    try {
      window.history.pushState(
        { isModal: true, modalId, tab: window.location.hash.replace('#', '') || 'catalog' },
        '',
        window.location.href
      );
    } catch (e) {
      // ignore
    }

    let closedByPopstate = false;

    // 2. Handle popstate (mobile/browser back button pressed)
    const handlePopState = () => {
      closedByPopstate = true;
      // Mark as handled so App.tsx tab popstate handler ignores tab change
      (window as any).__modalHandledPopState = true;

      if (onCloseRef.current) {
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // 3. If modal was closed via UI (X button, save, backdrop click) rather than back button,
      // revert the history entry we pushed so history stack stays clean.
      if (!closedByPopstate) {
        try {
          if (window.history.state && window.history.state.modalId === modalId) {
            (window as any).__modalHandledPopState = true;
            window.history.back();
          }
        } catch (e) {
          // ignore
        }
      }
    };
  }, [isOpen]);
}

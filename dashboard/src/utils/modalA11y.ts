/**
 * Accessibility wiring for the shared Modal dialog. Extracted from the component so the behavior
 * (Escape to close, focus trap, initial focus, focus restore, background scroll lock) is unit-testable
 * without a DOM renderer — the React effect in Modal.tsx is a thin wrapper around this binder.
 *
 * The binder is typed against the real DOM (`Document`/`HTMLElement`); tests pass minimal fakes.
 */

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Stack of currently-open dialogs, most recently opened last. Every binder listens for keydown on
// the same document in the capture phase, and stopPropagation() does NOT stop same-target
// listeners — so without this stack, Escape inside a nested dialog also closes the parent and
// loses its form input. Only the topmost entry owns Escape.
const modalStack: object[] = [];

function visibleFocusables(card: HTMLElement): HTMLElement[] {
  return Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.offsetParent !== null);
}

/**
 * Wires one open dialog: locks background scroll, moves focus into the dialog, traps Tab inside it,
 * closes on Escape, and returns a cleanup that restores scroll and focus to the element that was
 * focused when the dialog opened (the trigger).
 */
export function bindModalA11y(doc: Document, card: HTMLElement, onClose: () => void): () => void {
  const previousOverflow = doc.body.style.overflow;
  doc.body.style.overflow = 'hidden';

  // Unconditionally store active element on modal open
  const active = doc.activeElement as HTMLElement | null;
  const previouslyFocused = active;

  const stackEntry = {};
  modalStack.push(stackEntry);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      // A nested dialog is open above this one — it owns Escape (see modalStack).
      if (modalStack[modalStack.length - 1] !== stackEntry) return;
      // Capture phase: nested widgets (selects, menus) may also listen for Escape — the dialog
      // owns dismissal while it is open.
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === 'Tab') {
      const focusables = visibleFocusables(card);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  doc.addEventListener('keydown', onKeyDown, true);

  // Initial focus: the first visible focusable in the dialog, else the dialog card itself.
  (visibleFocusables(card)[0] ?? card).focus();

  return () => {
    const stackIndex = modalStack.indexOf(stackEntry);
    if (stackIndex !== -1) modalStack.splice(stackIndex, 1);
    doc.removeEventListener('keydown', onKeyDown, true);
    doc.body.style.overflow = previousOverflow;
    // Unconditionally attempt focus restoration on close with null & detached element guards
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      if (!doc.contains || doc.contains(previouslyFocused)) {
        try {
          previouslyFocused.focus();
        } catch {
          // ignore focus errors on detached elements
        }
      }
    }
  };
}

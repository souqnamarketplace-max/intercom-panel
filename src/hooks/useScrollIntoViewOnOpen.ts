import { useEffect, useRef } from 'react';

/**
 * Scrolls the given ref's element into view whenever `open` becomes true.
 * Used so tapping a field to open the on-screen keyboard/keypad always
 * brings that field into visible space above the keyboard, rather than
 * relying on the person to manually scroll on a short kiosk screen.
 */
export function useScrollIntoViewOnOpen<T extends HTMLElement>(open: boolean) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (open && ref.current) {
      // Small delay lets the keyboard finish rendering/laying out first,
      // so the scroll offset accounts for its final height.
      const t = setTimeout(() => {
        ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  return ref;
}

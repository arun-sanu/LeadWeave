import { useEffect } from 'react';

// Dark is the only supported theme. This hook exists solely so Plugins.tsx
// can pass a resolved theme value to plugin iframes via postMessage.
export type Theme = 'dark';

export function useTheme() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  return {
    theme: 'dark' as Theme,
    resolvedTheme: 'dark' as Theme,
  };
}

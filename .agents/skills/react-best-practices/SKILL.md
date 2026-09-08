---
name: react-best-practices
description: Core guidelines for writing performant, maintainable React components, hooks, and state management (Zustand) in the OpenWA dashboard. Use whenever generating or refactoring React UI code.
---

# React & Zustand Best Practices

This skill enforces high-performance, maintainable React patterns, specifically tailored for the OpenWA dashboard frontend. Read this before modifying `.tsx` components, `.ts` stores, or custom hooks.

## 1. State Management (Zustand)
- **Granular Selectors:** NEVER invoke the store hook without a selector. Always use granular selectors to prevent unnecessary component re-renders.
  - **Bad:** `const { user, login } = useAuthStore()`
  - **Good:** `const user = useAuthStore((state) => state.user); const login = useAuthStore((state) => state.login);`
- **Action Separation:** Keep actions well-defined and try to update state immutably within the set functions.
- **Async Logic:** Handle side-effects (like Supabase API calls) directly within Zustand actions to keep your React components clean and focused purely on the UI.

## 2. Component Architecture
- **Single Responsibility:** Break down large components. If a file is over 150-200 lines, consider extracting smaller sub-components.
- **Strict Typing:** Always define explicit `interface` or `type` definitions for component Props. Avoid `any` at all costs.
- **Memoization (`useMemo`, `useCallback`):**
  - Only use `useMemo` for expensive mathematical calculations or when passing object/array references to memoized child components.
  - Only use `useCallback` when passing functions to optimized child components (like those wrapped in `React.memo`) or when the function is a dependency in a `useEffect`. Do not overuse them.

## 3. Side Effects (`useEffect`)
- **Minimize `useEffect`:** If you can derive state during rendering or handle it directly in an event handler (e.g., `onClick`), DO NOT use `useEffect`.
- **Cleanup:** Always provide a cleanup function in `useEffect` when setting up WebSocket listeners (like Supabase Realtime), subscriptions, or timers.
- **Dependency Arrays:** Never ignore exhaustive-deps warnings. If a dependency changes too often, reconsider your hook structure or use functional state updates (e.g., `setCount(c => c + 1)`).

## 4. Performance & Rendering
- **Keys in Lists:** Never use array indices as `key` props unless the list is completely static. Always use unique identifiers (like a database ID).
- **Conditional Rendering:** Be careful with `condition && <Component />` if `condition` can be `0`. Use `!!condition` or `condition > 0` to prevent rendering a stray "0" on the screen.

## 5. UI and Styles
- Ensure any UI additions comply with the `no-ai-design-slop` and `emil-design-eng` skills already present in the workspace.
- Co-locate CSS files closely with their components (e.g., `Logs.tsx` alongside `Logs.css`).

---
name: testing-best-practices
description: Guidelines for writing robust, maintainable Unit and E2E tests for the OpenWA backend and frontend. Use whenever generating or modifying tests.
---

# Testing Best Practices

Follow these guidelines to ensure our test suite is resilient, fast, and actually catches bugs without being brittle to refactoring.

## 1. Backend Testing (NestJS / Jest)

- **Mock Heavy I/O:** Never hit a real database or external API (like WhatsApp or Supabase) in a unit test. Always mock the repository layer or external service providers.
- **Arrange, Act, Assert (AAA):** Structure every test explicitly in three sections.
- **Test Behaviors, Not Implementations:** Don't test that a specific private method was called. Test that the public API returns the expected output for a given input.
- **Error States:** Explicitly test how controllers and services handle thrown exceptions (e.g., `NotFoundException` or `UnauthorizedException`).

## 2. Frontend State Testing (Zustand / React)

- **Store Resets:** When testing Zustand stores, always reset the store state `beforeEach` to prevent state leakage between tests.
- **Action Verification:** Test the store's actions directly (e.g., call `login()` and assert that `user` is set in the state).

## 3. Frontend UI Testing

- **User-Centric Queries:** Use queries that mimic how a user finds elements (e.g., `getByRole`, `getByText`, `getByLabelText`) rather than relying on brittle CSS classes or `test-id`s if possible.
- **Async Interactions:** Always use `waitFor` or `findBy` when asserting UI states that depend on asynchronous actions (like loading spinners resolving).

## 4. E2E Testing (Playwright / Cypress)

- **Data Seeding:** E2E tests should start with a known, isolated state. Seed a test database before the run and tear it down afterward.
- **Resilient Selectors:** Rely on accessibility attributes and roles for selections to ensure the tests survive UI layout changes.

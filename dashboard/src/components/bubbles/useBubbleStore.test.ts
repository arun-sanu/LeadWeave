import '../../test-helpers/register-hooks.ts';
import { afterEach, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import type { installJsdomGlobals as installJsdomGlobalsFn } from '../../test-helpers/jsdom.ts';

type BubbleStoreModule = typeof import('./useBubbleStore.ts');
type RTL = typeof import('@testing-library/react');

let bubbleStore: BubbleStoreModule['bubbleStore'];
let useBubbleStore: BubbleStoreModule['useBubbleStore'];
let rtl: RTL;

before(async () => {
  const { installJsdomGlobals } = (await import('../../test-helpers/jsdom.ts')) as {
    installJsdomGlobals: typeof installJsdomGlobalsFn;
  };
  await installJsdomGlobals();
  localStorage.clear();
  ({ bubbleStore, useBubbleStore } = await import('./useBubbleStore.ts'));
  rtl = await import('@testing-library/react');
});

afterEach(() => {
  rtl.cleanup();
  localStorage.clear();
});

test('a large seed produces one persistence and notification cycle without rerendering an unchanged unread selector', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });

  let listenerCalls = 0;
  let renderCount = 0;
  let storageWrites = 0;
  const unsubscribe = bubbleStore.subscribe(() => {
    listenerCalls += 1;
  });
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (...args: Parameters<Storage['setItem']>) {
    storageWrites += 1;
    return originalSetItem.apply(this, args);
  };

  function UnreadBadge() {
    renderCount += 1;
    const totalUnread = useBubbleStore(snapshot => snapshot.totalUnread);
    return createElement('span', null, totalUnread);
  }

  try {
    rtl.render(createElement(UnreadBadge));
    assert.equal(renderCount, 1);

    rtl.act(() => {
      bubbleStore.batchAddOrUpdateBubbles(
        Array.from({ length: 200 }, (_, index) => ({
          chatId: `performance-seed-${index}@c.us`,
          sessionId: 'performance-session',
          name: `Contact ${index}`,
          unreadCount: 0,
          lastMessage: 'Seeded without an unread change',
        })),
      );
      t.mock.timers.tick(50);
    });

    assert.equal(listenerCalls, 1);
    assert.equal(renderCount, 1);

    t.mock.timers.tick(250);
    assert.equal(storageWrites, 1);
  } finally {
    unsubscribe();
    Storage.prototype.setItem = originalSetItem;
  }
});

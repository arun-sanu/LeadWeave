import { test } from 'node:test';
import assert from 'node:assert/strict';
import { idbGet, idbSet, idbDelete } from './indexedDbStore.ts';

test('indexedDbStore: sets, gets, and deletes key-value pairs with fallback', async () => {
  const testKey = 'test_sample_key';
  const testData = { name: 'LeadWeave Task', count: 42 };

  await idbSet(testKey, testData);
  const retrieved = await idbGet<typeof testData>(testKey);
  assert.deepEqual(retrieved, testData);

  await idbDelete(testKey);
  const deleted = await idbGet<typeof testData>(testKey);
  assert.equal(deleted, null);
});

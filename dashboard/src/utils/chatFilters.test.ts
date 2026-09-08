import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterChats, filterGroupChats, filterArchivedChats, filterChannels, groupStatusesByContact } from './chatFilters.ts';

const chat = (id: string, name?: string, kind?: string, isGroup?: boolean, archived?: boolean) => ({
  id,
  name,
  kind,
  isGroup,
  archived,
});

test('the chats tab shows only 1-on-1 direct non-archived conversations', () => {
  const all = [
    chat('a@c.us', 'Alice', 'individual', false, false),
    chat('g@g.us', 'Dev Team', 'group', true, false),
    chat('archived@c.us', 'Old Chat', 'individual', false, true),
    chat('n@newsletter', 'News', 'channel', false, false),
    chat('s@broadcast', 'S', 'status', false, false),
  ];

  assert.deepEqual(
    filterChats(all, '').map(c => c.id),
    ['a@c.us'],
  );
});

test('the groups tab shows only non-archived groups', () => {
  const all = [
    chat('a@c.us', 'Alice', 'individual', false, false),
    chat('g1@g.us', 'Dev Team', 'group', true, false),
    chat('g2@g.us', 'Marketing', 'group', true, true), // archived group
  ];

  assert.deepEqual(
    filterGroupChats(all, '').map(c => c.id),
    ['g1@g.us'],
  );
  assert.deepEqual(
    filterGroupChats(all, 'dev').map(c => c.id),
    ['g1@g.us'],
  );
  assert.deepEqual(
    filterGroupChats(all, 'market').map(c => c.id),
    [],
  );
});

test('the archive tab shows all archived direct chats and groups', () => {
  const all = [
    chat('a@c.us', 'Alice', 'individual', false, false),
    chat('archived-user@c.us', 'Old Friend', 'individual', false, true),
    chat('archived-group@g.us', 'Old Project', 'group', true, true),
  ];

  assert.deepEqual(
    filterArchivedChats(all, '').map(c => c.id),
    ['archived-user@c.us', 'archived-group@g.us'],
  );
  assert.deepEqual(
    filterArchivedChats(all, 'friend').map(c => c.id),
    ['archived-user@c.us'],
  );
});

test('search matches name or id, case-insensitively, and an absent name never throws', () => {
  const all = [chat('628111@c.us', 'Alice'), chat('628222@c.us'), chat('628333@c.us', 'Bob')];

  assert.deepEqual(
    filterChats(all, 'ALI').map(c => c.id),
    ['628111@c.us'],
  );
  assert.deepEqual(
    filterChats(all, '628222').map(c => c.id),
    ['628222@c.us'],
  );
  assert.deepEqual(
    filterChats(all, 'zzz').map(c => c.id),
    [],
  );
});

test('channels match on their own name and id', () => {
  const channels = [
    { id: '111@newsletter', name: 'LeadWeave News' },
    { id: '222@newsletter', name: 'Other' },
  ];

  assert.deepEqual(
    filterChannels(channels, 'leadweave').map(c => c.id),
    ['111@newsletter'],
  );
  assert.deepEqual(
    filterChannels(channels, '222').map(c => c.id),
    ['222@newsletter'],
  );
});

const item = (contactId: string, timestamp: string, name?: string) => ({
  contact: { id: contactId, name },
  timestamp,
});

test('statuses collapse to one row per contact, newest contact first', () => {
  // Store order is newest-first overall.
  const statuses = [
    item('b', '2026-08-01T03:00:00Z', 'Bob'),
    item('a', '2026-08-01T02:00:00Z', 'Alice'),
    item('a', '2026-08-01T01:00:00Z', 'Alice'),
  ];

  const groups = groupStatusesByContact(statuses, '');

  assert.deepEqual(
    groups.map(g => g.contact.id),
    ['b', 'a'],
    'group order is newest-contact-first',
  );
  assert.equal(groups[1].items.length, 2, 'one row per contact, items kept together');
  assert.equal(groups[1].latest, '2026-08-01T02:00:00Z', 'latest is the newest timestamp in the group');
});

test("a group's items run oldest-first, opposite to the group ordering", () => {
  // The viewer opens at the newest and reads like a story: newest at the bottom, where the scroll
  // lands. The store hands them over newest-first, so the group must flip them.
  const groups = groupStatusesByContact(
    [item('a', '2026-08-01T03:00:00Z'), item('a', '2026-08-01T02:00:00Z'), item('a', '2026-08-01T01:00:00Z')],
    '',
  );

  assert.deepEqual(
    groups[0].items.map(i => i.timestamp),
    ['2026-08-01T01:00:00Z', '2026-08-01T02:00:00Z', '2026-08-01T03:00:00Z'],
  );
});

test('status search matches name, pushName or id', () => {
  const statuses = [
    { contact: { id: '628111@c.us', name: 'Alice', pushName: 'Ali' }, timestamp: '2026-08-01T01:00:00Z' },
    { contact: { id: '628222@c.us', name: undefined, pushName: 'Bobby' }, timestamp: '2026-08-01T02:00:00Z' },
  ];

  assert.deepEqual(
    groupStatusesByContact(statuses, 'alice').map(g => g.contact.id),
    ['628111@c.us'],
  );
  assert.deepEqual(
    groupStatusesByContact(statuses, 'bobby').map(g => g.contact.id),
    ['628222@c.us'],
  );
  assert.deepEqual(
    groupStatusesByContact(statuses, '628111').map(g => g.contact.id),
    ['628111@c.us'],
  );
});

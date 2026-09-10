/**
 * Unit tests for scripts/create-shortcut.js (node:test — no jest, no deps).
 * Run: `npm run test:scripts`.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getDesktopDir,
  generateDesktopContent,
  generateUrlContent,
  createDesktopShortcut,
} = require('./create-shortcut.js');

test('getDesktopDir: returns Windows Desktop path on win32', () => {
  const env = { USERPROFILE: 'C:\\Users\\TestUser' };
  const desktop = getDesktopDir(env, 'win32');
  assert.equal(desktop, 'C:\\Users\\TestUser\\Desktop');
});

test('getDesktopDir: respects XDG_DESKTOP_DIR on linux', () => {
  const env = { XDG_DESKTOP_DIR: '/custom/desktop/path' };
  const desktop = getDesktopDir(env, 'linux');
  assert.equal(desktop, '/custom/desktop/path');
});

test('getDesktopDir: falls back to HOME/Desktop on linux', () => {
  const env = { HOME: '/home/testuser' };
  const desktop = getDesktopDir(env, 'linux');
  assert.equal(desktop, '/home/testuser/Desktop');
});

test('generateDesktopContent: creates valid Linux .desktop entry content', () => {
  const content = generateDesktopContent('http://localhost:2785');
  assert.match(content, /^\[Desktop Entry\]/m);
  assert.match(content, /Exec=xdg-open http:\/\/localhost:2785/);
  assert.match(content, /Name=LeadWeave API Gateway/);
  assert.match(content, /Type=Application/);
});

test('generateUrlContent: creates valid Windows .url Internet Shortcut content', () => {
  const content = generateUrlContent('http://localhost:2785');
  assert.match(content, /^\[InternetShortcut\]/m);
  assert.match(content, /URL=http:\/\/localhost:2785/);
});

test('createDesktopShortcut: creates Linux .desktop file with executable permissions', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shortcut-test-'));
  const desktopDir = path.join(tmpDir, 'Desktop');

  try {
    let gioCalled = false;
    const fakeExecSync = (cmd) => {
      if (cmd.includes('gio trust')) {
        gioCalled = true;
      }
    };

    const shortcutPath = createDesktopShortcut('http://localhost:2785', {
      platform: 'linux',
      desktopDir,
      execSync: fakeExecSync,
    });

    assert.equal(shortcutPath, path.join(desktopDir, 'LeadWeave.desktop'));
    assert.equal(fs.existsSync(shortcutPath), true);

    const fileContent = fs.readFileSync(shortcutPath, 'utf8');
    assert.match(fileContent, /Exec=xdg-open http:\/\/localhost:2785/);

    const stat = fs.statSync(shortcutPath);
    // Mode should include executable bits on Unix
    if (process.platform !== 'win32') {
      assert.equal((stat.mode & 0o111) > 0, true);
    }
    assert.equal(gioCalled, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('createDesktopShortcut: creates Windows .url file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shortcut-test-win-'));
  const desktopDir = path.join(tmpDir, 'Desktop');

  try {
    const shortcutPath = createDesktopShortcut('http://localhost:2785', {
      platform: 'win32',
      desktopDir,
    });

    const expectedPath = path.join(desktopDir, 'LeadWeave.url');
    assert.equal(shortcutPath, expectedPath);
    assert.equal(fs.existsSync(shortcutPath), true);

    const fileContent = fs.readFileSync(shortcutPath, 'utf8');
    assert.match(fileContent, /\[InternetShortcut\]/);
    assert.match(fileContent, /URL=http:\/\/localhost:2785/);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('createDesktopShortcut: universally sanitizes backslashes in desktopDir across all platforms', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shortcut-test-slash-'));
  const desktopDir = path.join(tmpDir, 'Desktop');
  // Simulate a path passed with Windows backslashes
  const windowsStyleDesktopDir = desktopDir.replace(/\//g, '\\');

  try {
    const shortcutPath = createDesktopShortcut('http://localhost:2785', {
      platform: 'win32',
      desktopDir: windowsStyleDesktopDir,
    });

    assert.equal(fs.existsSync(shortcutPath), true);
    assert.equal(shortcutPath.includes('\\'), false);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

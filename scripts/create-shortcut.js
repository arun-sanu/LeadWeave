/**
 * Helper to automatically create a Desktop launcher icon on Windows & Linux
 * that opens the LeadWeave Web Dashboard (http://localhost:2785) in the default browser.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getDesktopDir(env = process.env, platform = process.platform) {
  if (platform === 'win32') {
    return path.win32.join(env.USERPROFILE || 'C:\\Users\\Default', 'Desktop');
  }
  if (env.XDG_DESKTOP_DIR) {
    return env.XDG_DESKTOP_DIR;
  }
  const home = env.HOME || '/root';
  return path.posix.join(home, 'Desktop');
}

function generateDesktopContent(url = 'http://localhost:2785') {
  return [
    '[Desktop Entry]',
    'Version=1.0',
    'Type=Application',
    'Name=LeadWeave API Gateway',
    'Comment=Launch LeadWeave Web Dashboard in Browser',
    `Exec=xdg-open ${url}`,
    'Icon=web-browser',
    'Terminal=false',
    'Categories=Network;WebBrowser;',
    '',
  ].join('\n');
}

function generateUrlContent(url = 'http://localhost:2785') {
  return [
    '[InternetShortcut]',
    `URL=${url}`,
    'IconIndex=0',
    '',
  ].join('\r\n');
}

function createDesktopShortcut(url, options = {}) {
  const env = options.env || process.env;
  const platform = options.platform || process.platform;
  const targetUrl = url || env.APP_URL || env.DASHBOARD_URL || 'http://localhost:2785';
  let desktopDir = options.desktopDir || getDesktopDir(env, platform);

  // Universally normalize all backslashes to forward slashes.
  // Node.js fs module natively supports forward slashes on Windows, macOS, and Linux.
  if (typeof desktopDir === 'string') {
    desktopDir = desktopDir.replace(/\\/g, '/');
  }

  if (!fs.existsSync(desktopDir)) {
    try {
      fs.mkdirSync(desktopDir, { recursive: true });
    } catch (err) {
      console.warn(`create-shortcut: Could not create desktop folder at ${desktopDir}: ${err.message}`);
      return null;
    }
  }

  if (platform === 'win32') {
    const shortcutPath = path.posix.join(desktopDir, 'LeadWeave.url');
    const content = generateUrlContent(targetUrl);
    fs.writeFileSync(shortcutPath, content, 'utf8');
    console.log(`🖥️ Created Windows Desktop shortcut: ${shortcutPath} -> ${targetUrl}`);
    return shortcutPath;
  } else {
    // Linux and Unix default
    const shortcutPath = path.posix.join(desktopDir, 'LeadWeave.desktop');
    const content = generateDesktopContent(targetUrl);
    fs.writeFileSync(shortcutPath, content, 'utf8');
    try {
      fs.chmodSync(shortcutPath, 0o755);
    } catch (err) {
      // Ignore permission errors if in constrained container
    }
    try {
      if (options.execSync || execSync) {
        (options.execSync || execSync)(`gio trust "${shortcutPath}" 2>/dev/null || true`, { stdio: 'ignore' });
      }
    } catch (err) {
      // gio trust is optional
    }
    console.log(`🖥️ Created Linux Desktop shortcut: ${shortcutPath} -> ${targetUrl}`);
    return shortcutPath;
  }
}

if (require.main === module) {
  const customUrl = process.argv[2] || process.env.APP_URL || process.env.DASHBOARD_URL;
  createDesktopShortcut(customUrl);
}

module.exports = {
  getDesktopDir,
  generateDesktopContent,
  generateUrlContent,
  createDesktopShortcut,
};

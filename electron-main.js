const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');

let mainWindow = null;
let tray = null;
let backendProcess = null;
const BACKEND_PORT = process.env.PORT || 3000;

function startBackend() {
  // Start the NestJS backend as a separate Node process
  const backendPath = path.join(__dirname, 'dist', 'main.js');
  console.log(`Starting backend from: ${backendPath}`);
  
  backendProcess = fork(backendPath, [], {
    env: {
      ...process.env,
      PORT: BACKEND_PORT,
      NODE_ENV: app.isPackaged ? 'production' : 'development'
    },
    stdio: 'pipe'
  });

  backendProcess.stdout.on('data', (data) => console.log(`[Backend] ${data}`));
  backendProcess.stderr.on('data', (data) => console.error(`[Backend] ${data}`));
}

function waitForBackend(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - start > timeout) {
        clearInterval(interval);
        reject(new Error('Backend failed to start within timeout'));
      }
      
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve();
        }
      }).on('error', () => {
        // Ignored, retry
      });
    }, 1000);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Wait until ready to show
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    // Use a placeholder icon if one doesn't exist
    icon: path.join(__dirname, 'data', 'icon.png')
  });

  // Handle closing vs hiding
  mainWindow.on('close', (event) => {
    if (!app.isQuiting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });

  try {
    if (!app.isPackaged) {
      // In dev mode, wait for Vite dev server (assuming it's on 5173)
      await mainWindow.loadURL('http://localhost:5173');
    } else {
      // In production, wait for backend then serve static files or redirect to backend static hosting
      // Note: NestJS is already serving the dashboard statically in this project
      console.log(`Waiting for backend at http://localhost:${BACKEND_PORT}/api...`);
      await waitForBackend(`http://localhost:${BACKEND_PORT}/api`);
      await mainWindow.loadURL(`http://localhost:${BACKEND_PORT}`);
    }
  } catch (error) {
    console.error('Failed to load UI:', error);
  }

  mainWindow.show();
}

function createTray() {
  // Use a placeholder icon, in a real app create data/icon.png
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip('LeadWeave');
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Quit LeadWeave', click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
});

// Keep app running in background on macOS/Windows
app.on('window-all-closed', () => {
  // Do nothing, handled by tray
});

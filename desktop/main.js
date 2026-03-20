// StepScribe Desktop — Electron Main Process
// Native app: Express server runs in-process. No Docker dependency.

const { app, BrowserWindow, shell, Menu, Tray, nativeImage, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

/* ── Paths ── */
const IS_DEV = !app.isPackaged;
const USER_DATA = app.getPath("userData");
const DATA_DIR = path.join(USER_DATA, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const EXPORT_DIR = path.join(DATA_DIR, "exports");

function getFrontendDir() {
  if (IS_DEV) {
    // In dev, use the built static export from frontend/out
    const localOut = path.resolve(__dirname, "..", "frontend", "out");
    if (fs.existsSync(localOut)) return localOut;
    return null;
  }
  return path.join(process.resourcesPath, "frontend-dist");
}

/* ── Server ── */
const PORT = 19847; // High port unlikely to conflict
const APP_URL = `http://localhost:${PORT}`;
let server = null;

let mainWindow = null;
let splashWindow = null;
let tray = null;
let isQuitting = false;

function isServiceReady(url, timeoutMs = 30000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const poll = () => {
      const req = http.get(url, (res) => resolve(res.statusCode < 500));
      req.on("error", () => {
        if (Date.now() > deadline) resolve(false);
        else setTimeout(poll, 500);
      });
      req.setTimeout(2000, () => {
        req.destroy();
        if (Date.now() > deadline) resolve(false);
        else setTimeout(poll, 500);
      });
    };
    poll();
  });
}

async function startServer() {
  updateSplash("Initializing database...");

  // Ensure data directories exist before anything tries to use them
  for (const d of [DATA_DIR, UPLOAD_DIR, EXPORT_DIR]) {
    fs.mkdirSync(d, { recursive: true });
  }

  // Initialize database
  const database = require("./server/db");
  database.init(DATA_DIR);

  // Load saved AI settings from database
  const aiModule = require("./server/ai");
  try {
    const config = database.db().prepare("SELECT * FROM app_config WHERE id = 'default'").get();
    if (config) {
      const fields = [
        "ai_provider", "openai_api_key", "openai_model",
        "anthropic_api_key", "anthropic_model",
        "grok_api_key", "grok_model", "grok_base_url",
        "ollama_base_url", "ollama_model",
        "custom_ai_base_url", "custom_ai_api_key", "custom_ai_model",
      ];
      const saved = {};
      for (const f of fields) { if (config[f]) saved[f] = config[f]; }
      if (Object.keys(saved).length) aiModule.updateSettings(saved);
      console.log("[StepScribe] AI config loaded — provider:", aiModule.getSettings().ai_provider, "model:", aiModule.getSettings().ollama_model, "url:", aiModule.getSettings().ollama_base_url);
      // Validate Ollama model exists if using Ollama
      if (aiModule.getSettings().ai_provider === "ollama") {
        try {
          const ollamaUrl = aiModule.getSettings().ollama_base_url || "http://localhost:11434";
          const resp = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
          const data = await resp.json();
          const installed = (data.models || []).map(m => m.name);
          const currentModel = aiModule.getSettings().ollama_model || "";
          const match = installed.find(m =>
            m.toLowerCase().replace(/:latest$/, "") === currentModel.toLowerCase().replace(/:latest$/, "")
          );
          if (!match && installed.length > 0) {
            const chatModel = installed.find(m => !m.includes("embed") && !m.includes("nomic")) || installed[0];
            console.log(`[StepScribe] Ollama model "${currentModel}" not found. Auto-switching to "${chatModel}". Available: ${installed.join(", ")}`);
            aiModule.updateSettings({ ollama_model: chatModel });
            database.db().prepare("UPDATE app_config SET ollama_model = ? WHERE id = 'default'").run(chatModel);
          } else if (match && match !== currentModel) {
            // Fix casing: use the exact name Ollama reports
            aiModule.updateSettings({ ollama_model: match });
            database.db().prepare("UPDATE app_config SET ollama_model = ? WHERE id = 'default'").run(match);
            console.log(`[StepScribe] Fixed Ollama model name casing: "${currentModel}" → "${match}"`);
          }
        } catch (e) {
          console.log("[StepScribe] Could not validate Ollama model (Ollama may not be running):", e.message);
        }
      }
    }
  } catch { /* first run, no config yet */ }

  updateSplash("Starting server...");

  const { createApp } = require("./server/index");
  const expressApp = createApp({
    dataDir: DATA_DIR,
    uploadDir: UPLOAD_DIR,
    exportDir: EXPORT_DIR,
    frontendDir: getFrontendDir(),
  });

  return new Promise((resolve, reject) => {
    server = expressApp.listen(PORT, "127.0.0.1", () => {
      console.log(`StepScribe server running on ${APP_URL}`);
      resolve(true);
    });
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is in use, trying to connect to existing instance...`);
        resolve(true); // Maybe another instance is already running
      } else {
        reject(err);
      }
    });
  });
}

function stopServer() {
  if (server) {
    server.close();
    server = null;
  }
}

/* ── Windows ── */

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420, height: 320, frame: false, resizable: false, center: true,
    alwaysOnTop: true, skipTaskbar: true, backgroundColor: "#1a1a2e",
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
}

function updateSplash(msg) {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.executeJavaScript(`document.getElementById('status').textContent = ${JSON.stringify(msg)};`).catch(() => {});
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 900, minWidth: 800, minHeight: 600,
    title: "StepScribe", backgroundColor: "#1a1a2e",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, "preload.js") },
    show: false,
  });

  mainWindow.loadURL(APP_URL);
  mainWindow.once("ready-to-show", () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    mainWindow.show(); mainWindow.focus();
  });
  mainWindow.on("close", (e) => {
    if (!isQuitting && process.platform === "darwin") { e.preventDefault(); mainWindow.hide(); }
  });
  mainWindow.on("closed", () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  const template = [
    ...(process.platform === "darwin" ? [{
      label: app.name, submenu: [
        { role: "about" }, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" },
        { type: "separator" }, { role: "quit" },
      ],
    }] : []),
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "close" }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  const iconName = process.platform === "darwin" ? "tray-icon.png" : "icon.png";
  const iconPath = path.join(__dirname, "assets", iconName);
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (process.platform === "darwin") icon = icon.resize({ width: 18, height: 18 });
  } catch { return; }
  if (icon.isEmpty()) return;

  tray = new Tray(icon);
  tray.setToolTip("StepScribe");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open StepScribe", click: () => mainWindow && mainWindow.show() },
    { type: "separator" },
    { label: "Quit", click: () => { isQuitting = true; app.quit(); } },
  ]));
  tray.on("click", () => { if (mainWindow) mainWindow.isVisible() ? mainWindow.focus() : mainWindow.show(); });
}

/* ── IPC: Open external URL in system browser ── */
ipcMain.handle("open-external", async (event, url) => {
  if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
    await shell.openExternal(url);
  }
});

/* ── IPC: PDF export via Electron's printToPDF ── */
ipcMain.handle("print-to-pdf", async (event, html) => {
  const win = new BrowserWindow({ show: false, width: 800, height: 1100, webPreferences: { nodeIntegration: false } });
  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdfBuffer = await win.webContents.printToPDF({
    printBackground: true, marginsType: 0,
    pageSize: "Letter",
  });
  win.close();
  const outPath = path.join(EXPORT_DIR, `stepscribe-journal-${Date.now()}.pdf`);
  fs.writeFileSync(outPath, pdfBuffer);
  return outPath;
});

/* ── App Lifecycle ── */

app.setName("StepScribe");

app.on("ready", async () => {
  createSplashWindow();
  try {
    await startServer();
    updateSplash("Waiting for server...");
    const ready = await isServiceReady(`${APP_URL}/health`, 15000);
    if (!ready) {
      updateSplash("Server did not respond, retrying...");
      await new Promise(r => setTimeout(r, 2000));
    }
    createMainWindow();
    createTray();
  } catch (err) {
    console.error("Failed to start:", err);
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
    const { dialog } = require("electron");
    await dialog.showMessageBox({ type: "error", title: "Startup Error", message: "Failed to start StepScribe.", detail: err.message });
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  stopServer();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => {
  if (mainWindow) mainWindow.show();
  else if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
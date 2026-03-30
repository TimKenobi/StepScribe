// Preload script — safely expose limited APIs to the renderer
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("stepscribe", {
  platform: process.platform,
  isDesktop: true,
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  printToPDF: (html) => ipcRenderer.invoke("print-to-pdf", html),
});

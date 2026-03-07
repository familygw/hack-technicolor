import { BrowserWindow, app, nativeTheme } from "electron";
import path from "path";
import { initWatchdog } from "./api/handlers";
import "./api/handlers";
import { configureMenu } from "./electron-menu";
import { ProxyEvents } from "./model";
import { createTray } from "./tray";

const darkBackgroundColor: string = "#282c344d";
const lightBackgroundColor: string = "#ffffff4d";

const isMacOS: boolean = (process.platform === "darwin");
let isQuitting = false;

app.on("before-quit", () => { isQuitting = true; });

const createWindow: () => BrowserWindow = (): BrowserWindow => {
  app.commandLine.appendSwitch("enable-transparent-visuals");
  const win = new BrowserWindow({
    width: 1250,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      devTools: !app.isPackaged,
      webSecurity: true,
      nodeIntegration: false,
      contextIsolation: true
    },
    show: false,
    frame: false,
    hasShadow: true,
    transparent: false,
    titleBarStyle: "hiddenInset",
    fullscreenable: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? darkBackgroundColor : lightBackgroundColor
  });

  !!isMacOS && win.setVibrancy("fullscreen-ui");
  !isMacOS && win.setBackgroundMaterial("acrylic");

  if (app.isPackaged)
    win.loadFile(path.join(__dirname, "./browser/index.html"));
  else {
    win.loadURL("http://localhost:4200");
    win.webContents.openDevTools();
  }

  return win;
};

configureMenu();

app.on("window-all-closed", () => {
  !isMacOS && app.quit();
});

app.whenReady().then(() => {
  const win = createWindow();
  const watchdog = initWatchdog(win);
  createTray(
    win,
    () => watchdog.toggle(),
    () => watchdog.forceCheck()
  );

  win.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  if (isMacOS) {
    app.on("activate", () => {
      win.show();
    });
  }

  win.webContents.on("dom-ready", () => {
    win.webContents.send(ProxyEvents.THEME_UPDATED, nativeTheme.shouldUseDarkColors);
  });

  win.once("ready-to-show", () => win.show());

  nativeTheme.on("updated", () => {
    const backgroundColor = nativeTheme.shouldUseDarkColors
      ? darkBackgroundColor
      : lightBackgroundColor;

    win.setBackgroundColor(backgroundColor);
    win.webContents.send(ProxyEvents.THEME_UPDATED, nativeTheme.shouldUseDarkColors);
  });
});

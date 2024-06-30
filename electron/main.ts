import { BrowserWindow, app, nativeTheme } from "electron";
import path from "path";
import "./api/handlers";
import { ProxyEvents } from "./model";

const darkBackgroundColor: string = "#282c344d";
const lightBackgroundColor: string = "#ffffff4d";

const isMacOS: boolean = (process.platform === "darwin");

const createWindow: () => BrowserWindow = (): BrowserWindow => {
  app.commandLine.appendSwitch("enable-transparent-visuals");
  const win = new BrowserWindow({
    width: 1250,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      devTools: !app.isPackaged,
      webSecurity: false,
      nodeIntegration: true,
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
    win.loadFile(path.join(__dirname, "../index.html"));
  else {
    win.loadURL("http://localhost:4200");
    win.webContents.openDevTools();
  }

  return win;
};

app.on("window-all-closed", () => {
  !isMacOS && app.quit();
});

app.whenReady().then(() => {
  const win = createWindow();

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

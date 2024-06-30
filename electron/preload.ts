import { contextBridge, ipcRenderer } from "electron";
import { ProxyEvents } from "./model";
import { Observable, from } from "rxjs";

contextBridge.exposeInMainWorld("thack", {
  doLogin: (modemIp: string, username: string, password: string): Promise<any> => ipcRenderer.invoke(ProxyEvents.DO_LOGIN, modemIp, username, password),
  toggleWifi: (wifiId: number, wifiName: string, enable: boolean): Promise<any> => ipcRenderer.invoke(ProxyEvents.DO_TOGGLE_WIFI, wifiId, wifiName, enable),
  doLoadWifis: (): Promise<any> => ipcRenderer.invoke(ProxyEvents.DO_LOAD_WIFIS),
  loadUserInfo: (): Promise<string> => ipcRenderer.invoke(ProxyEvents.LOAD_USER_INFO)
});

ipcRenderer.on("ping", (event, message) => {
});

// attends to the "theme:updated" event from the main process (webContents.send)
ipcRenderer.on(ProxyEvents.THEME_UPDATED, (event: Electron.IpcRendererEvent, darkMode: boolean) => {
  document.body.setAttribute("theme", darkMode ? "dark" : "light");
});

ipcRenderer.on(ProxyEvents.DO_HACK_LOGS, (event: Electron.IpcRendererEvent, message: string) => {
  const logs = document.getElementById("logs") as HTMLTextAreaElement;
  !logs.value && (logs.value = "");
  logs.value += message;
  logs.scrollTop = logs.scrollHeight
});
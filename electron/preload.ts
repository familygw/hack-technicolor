import { contextBridge, ipcRenderer } from "electron";

const ProxyEvents = {
  THEME_UPDATED: "theme:updated",
  DO_LOGIN: "api:login",
  DO_LOGOUT: "api:logout",
  DO_LOAD_WIFIS: "api:do-load-wifis",
  DO_TOGGLE_WIFI: "api:do-toggle-wifi",
  DO_DISABLE_ALL_WIFI: "api:do-disable-all-wifi",
  DO_HACK_LOGS: "api:do-hack:logs",
  LOAD_USER_INFO: "api:load-user-info"
} as const;

contextBridge.exposeInMainWorld("thack", {
  doLogin: (modemIp: string, username: string, password: string): Promise<any> => ipcRenderer.invoke(ProxyEvents.DO_LOGIN, modemIp, username, password),
  doLogout: (): Promise<boolean> => ipcRenderer.invoke(ProxyEvents.DO_LOGOUT),
  toggleWifi: (wifiId: number, wifiName: string, enable: boolean): Promise<any> => ipcRenderer.invoke(ProxyEvents.DO_TOGGLE_WIFI, wifiId, wifiName, enable),
  disableAllWifi: (): Promise<any> => ipcRenderer.invoke(ProxyEvents.DO_DISABLE_ALL_WIFI),
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
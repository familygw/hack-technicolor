import { app, BrowserWindow, Menu, nativeImage, Tray } from "electron";

export type TrayStatus = "disconnected" | "ok" | "alert";

const colorMap: Record<TrayStatus, string> = {
  disconnected: "#6c757d",
  ok: "#198754",
  alert: "#dc3545"
};

let tray: Tray | null = null;
let pauseMenuItem: Electron.MenuItem | null = null;

const createTrayIcon = (color: string): Electron.NativeImage => {
  const svg = `<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="7" fill="${color}"/></svg>`;
  return nativeImage.createFromBuffer(Buffer.from(svg));
};

export const createTray = (win: BrowserWindow, onWatchdogToggle?: () => void, onWatchdogForceCheck?: () => void): Tray => {
  tray = new Tray(createTrayIcon(colorMap.disconnected));

  let isPaused = false;

  const buildContextMenu = (): Menu => {
    return Menu.buildFromTemplate([
      {
        label: "Abrir ventana",
        click: () => {
          win.show();
          win.focus();
        }
      },
      { type: "separator" },
      {
        label: isPaused ? "Reanudar watchdog" : "Pausar watchdog",
        click: (menuItem) => {
          isPaused = !isPaused;
          onWatchdogToggle?.();
          menuItem.label = isPaused ? "Reanudar watchdog" : "Pausar watchdog";
          tray?.setContextMenu(buildContextMenu());
        }
      },
      {
        label: "Forzar check",
        click: () => {
          onWatchdogForceCheck?.();
        }
      },
      { type: "separator" },
      {
        label: "Salir",
        click: () => {
          app.quit();
        }
      }
    ]);
  };

  tray.setContextMenu(buildContextMenu());
  tray.setToolTip("TechnicolorHack");

  tray.on("click", () => {
    win.show();
    win.focus();
  });

  return tray;
};

export const updateTrayStatus = (status: TrayStatus): void => {
  if (!tray) return;

  const tooltips: Record<TrayStatus, string> = {
    disconnected: "TechnicolorHack - Desconectado",
    ok: "TechnicolorHack - OK",
    alert: "TechnicolorHack - Alerta"
  };

  tray.setImage(createTrayIcon(colorMap[status]));
  tray.setToolTip(tooltips[status]);
};

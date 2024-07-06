import { Menu } from "electron";

export const configureMenu = (): void => {
  const menu = Menu.buildFromTemplate(
    [
      { role: "appMenu" },
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" }
        ]
      },
      { role: "windowMenu" },
      {
        role: "help",
        submenu: [
          {
            label: "Contact Support",
            click: async () => {
              const { shell } = require("electron")
              await shell.openExternal("https://www.google.com/")
            }
          }
        ]
      }
    ]);
  Menu.setApplicationMenu(menu);
}
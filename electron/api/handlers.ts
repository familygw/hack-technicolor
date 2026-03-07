import { BrowserWindow, ipcMain } from "electron";
import { catchError, firstValueFrom, map, of, switchMap, tap } from "rxjs";
import { DoLoginResponse, ProxyEvents } from "../model";
import { Watchdog } from "../watchdog";
import { Request } from "./request";
import { doPbkdf2NotCoded } from "./utils/crypto-utils";
import { saveCredentials, loadCredentials, clearCredentials } from "../credentials";

const network = require("network");

let _req: Request | undefined;
let _cookies: string = "";
let _xCsrfToken: string = "";
let _watchdog: Watchdog | undefined;

export function initWatchdog(win: BrowserWindow): Watchdog {
  _watchdog = new Watchdog(
    win,
    () => _req,
    () => ({ cookies: _cookies, xCsrfToken: _xCsrfToken })
  );

  ipcMain.on(ProxyEvents.WATCHDOG_TOGGLE, () => _watchdog?.toggle());
  ipcMain.on(ProxyEvents.WATCHDOG_FORCE_CHECK, () => _watchdog?.forceCheck());

  return _watchdog;
}

const _getReq = (modemIp?: string): Request => {
  if (!!modemIp) {
    _req = new Request(modemIp);
    return _req;
  }

  if (!_req) throw new Error("Modem IP is required");

  return _req;
}

ipcMain.handle(ProxyEvents.DO_LOGIN, (event: Electron.IpcMainInvokeEvent, modemIp: string, username: string, password: string): Promise<DoLoginResponse> => {
  const _req = _getReq(modemIp);

  return firstValueFrom(
    _req.doSaltLogin(username)
      .pipe(
        tap((res) => (_cookies = res.cookies)),
        switchMap((res) => {
          const hashed1 = doPbkdf2NotCoded(password, res.salt);
          const hashedPassword = doPbkdf2NotCoded(hashed1, res.saltwebui);

          return _req.doLogin(username, hashedPassword, res.cookies)
            .pipe(
              switchMap((loginResponse) => {
                _cookies = loginResponse.cookies;
                _xCsrfToken = loginResponse.xCsrfToken;

                if (!!_cookies && !!_xCsrfToken) {
                  _watchdog?.start();
                }

                return of(!!_cookies && !!_xCsrfToken);
              })
            );
        }),
        switchMap((result) => {
          return _req.getWifis({ cookies: _cookies, xCsrfToken: _xCsrfToken }, Array.from({ length: 51 }, (_, i) => i))
            .pipe(
              map((res) => ({ result, wifis: res.wifis})),
              catchError((err) => of({ result: false, wifis: [], errorMessage: err.message }))
            );
        }),
        catchError((err) => of({ result: false, wifis: [], errorMessage: err.message }))
      )
  );
});

ipcMain.handle(ProxyEvents.DO_LOGOUT, async (): Promise<boolean> => {
  if (_req && _cookies && _xCsrfToken) {
    try {
      await firstValueFrom(_req.doLogout({ cookies: _cookies, xCsrfToken: _xCsrfToken }));
    } catch {}
  }
  _watchdog?.stop();
  _cookies = "";
  _xCsrfToken = "";
  _req = undefined;
  return true;
});

ipcMain.handle(ProxyEvents.DO_TOGGLE_WIFI, (event: Electron.IpcMainInvokeEvent, wifiId: number, wifiName: string, enable: boolean): Promise<any> => {
  const _req = _getReq();

  return firstValueFrom(_req.toggleWifiSettings({ cookies: _cookies, xCsrfToken: _xCsrfToken }, wifiId, wifiName, enable)
    .pipe(
      switchMap(() => _req.getWifis({ cookies: _cookies, xCsrfToken: _xCsrfToken }, Array.from({ length: 51 }, (_, i) => i))),
      map((res) => ({ result: true, wifis: res.wifis })),
      catchError((err) => of({ result: false, wifis: [], errorMessage: err.message }))
    )
  );
});

ipcMain.handle(ProxyEvents.DO_DISABLE_ALL_WIFI, (event: Electron.IpcMainInvokeEvent): Promise<DoLoginResponse> => {
  const _req = _getReq();

  return firstValueFrom(_req.disableAllDetectedWifis({ cookies: _cookies, xCsrfToken: _xCsrfToken })
    .pipe(
      switchMap(() => _req.getWifis({ cookies: _cookies, xCsrfToken: _xCsrfToken }, Array.from({ length: 51 }, (_, i) => i))),
      map((res) => ({ result: true, wifis: res.wifis })),
      catchError((err) => of({ result: false, wifis: [], errorMessage: err.message }))
    )
  );
});

ipcMain.handle(ProxyEvents.DO_LOAD_WIFIS, (event: Electron.IpcMainInvokeEvent): Promise<DoLoginResponse> => {
  const _req = _getReq();

  return firstValueFrom(_req.getWifis({ cookies: _cookies, xCsrfToken: _xCsrfToken }, Array.from({ length: 51 }, (_, i) => i))
    .pipe(
      map((res) => ({ result: true, wifis: res.wifis })),
      catchError((err) => of({ result: false, wifis: [], errorMessage: err.message }))
    )
  );
});

ipcMain.handle(ProxyEvents.LOAD_USER_INFO, (event: Electron.IpcMainInvokeEvent): Promise<string> => {
  const defaultIp: string = "192.168.0.1";

  return new Promise((resolve, reject) => {
    network.get_gateway_ip((err: any, ip: string) => {
      if (!!err) {
        console.error("Error loading user info", err);
        resolve(defaultIp);
        return;
      }

      resolve(ip || defaultIp);
    });
  });
});

ipcMain.handle(ProxyEvents.SAVE_CREDENTIALS, (_, modemIp: string, username: string, password: string) => {
  saveCredentials({ modemIp, username, password });
  return true;
});

ipcMain.handle(ProxyEvents.LOAD_CREDENTIALS, () => loadCredentials());

ipcMain.handle(ProxyEvents.CLEAR_CREDENTIALS, () => {
  clearCredentials();
  return true;
});

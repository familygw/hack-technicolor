import { ipcMain } from "electron";
import { catchError, firstValueFrom, map, of, switchMap, tap } from "rxjs";
import { DoLoginResponse, ProxyEvents } from "../model";
import { Request } from "./request";
import { doPbkdf2NotCoded } from "./utils/crypto-utils";

const network = require("network");

let _req: Request;
let _cookies: string;
let _xCsrfToken: string;

const _getReq = (modemIp?: string): Request => {
  if (!_req && !modemIp) throw new Error("Modem IP is required");
  !_req && (_req = new Request(modemIp));
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

ipcMain.handle(ProxyEvents.DO_TOGGLE_WIFI, (event: Electron.IpcMainInvokeEvent, wifiId: number, wifiName: string, enable: boolean): Promise<any> => {
  const _req = _getReq();

  return firstValueFrom(_req.toggleWifiSettings({ cookies: _cookies, xCsrfToken: _xCsrfToken }, wifiId, wifiName, enable)
    .pipe(
      switchMap(() => _req.getWifis({ cookies: _cookies, xCsrfToken: _xCsrfToken }, Array.from({ length: 51 }, (_, i) => i))),
      map((res) => ({ result: true, wifis: res.wifis }))
    )
  );
});

ipcMain.handle(ProxyEvents.DO_LOAD_WIFIS, (event: Electron.IpcMainInvokeEvent): Promise<DoLoginResponse> => {
  const _req = _getReq();

  return firstValueFrom(_req.getWifis({ cookies: _cookies, xCsrfToken: _xCsrfToken }, Array.from({ length: 51 }, (_, i) => i))
    .pipe(
      map((res) => ({ result: true, wifis: res.wifis }))
    )
  );
});

ipcMain.handle(ProxyEvents.LOAD_USER_INFO, (event: Electron.IpcMainInvokeEvent): Promise<string> => {
  const defaultIp: string = "127.0.0.1";

  return new Promise((resolve, reject) => {
    network.get_gateway_ip((err: any, ip: string) => {
      if (!!err) {
        console.error("Error loading user info", err);
        resolve(defaultIp);
        return;
      }

      resolve(ip);
    });
  });
});

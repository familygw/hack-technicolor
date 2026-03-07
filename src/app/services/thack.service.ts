import { Injectable } from "@angular/core";
import { Observable, first, from, map } from "rxjs";
import { DoLoginResponse } from "../../../electron/model";

type THack = {
  doLogin: (modemIp: string, username: string, password: string) => Promise<any>;
  doLogout: () => Promise<boolean>;
  toggleWifi: (wifiId: number, wifiName: string, enable: boolean) => Promise<any>;
  disableAllWifi: () => Promise<any>;
  doLoadWifis: () => Promise<any>;
  loadUserInfo: () => Promise<string>;
  saveCredentials: (modemIp: string, username: string, password: string) => Promise<boolean>;
  loadCredentials: () => Promise<{ modemIp: string; username: string; password: string } | null>;
  clearCredentials: () => Promise<boolean>;
  loadSystemInfo: () => Promise<any>;
  loadDevices: () => Promise<any>;
  onWatchdogStatus: (callback: (data: any) => void) => void;
};

@Injectable({ providedIn: "root" })
export class THackService {
  private get _thack(): THack { return (window as any).thack ?? {} };

  private _mapWifiDataMap(res: DoLoginResponse): DoLoginResponse {
    console.trace(">>>", res);
    if (!res.result) return res;

    let wifiDataInfo = Object.keys(res.wifis).map((wifiId) => ({
      wifiId: parseInt(wifiId),
      data: (res.wifis as any)[wifiId].data
    }));

    wifiDataInfo = wifiDataInfo.filter((wifi) => !!wifi.data);
    wifiDataInfo.forEach((wifi) => {
      wifi.data.ACLEnable = (wifi.data.ACLEnable === "true");
      wifi.data.SSIDEnable = (wifi.data.SSIDEnable === "true");
      wifi.data.WPSEnable = (wifi.data.WPSEnable === "true");
      wifi.data.RadioEnable = (wifi.data.RadioEnable === "true");
    });

    wifiDataInfo.sort((a, b) => {
      if (a.data.SSIDEnable && !b.data.SSIDEnable) {
        return -1;
      } else if (!a.data.SSIDEnable && b.data.SSIDEnable) {
        return 1;
      } else {
        return a.data.SSID.localeCompare(b.data.SSID);
      }
    });

    return { result: res.result, wifis: wifiDataInfo };
  }

  loadUserInfo(): Observable<string> {
    return from(this._thack.loadUserInfo()).pipe(first());
  };

  doLogin(modemIp: string, username: string, password: string): Observable<DoLoginResponse> {
    return from(this._thack.doLogin(modemIp, username, password))
      .pipe(map(this._mapWifiDataMap));
  }

  doLogout(): Observable<boolean> {
    return from(this._thack.doLogout())
      .pipe(first());
  }

  toggleWifi(wifiId: number, wifiName: string, enable: boolean): Observable<DoLoginResponse> {
    return from(this._thack.toggleWifi(wifiId, wifiName, enable))
      .pipe(map(this._mapWifiDataMap));
  }

  disableAllWifi(): Observable<DoLoginResponse> {
    return from(this._thack.disableAllWifi())
      .pipe(map(this._mapWifiDataMap));
  }

  doLoadWifis(): Observable<any> {
    return from(this._thack.doLoadWifis())
      .pipe(map(this._mapWifiDataMap));
  }

  saveCredentials(modemIp: string, username: string, password: string): Observable<boolean> {
    return from(this._thack.saveCredentials(modemIp, username, password));
  }

  loadCredentials(): Observable<any> {
    return from(this._thack.loadCredentials());
  }

  clearCredentials(): Observable<boolean> {
    return from(this._thack.clearCredentials());
  }

  loadSystemInfo(): Observable<any> {
    return from(this._thack.loadSystemInfo()).pipe(first());
  }

  loadDevices(): Observable<any> {
    return from(this._thack.loadDevices()).pipe(first());
  }

  onWatchdogStatus(callback: (data: any) => void): void {
    this._thack.onWatchdogStatus(callback);
  }
}
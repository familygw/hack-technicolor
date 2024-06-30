import { Injectable } from "@angular/core";
import { Observable, OperatorFunction, first, from, map } from "rxjs";
import { WiFiInformation } from "../models/thack.model";

type THack = {
  doLogin: (modemIp: string, username: string, password: string) => Promise<any>;
  toggleWifi: (wifiId: number, wifiName: string, enable: boolean) => Promise<any>;
  doLoadWifis: () => Promise<any>;
  loadUserInfo: () => Promise<string>;
};

export type DoLoginResponse = { result: boolean, wifis: WiFiInformation[] };

@Injectable({ providedIn: "root" })
export class THackService {
  private get _thack(): THack { return (window as any).thack ?? {} };

  private _mapWifiDataMap(res: DoLoginResponse): DoLoginResponse {
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
      wifi.data.ModeEnabled = (wifi.data.ModeEnabled === "true");
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

  toggleWifi(wifiId: number, wifiName: string, enable: boolean): Observable<DoLoginResponse> {
    return from(this._thack.toggleWifi(wifiId, wifiName, enable))
      .pipe(map((res) => {
        console.log("Toggled wifi >>>>>>>", res);
        return this._mapWifiDataMap(res);
      }));
  }

  doLoadWifis(): Observable<any> {
    return from(this._thack.doLoadWifis())
      .pipe(map(this._mapWifiDataMap));
  }
}
import axios, { AxiosRequestConfig } from "axios";
import FormData from "form-data";
import { replace } from "lodash";
import { Observable, Subject, Subscription, from, map, of, switchMap, tap } from "rxjs";
import { doPbkdf2NotCoded } from "./utils/crypto-utils";
import { defaultHeaders, httpsAgent } from "./utils/http-utils";

export type SaltLoginType = { salt: string, saltwebui: string, cookies: string }

export type LoginResponseType = { xCsrfToken: string, cookies: string }

export class Request {
  private readonly _getWifiParts: string = "ACLEnable,FilterAsBlackList,ACLTbl,BSSID,SSIDEnable,SSIDAdvertisementEnabled,OperatingStandards,SSID,ModeEnabled,EncryptionMethod,KeyPassphrase,WEPKey64b1,WEPKey128b1,RadioEnable,RadiusServerIPAddr,RadiusServerPort,RadiusReAuthInterval,RadiusServerIPAddrSec,RadiusServerPortSec,WPSEnable,ModesSupported,TransmitPower";

  private _loginSubscription?: Subscription;

  private _xCsrfToken?: string;
  private _cookies?: string;
  private _host: string;

  get headers(): LoginResponseType {
    return { xCsrfToken: this._xCsrfToken!, cookies: this._cookies! };
  }

  constructor(host?: string) {
    this._host = host ?? "192.168.0.1";
    axios.defaults.baseURL = `https://${this._host}`;
  }

  private _generateRandomPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&*+,-./:=?@^_~';
    const passwordLength = Math.floor(Math.random() * (32 - 16 + 1)) + 16; // random length between 16 and 32
    let randomPassword = "";

    for (let i = 0; i < passwordLength; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      randomPassword += chars[randomIndex];
    }

    return randomPassword;
  }

  private _parseCookies(cookies: string[]): string[] {
    return cookies
      .flatMap(c => c.split(";"))
      .map(c => c.trim())
      .filter(c => c.startsWith("auth=") || c.startsWith("PHPSESSID="));
  }

  getWifis(headers: LoginResponseType, ids: number[] = [0, 1, 2, 9]): Observable<any> {
    const reqOptions: AxiosRequestConfig<any> = {
      headers: {
        ...defaultHeaders(headers.xCsrfToken, this._host),
        "Cookie": headers.cookies
      },
      ...httpsAgent
    };

    // this call is required in order to the API recognize my credentials
    return from(axios
      .get("/api/v1/session/menu", reqOptions))
      .pipe(
        switchMap(() => from(axios.get(`/api/v1/wifi/${ids}/${this._getWifiParts}`, reqOptions))),
        map(response => ({ result: true, wifis: response.data }))
      );
  }

  toggleWifiSettings(headers: LoginResponseType, wifiId: number, wifiName: string, enable: boolean): Observable<any> {
    if (!wifiId) throw new Error("WiFi ID is required");

    const formdata = new FormData();
    ["SSIDEnable", "RadioEnable", "SSIDAdvertisementEnabled"].forEach(key => formdata.append(`${wifiId}[${key}]`, enable ? "true" : "false"));

    if (!enable) {
      formdata.append(`${wifiId}[SSID]`, `${wifiName} - DISABLED`);
      formdata.append(`${wifiId}[TransmitPower]`, "25");
      formdata.append(`${wifiId}[KeyPassphrase]`, this._generateRandomPassword());
      formdata.append(`${wifiId}[ModeEnabled]`, "WPA2-Personal");
      formdata.append(`${wifiId}[EncryptionMethod]`, "AES");
    } else
      formdata.append(`${wifiId}[SSID]`, wifiName.replace(/ - DISABLED/g, ""));

    formdata.append(`${wifiId}[WPSEnable]`, "false");

    const reqOptions: AxiosRequestConfig<any> = {
      headers: {
        ...formdata.getHeaders(),
        ...defaultHeaders(headers.xCsrfToken, this._host),
        "Cookie": headers.cookies
      },
      ...httpsAgent
    };

    console.log("Form Data:", formdata);

    return from(axios
      .post<any>(`/api/v1/wifi/${wifiId}`, formdata, reqOptions))
      .pipe(
        tap((response) => {
          Object.keys(response.data)
            .forEach(wifiId => {
              const wasOk = response.data[wifiId].error;
              console.log(`Update for WiFi [${wifiId}] was [${response.data[wifiId].error}]: ${response.data[wifiId].message} ${!(wasOk === "ok") ? ` || ${JSON.stringify(response.data[wifiId].data)}` : ""}`)
            });
        }),
        map(response => response.data)
      );
  }

  async turnOn24WiFi(headers: LoginResponseType): Promise<void> {
    const formdata = new FormData();

    formdata.append("SSIDEnable", "true");
    formdata.append("RadioEnable", "true");

    const response = await axios.post<any>(`/api/v1/wifi/1,WifiEnable`, formdata, {
      headers: {
        ...formdata.getHeaders(),
        ...defaultHeaders(headers.xCsrfToken, this._host),
        "Cookie": headers.cookies
      },
      ...httpsAgent
    });

    Object.keys(response.data)
      .filter((wifiId) => !isNaN(parseInt(wifiId)))
      .forEach(wifiId => {
        const wasOk = response.data[wifiId].error;
        console.log(`Update for WiFi [${wifiId}] was [${response.data[wifiId].error}]: ${response.data[wifiId].message} ${!(wasOk === "ok") ? ` || ${JSON.stringify(response.data[wifiId].data)}` : ""}`)
      });
  }

  updateWifiSettings(headers: LoginResponseType, wifis: any[], rename: boolean, restore: boolean): Observable<void> {
    if (!wifis || !wifis.length) of(undefined);

    const formdata = new FormData();

    wifis.forEach((wifi) =>
      // iterate keys to set default values
      Object.keys(wifi.data).forEach(key => {
        let value = wifi.data[key];

        switch (key) {
          case "SSID":
            if (!!rename && !value.toLowerCase().includes("disabled"))
              value = `${value} - DISABLED`;

            if (!!restore && value.toLowerCase().includes("disabled"))
              value = replace(value, " - DISABLED", "");
            break;
          case "WPSEnable":
          case "SSIDEnable":
          case "RadioEnable":
          case "SSIDAdvertisementEnabled":
            value = "false";
            break;
          case "TransmitPower":
            value = "25";
            break;
          case "KeyPassphrase":
            value = this._generateRandomPassword();
            break;
          case "ModeEnabled":
            value = "WPA2-Personal";
            break;
          case "EncryptionMethod":
            value = "AES";
            break;
        }

        formdata.append((wifis.length === 1) ? key : `${wifi.wifiId}[${key}]`, value);
      })
    );

    formdata.append("WifiEnable", "false");
    formdata.append("Wifi5Enable", "false");

    return from(axios.post<any>(`/api/v1/wifi/${wifis.map(w => w.wifiId)},WifiEnable,Wifi5Enable`, formdata, {
      headers: {
        ...formdata.getHeaders(),
        ...defaultHeaders(headers.xCsrfToken, this._host),
        "Cookie": headers.cookies
      },
      ...httpsAgent
    })).pipe(
      tap((response) => {
        Object.keys(response.data)
          .filter((wifiId) => !isNaN(parseInt(wifiId)))
          .forEach(wifiId => {
            const wasOk = response.data[wifiId].error;
            console.log(`Update for WiFi [${wifiId}] was [${response.data[wifiId].error}]: ${response.data[wifiId].message} ${!(wasOk === "ok") ? ` || ${JSON.stringify(response.data[wifiId].data)}` : ""}`)
          });
      }),
      map(() => undefined)
    );
  }

  async applyACL(headers: LoginResponseType, wifis: any[]): Promise<void> {
    if (!wifis || !wifis.length) return;


    wifis.forEach(async (wifi) => {
      const formdata = new FormData();

      formdata.append("ACLEnable", "true");
      formdata.append("FilterAsBlackList", "false");
      formdata.append("ACLTbl[0][__id]", "0");

      const response = await axios.post(`/api/v1/wifi/${wifi.wifiId}`, formdata, {
        headers: {
          ...formdata.getHeaders(),
          ...defaultHeaders(headers.xCsrfToken, this._host),
          "Cookie": headers.cookies
        },
        ...httpsAgent
      });

      Object.keys(response.data).forEach(wifiId =>
        console.log(`ACL Settings for WiFi [${wifiId}] was [${response.data[wifiId].error}]: ${response.data[wifiId].message}`)
      );
    });
  }

  async getSystem(headers: LoginResponseType): Promise<any> {
    // this call is required in order to the API recognize my credentials
    const response = await axios.get("/api/v1/session/log", {
      headers: {
        ...defaultHeaders(headers.xCsrfToken, this._host),
        "Cookie": headers.cookies
      },
      ...httpsAgent
    });

    console.log("SYSTEM:", response.data);
    return response.data;
  }

  doSaltLogin(username: string): Observable<SaltLoginType> {
    let formdata = new FormData();
    formdata.append("username", username);
    formdata.append("password", "seeksalthash");

    return from(axios.post("/api/v1/session/login",
      formdata, {
      headers: {
        ...formdata.getHeaders(),
        ...defaultHeaders("", this._host)
      },
      ...httpsAgent
    }))
      .pipe(
        map((response) => {
          const { salt, saltwebui } = response.data;
          const cookieArray = this._parseCookies(response.headers["set-cookie"] ?? []);
          const cookies = cookieArray.join("; ").concat(";");

          return { salt, saltwebui, cookies };
        })
      );
  }

  doLogin(username: string, hashedPassword: string, cookies: string): Observable<LoginResponseType> {
    let formdata = new FormData();
    formdata.append("username", username);
    formdata.append("password", hashedPassword);

    const req = from(axios.post("/api/v1/session/login",
      formdata,
      {
        headers: {
          ...formdata.getHeaders(),
          ...defaultHeaders("", this._host),
          "Cookie": cookies
        },
        ...httpsAgent
      }))
      .pipe(
        switchMap((response) => {
          if (response.data.error === "ok") {

            const cookies = this._parseCookies(response.headers["set-cookie"] ?? []);
            const xCsrfToken = cookies.find(cookie => cookie.includes("auth"))!.split("=")[1];

            const cookiesStr = cookies.join("; ").concat(";");

            return from(axios.get("/", {
              headers: {
                ...defaultHeaders(xCsrfToken, this._host),
                "Cookie": cookiesStr
              },
              ...httpsAgent
            }))
              .pipe(
                map(() => ({ xCsrfToken, cookies: cookiesStr }))
              );
          }
          throw new Error("Login failed");
        })
      );

    return req;
  }

  performLogin(username: string, password: string): Observable<string> {
    const subject = new Subject<string>();

    !!this._loginSubscription && this._loginSubscription.unsubscribe();
    subject.next("Performing login...");
    this._loginSubscription = this.doSaltLogin(username)
      .pipe(
        switchMap((saltLogin: SaltLoginType) => {
          const { salt, saltwebui, cookies } = saltLogin;

          subject.next(`Cookies            : ${cookies}\n`);

          const hashed1 = doPbkdf2NotCoded(password, salt);
          subject.next(`Encrypted Password : ${hashed1}\n`);

          const hashedPassword = doPbkdf2NotCoded(hashed1, saltwebui);
          subject.next(`Hashed Password    : ${hashedPassword}\n`);

          return this.doLogin(username, hashedPassword, cookies)
        })
      )
      .subscribe((r: LoginResponseType) => {
        if (!r) {
          subject.next("Login failed");
          return;
        }

        const { xCsrfToken, cookies } = r;
        subject.next(`X-CSRF-TOKEN       : ${xCsrfToken}\n`);
        subject.next(`Cookies            : ${cookies}\n`);
        this._xCsrfToken = xCsrfToken;
        this._cookies = cookies;

        subject.next("\n");
        subject.complete();
      });

    return subject;
  }
}
import axios from "axios";
import FormData from "form-data";
import { defaultHeaders, httpsAgent } from "./utils/http-utils";

export type SaltLoginType = { salt: string, saltwebui: string, cookies: string }

export type LoginResponseType = { xCsrfToken: string, cookies: string }

export default class Request {
  private readonly _getWifiParts: string = "SSIDEnable,SSIDAdvertisementEnabled,OperatingStandards,SSID,ModeEnabled,EncryptionMethod,KeyPassphrase,WEPKey64b1,WEPKey128b1,RadioEnable,RadiusServerIPAddr,RadiusServerPort,RadiusReAuthInterval,RadiusServerIPAddrSec,RadiusServerPortSec,WPSEnable,ModesSupported,bs_enable";

  constructor(host: string) {
    axios.defaults.baseURL = `https://${host}`;
  }

  private _parseCookies(cookies: string[]): string[] {
    return cookies
      .flatMap(c => c.split(";"))
      .map(c => c.trim())
      .filter(c => c.startsWith("auth=") || c.startsWith("PHPSESSID="));
  }

  async doSaltLogin(username: string): Promise<SaltLoginType> {
    let formdata = new FormData();
    formdata.append("username", username);
    formdata.append("password", "seeksalthash");

    const response = await axios.post("/api/v1/session/login", formdata, {
      headers: {
        ...formdata.getHeaders(),
        ...defaultHeaders()
      },
      ...httpsAgent
    });

    const { salt, saltwebui } = response.data;
    const cookieArray = this._parseCookies(response.headers["set-cookie"] ?? []);
    const cookies = cookieArray.join("; ").concat(";");

    console.log("SALT LOGIN DATA:", response.data);
    return { salt, saltwebui, cookies };
  }

  async doLogin(username: string, password: string, cookies: string): Promise<LoginResponseType | void> {
    let formdata = new FormData();
    formdata.append("username", username);
    formdata.append("password", password);

    const response = await axios.post("/api/v1/session/login", formdata, {
      headers: {
        ...formdata.getHeaders(),
        ...defaultHeaders(),
        "Cookie": cookies
      },
      ...httpsAgent
    });

    if (response.data.error === "ok") {
      const cookies = this._parseCookies(response.headers["set-cookie"] ?? []);
      const xCsrfToken = cookies.find(cookie => cookie.includes("auth"))!.split("=")[1];

      const cookiesStr = cookies.join("; ").concat(";");

      await axios.get("/", {
        headers: {
          ...defaultHeaders(xCsrfToken),
          "Cookie": cookiesStr
        },
        ...httpsAgent
      });

      return { xCsrfToken, cookies: cookiesStr };
    }

    return void 0;
  }

  async getWifis(headers: LoginResponseType, ids: number[] = [0, 1, 2, 9]): Promise<any> {
    // necesito hacer esta llamada al menú, de otra forma la API no reconoce mis credenciales
    const menu = await axios.get("/api/v1/session/menu", {
      headers: {
        ...defaultHeaders(headers.xCsrfToken),
        "Cookie": headers.cookies
      },
      ...httpsAgent
    });

    const response = await axios.get(`/api/v1/wifi/${ids}/${this._getWifiParts}`, {
      headers: {
        ...defaultHeaders(headers.xCsrfToken),
        "Cookie": headers.cookies
      },
      ...httpsAgent
    });
    return response.data;
  }

  async disableWifi(headers: LoginResponseType, wifis: any[]): Promise<void> {
    wifis.forEach(async (wifi) => {
      const formdata = new FormData();
      formdata.append("SSID", `${wifi.data?.SSID} - DISABLED`);
      formdata.append("SSIDEnable", "false");

      const response = await axios.post(`/api/v1/wifi/${wifi.wifiId}`, formdata, {
        headers: {
          ...formdata.getHeaders(),
          ...defaultHeaders(headers.xCsrfToken),
          "Cookie": headers.cookies
        },
        ...httpsAgent
      });

      console.log("DISABLE WIFI RESPONSE:", response.data);
    });
  }

  async getSystem(headers: LoginResponseType): Promise<any> {
    // necesito hacer esta llamada al menú, de otra forma la API no reconoce mis credenciales
    const response = await axios.get("/api/v1/session/log", {
      headers: {
        ...defaultHeaders(headers.xCsrfToken),
        "Cookie": headers.cookies
      },
      ...httpsAgent
    });

    console.log("SYSTEM:", response.data);
    return response.data;
  }
}
import { BrowserWindow, Notification } from "electron";
import { firstValueFrom } from "rxjs";
import { Request } from "./api/request";
import { LoginResponseType } from "./api/request";
import { updateTrayStatus } from "./tray";
import { ProxyEvents } from "./model";

export class Watchdog {
  private _interval: ReturnType<typeof setInterval> | null = null;
  private _paused: boolean = false;
  private _pollMs: number;

  constructor(
    private _win: BrowserWindow,
    private _getReq: () => Request | undefined,
    private _getHeaders: () => LoginResponseType,
    pollMinutes: number = 5
  ) {
    this._pollMs = pollMinutes * 60 * 1000;
  }

  start(): void {
    this.stop();
    this._interval = setInterval(() => this._check(), this._pollMs);
    this._sendStatus();
  }

  stop(): void {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._paused = false;
    this._sendStatus();
  }

  toggle(): void {
    this._paused = !this._paused;
    this._sendStatus();
  }

  get isRunning(): boolean {
    return !!this._interval && !this._paused;
  }

  async forceCheck(): Promise<void> {
    await this._check();
  }

  private async _check(): Promise<void> {
    if (this._paused) return;
    const req = this._getReq();
    if (!req) {
      updateTrayStatus("disconnected");
      return;
    }

    try {
      const headers = this._getHeaders();
      const ids = Array.from({ length: 51 }, (_, i) => i);
      const res = await firstValueFrom(req.getWifis(headers, ids));

      const activeWifis = Object.keys(res.wifis)
        .filter((id) => {
          const data = res.wifis[id]?.data;
          return data && (data.SSIDEnable === "true" || data.RadioEnable === "true");
        });

      if (activeWifis.length > 0) {
        updateTrayStatus("alert");
        await firstValueFrom(req.disableAllDetectedWifis(headers, ids));
        updateTrayStatus("ok");

        new Notification({
          title: "TechnicolorHack",
          body: `Se desactivaron ${activeWifis.length} red(es) WiFi reactivadas por el ISP.`
        }).show();

        this._win.webContents.send(ProxyEvents.WATCHDOG_STATUS, { acted: true, count: activeWifis.length });
      } else {
        updateTrayStatus("ok");
        this._win.webContents.send(ProxyEvents.WATCHDOG_STATUS, { acted: false });
      }
    } catch (err) {
      updateTrayStatus("disconnected");
    }
  }

  private _sendStatus(): void {
    this._win.webContents.send(ProxyEvents.WATCHDOG_STATUS, {
      running: !!this._interval,
      paused: this._paused
    });
  }
}

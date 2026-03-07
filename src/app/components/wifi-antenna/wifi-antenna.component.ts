import { Component, EventEmitter, Input, Output } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from "@angular/material/button";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { WiFiStatusComponent } from "../wifi-status/wifi-status.component";

import { WiFiInformation } from "../../../../electron/model";
import { ToggleWiFiEvent } from "../../models/thack.model";

@Component({
  selector: "wifi-antenna",
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    WiFiStatusComponent
],
  templateUrl: "./wifi-antenna.component.html",
  styleUrls: ["./wifi-antenna.component.scss"]
})
export class WifiAntennaComponent {
  @Input() wifiInfo: WiFiInformation;
  @Input() toggling: boolean = false;
  @Output() toggleWifi: EventEmitter<ToggleWiFiEvent> = new EventEmitter<ToggleWiFiEvent>();

  get isLikelyPersonalFlow(): boolean {
    const ssid = (this.wifiInfo?.data?.SSID ?? "").toLowerCase();
    return ssid.includes("personal") || ssid.includes("flow") || ssid.includes("zona wifi");
  }

  get band(): string {
    const standards = (this.wifiInfo?.data?.OperatingStandards ?? "").toLowerCase();
    if (standards.includes("ac") || standards.includes("ax") || standards.includes("a,") || standards.includes("a-"))
      return "5 GHz";
    if (standards.includes("b") || standards.includes("g") || standards.includes("n"))
      return "2.4 GHz";
    return "?";
  }

  get is5GHz(): boolean {
    return this.band === "5 GHz";
  }

  get encryptionDisplay(): string {
    const mode = this.wifiInfo?.data?.ModeEnabled || "";
    const method = this.wifiInfo?.data?.EncryptionMethod || "";
    if (!mode) return "-";
    return `${mode} / ${method}`;
  }

  get transmitPowerDisplay(): string {
    return `${this.wifiInfo?.data?.TransmitPower ?? "-"}%`;
  }

  get aclStatus(): string {
    if (!this.wifiInfo?.data?.ACLEnable) return "Off";
    return this.wifiInfo.data.FilterAsBlackList === "true" ? "Blacklist" : "Whitelist";
  }
}

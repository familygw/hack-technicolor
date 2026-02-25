import { Component, EventEmitter, Input, Output } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { MatButtonModule } from "@angular/material/button";
import { WiFiStatusComponent } from "../wifi-status/wifi-status.component";

import { WiFiInformation } from "../../../../electron/model";
import { ToggleWiFiEvent } from "../../models/thack.model";

@Component({
  selector: "wifi-antenna",
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    WiFiStatusComponent
],
  templateUrl: "./wifi-antenna.component.html",
  styleUrls: ["./wifi-antenna.component.scss"]
})
export class WifiAntennaComponent {
  @Input() wifiInfo: WiFiInformation;
  @Output() toggleWifi: EventEmitter<ToggleWiFiEvent> = new EventEmitter<ToggleWiFiEvent>();

  get isLikelyPersonalFlow(): boolean {
    const ssid = (this.wifiInfo?.data?.SSID ?? "").toLowerCase();
    return ssid.includes("personal") || ssid.includes("flow") || ssid.includes("zona wifi");
  }
}

import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { MatCardModule } from "@angular/material/card";
import { WiFiStatusComponent } from "../wifi-status/wifi-status.component";
import { NgIf } from "@angular/common";
import { WiFiInformation } from "../../../../electron/model";
import { ToggleWiFiEvent } from "../../models/thack.model";

@Component({
  selector: "wifi-antenna",
  standalone: true,
  imports: [
    NgIf,
    MatCardModule,
    WiFiStatusComponent
  ],
  templateUrl: "./wifi-antenna.component.html",
  styleUrls: ["./wifi-antenna.component.scss"]
})
export class WifiAntennaComponent {
  @Input() wifiInfo: WiFiInformation;
  @Output() toggleWifi: EventEmitter<ToggleWiFiEvent> = new EventEmitter<ToggleWiFiEvent>();
}

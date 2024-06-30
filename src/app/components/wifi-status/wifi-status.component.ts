import { NgClass, NgIf } from "@angular/common";
import { Component, Input } from "@angular/core";

@Component({
  selector: "wifi-status",
  standalone: true,
  imports: [NgIf, NgClass],
  templateUrl: "./wifi-status.component.html",
  styleUrl: "./wifi-status.component.scss"
})
export class WiFiStatusComponent {
  @Input() enabled: boolean = false;
}

import { NgClass, NgIf } from "@angular/common";
import { Component, Input } from "@angular/core";

@Component({
  selector: "connection-status",
  standalone: true,
  imports: [NgIf, NgClass],
  templateUrl: "./connection-status.component.html",
  styleUrl: "./connection-status.component.scss"
})
export class ConnectionStatusComponent {
  @Input() connected: boolean = false;
  @Input() connecting: boolean = false;
}

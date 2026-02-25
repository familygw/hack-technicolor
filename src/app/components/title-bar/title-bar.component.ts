import { Component, Input } from "@angular/core";

@Component({
  selector: "title-bar",
  standalone: true,
  imports: [],
  template: "<div class='title'>{{this.title}}</div><div class='subtitle'>WiFi Control Console</div>",
  styleUrl: "./title-bar.component.scss"
})
export class TitleBarComponent {
  @Input() title: string;
}

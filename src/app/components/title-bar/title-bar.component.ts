import { Component, Input } from "@angular/core";

@Component({
  selector: "title-bar",
  standalone: true,
  imports: [],
  template: "{{this.title}}",
  styleUrl: "./title-bar.component.scss"
})
export class TitleBarComponent {
  @Input() title: string;
}

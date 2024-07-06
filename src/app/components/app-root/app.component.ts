import { NgFor, NgIf } from "@angular/common";
import { AfterViewInit, Component } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { RouterOutlet } from "@angular/router";
import { Subscription, first, switchMap } from "rxjs";
import { DoLoginResponse, WiFiInformation } from "../../../../electron/model";
import { THackService } from "../../services/thack.service";
import { startWithTap } from "../../utils/rxjs.utils";
import { ConnectionStatusComponent } from "../connection-status/connection-status.component";
import { TitleBarComponent } from "../title-bar/title-bar.component";
import { WiFiStatusComponent } from "../wifi-status/wifi-status.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    NgIf,
    NgFor,
    RouterOutlet,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatSnackBarModule,
    TitleBarComponent,
    MatFormFieldModule,
    ReactiveFormsModule,
    WiFiStatusComponent,
    ConnectionStatusComponent
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss"
})
export class AppComponent implements AfterViewInit {
  private _loginSubs: Subscription;

  connected: boolean;
  connecting: boolean;
  wifiList: WiFiInformation[] = [];

  formGroup: FormGroup = new FormGroup({
    modemIp: new FormControl("", Validators.required),
    username: new FormControl("", Validators.required),
    password: new FormControl("", Validators.required)
  });

  constructor(
    private snackBar: MatSnackBar,
    private thackService: THackService
  ) { }

  ngAfterViewInit(): void {
    this.thackService.loadUserInfo()
      .subscribe((ip: string) => this.formGroup.get("modemIp")?.setValue(ip));
  }

  doLogin(): void {
    this.connecting = true;

    !!this._loginSubs && this._loginSubs.unsubscribe();
    this._loginSubs = this.thackService
      .doLogin(
        this.formGroup.get("modemIp")?.value,
        this.formGroup.get("username")?.value,
        this.formGroup.get("password")?.value
      )
      .pipe(
        startWithTap(() => (this.wifiList = []))
      )
      .subscribe((response: DoLoginResponse) => {
        if (!response.result) {
          this.snackBar.open(`Login failed. ${response.errorMessage}`, "Close", { duration: 3000, panelClass: ["error-snackbar"] });
          this.connecting = false;
          return;
        }
        this.connected = !!response.result;
        this.connecting = false;

        this.wifiList = response.wifis;
      });
  }

  toggleWifi(wifiId: number, wifiName: string, enable: boolean): void {
    this.thackService.toggleWifi(wifiId, wifiName, enable)
      .pipe(
        first(),
        switchMap(() => this.thackService.doLoadWifis())
      )
      .subscribe((res) => (this.wifiList = res.wifis));
  }
}

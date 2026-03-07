
import { AfterViewInit, Component } from "@angular/core";
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MatDividerModule } from "@angular/material/divider";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";
import { Subscription, first, switchMap } from "rxjs";
import { DoLoginResponse, WiFiInformation } from "../../../../electron/model";
import { ToggleWiFiEvent } from "../../models/thack.model";
import { THackService } from "../../services/thack.service";
import { startWithTap } from "../../utils/rxjs.utils";
import { ConnectionStatusComponent } from "../connection-status/connection-status.component";
import { TitleBarComponent } from "../title-bar/title-bar.component";
import { WifiAntennaComponent } from "../wifi-antenna/wifi-antenna.component";

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    MatCardModule,
    MatInputModule,
    MatDividerModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatCheckboxModule,
    TitleBarComponent,
    MatFormFieldModule,
    FormsModule,
    ReactiveFormsModule,
    WifiAntennaComponent,
    ConnectionStatusComponent
],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.scss"
})
export class AppComponent implements AfterViewInit {
  private _loginSubs: Subscription;

  connected: boolean;
  connecting: boolean;
  refreshing: boolean;
  disablingAll: boolean;
  wifiList: WiFiInformation[] = [];
  rememberCredentials: boolean = false;
  systemInfo: any = null;
  loadingSystemInfo: boolean = false;

  formGroup: FormGroup = new FormGroup({
    modemIp: new FormControl("", Validators.required),
    username: new FormControl("custadmin", Validators.required),
    password: new FormControl("", Validators.required)
  });

  constructor(
    private snackBar: MatSnackBar,
    private thackService: THackService
  ) { }

  ngAfterViewInit(): void {
    this.thackService.loadUserInfo()
      .pipe(first())
      .subscribe({
        next: (ip: string) => this.formGroup.get("modemIp")?.setValue(ip || "192.168.0.1"),
        error: () => this.formGroup.get("modemIp")?.setValue("192.168.0.1")
      });

    this.thackService.loadCredentials()
      .pipe(first())
      .subscribe({
        next: (creds) => {
          if (creds) {
            this.formGroup.patchValue({
              modemIp: creds.modemIp,
              username: creds.username,
              password: creds.password
            });
            this.rememberCredentials = true;
          }
        },
        error: () => {}
      });
  }

  get enabledCount(): number {
    return this.wifiList.filter((wifi) => !!wifi.data.SSIDEnable).length;
  }

  get disabledCount(): number {
    return this.wifiList.filter((wifi) => !wifi.data.SSIDEnable).length;
  }

  get personalFlowCount(): number {
    return this.wifiList.filter((wifi) => this._isPersonalWifi(wifi)).length;
  }

  private _isPersonalWifi(wifi: WiFiInformation): boolean {
    const ssid = (wifi.data.SSID ?? "").toLowerCase();
    return ssid.includes("personal") || ssid.includes("flow") || ssid.includes("zona wifi");
  }

  private _setAuthFieldsDisabled(disabled: boolean): void {
    const usernameControl = this.formGroup.get("username");
    const passwordControl = this.formGroup.get("password");

    if (disabled) {
      usernameControl?.disable({ emitEvent: false });
      passwordControl?.disable({ emitEvent: false });
      return;
    }

    usernameControl?.enable({ emitEvent: false });
    passwordControl?.enable({ emitEvent: false });
  }

  private _resetUiSession(): void {
    const modemIp = this.formGroup.get("modemIp")?.value || "192.168.0.1";

    this._loginSubs?.unsubscribe();
    this.connected = false;
    this.connecting = false;
    this.refreshing = false;
    this.disablingAll = false;
    this.wifiList = [];

    this.systemInfo = null;

    this._setAuthFieldsDisabled(false);
    this.formGroup.reset({
      modemIp,
      username: "custadmin",
      password: ""
    });
  }

  doLogin(): void {
    if (!this.formGroup.valid || this.connected || this.connecting) return;

    this.connecting = true;
    const loginPassword = this.formGroup.get("password")?.value;

    !!this._loginSubs && this._loginSubs.unsubscribe();
    this._loginSubs = this.thackService
      .doLogin(
        this.formGroup.get("modemIp")?.value,
        this.formGroup.get("username")?.value,
        loginPassword
      )
      .pipe(
        startWithTap(() => (this.wifiList = []))
      )
      .subscribe((response: DoLoginResponse) => {
        if (!response.result) {
          this.snackBar.open(`Login failed. ${response.errorMessage}`, "Close", { duration: 3000, panelClass: ["error-snackbar"] });
          this.connecting = false;
          this._setAuthFieldsDisabled(false);
          return;
        }
        this.connected = !!response.result;
        this.connecting = false;
        this._setAuthFieldsDisabled(true);

        this.wifiList = response.wifis;

        if (this.rememberCredentials) {
          this.thackService.saveCredentials(
            this.formGroup.get("modemIp")?.value,
            this.formGroup.get("username")?.value,
            loginPassword
          ).pipe(first()).subscribe();
        }

        // Load system info
        this.loadingSystemInfo = true;
        this.thackService.loadSystemInfo()
          .pipe(first())
          .subscribe({
            next: (info) => { this.systemInfo = info; this.loadingSystemInfo = false; },
            error: () => { this.loadingSystemInfo = false; }
          });
      });
  }

  onSubmit(): void {
    this.doLogin();
  }

  logout(): void {
    if (this.connecting) return;

    this.thackService.doLogout().subscribe({
      next: () => this._resetUiSession(),
      error: () => {
        this._resetUiSession();
        this.snackBar.open("Sesión cerrada localmente.", "Cerrar", { duration: 2500 });
      }
    });
  }

  refreshWifis(): void {
    if (!this.connected || this.refreshing) return;

    this.refreshing = true;
    this.thackService.doLoadWifis()
      .pipe(first())
      .subscribe((response: DoLoginResponse) => {
        this.refreshing = false;
        if (!response.result) {
          this.snackBar.open(`No se pudo refrescar redes. ${response.errorMessage ?? ""}`, "Cerrar", { duration: 3000, panelClass: ["error-snackbar"] });
          return;
        }

        this.wifiList = response.wifis;
      });
  }

  disableAllWifi(): void {
    if (!this.connected || this.disablingAll) return;

    this.disablingAll = true;
    this.thackService.disableAllWifi()
      .pipe(first())
      .subscribe((response: DoLoginResponse) => {
        this.disablingAll = false;

        if (!response.result) {
          this.snackBar.open(`No se pudo deshabilitar todas las redes. ${response.errorMessage ?? ""}`, "Cerrar", { duration: 3500, panelClass: ["error-snackbar"] });
          return;
        }

        this.wifiList = response.wifis;
        this.snackBar.open("Todas las redes detectadas fueron deshabilitadas.", "Cerrar", { duration: 2800 });
      });
  }

  formatUptime(seconds: string | number): string {
    const s = typeof seconds === "string" ? parseInt(seconds, 10) : seconds;
    if (isNaN(s)) return "-";
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  toggleWifi(event: ToggleWiFiEvent): void {
    if (!this.connected) return;

    this.thackService.toggleWifi(event.wifiInfo.wifiId, event.wifiInfo.data.SSID, event.action)
      .pipe(
        first(),
        switchMap(() => this.thackService.doLoadWifis())
      )
      .subscribe((response: DoLoginResponse) => {
        if (!response.result) {
          this.snackBar.open(`No se pudo actualizar la red. ${response.errorMessage ?? ""}`, "Cerrar", { duration: 3000, panelClass: ["error-snackbar"] });
          return;
        }

        this.wifiList = response.wifis;
      });
  }
}

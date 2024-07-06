import { WiFiInformation } from "../../../electron/model"

export type ToggleWiFiEvent = {
  wifiInfo: WiFiInformation,
  action: boolean
}
export interface WiFi {
  error: string
  message: string
  data: WiFiData
}

export interface WiFiInformation {
  wifiId: number,
  data: WiFiData
}

export interface WiFiData {
  ACLEnable: boolean
  FilterAsBlackList: string
  BSSID: string
  SSIDEnable: boolean
  SSID: string
  SSIDAdvertisementEnabled: string
  OperatingStandards: string
  RadioEnable: boolean
  TransmitPower: string
  ModeEnabled: boolean
  EncryptionMethod: string
  KeyPassphrase: string
  RadiusServerIPAddr: string
  RadiusServerPort: string
  RadiusReAuthInterval: string
  RadiusServerIPAddrSec: string
  RadiusServerPortSec: string
  ModesSupported: string
  WEPKey64b1: string
  WEPKey128b1: string
  WPSEnable: boolean
  ACLTbl: any[]
}

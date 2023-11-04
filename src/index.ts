import { isNaN, pick } from "lodash";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import Request from "./request";
import { doPbkdf2NotCoded } from "./utils/crypto-utils";

const main = async () => {
  // voy a identificar dos argumentos, --user y --password
  // luego voy a grabar los valores en variables para usarlas luego
  const argv = await yargs(hideBin(process.argv))
    .option("host", {
      alias: "H",
      type: "string",
      requiresArg: true,
      demandOption: true,
      description: "Host (IP) del modem. Por ejemplo: 192.168.0.1."
    })
    .option("user", {
      alias: "u",
      type: "string",
      description: "Nombre de usuario."
    })
    .option("pass", {
      alias: "p",
      type: "string",
      description: "Contraseña."
    })
    .option("force", {
      alias: "f",
      type: "boolean",
      description: "Fuerza actualizar la configuración solo de los que tienen la palabra 'Personal'."
    })
    .option("force-all", {
      alias: "F",
      type: "boolean",
      description: "Fuerza actualizar la configuración de todos los wifis."
    })
    .option("rename", {
      alias: "r",
      type: "boolean",
      conflicts: "restore",
      description: "Renombra los SSID agregandole '- DISABLED'."
    })
    .option("restore", {
      alias: "R",
      type: "boolean",
      conflicts: "rename",
      description: "Renombra los SSID quitando '- DISABLED' si es necesario."
    })
    .option("notUpdate", {
      alias: "X",
      type: "boolean",
      description: "No actualizar las configuraciones WiFi, solo lectura."
    })
    .option("notUpdateACL", {
      alias: "Z",
      type: "boolean",
      description: "No actualizar las configuraciones de Control MAC en el WiFi."
    })
    .option("disable", {
      type: "number",
      conflicts: "enable",
      description: "Deshabilitar WiFi"
    })
    .option("enable", {
      type: "number",
      conflicts: "disable",
      description: "Habilitar WiFi"
    })
    .help()
    .alias("help", "h")
    .argv;

  const req = new Request(argv.host);

  const { salt, saltwebui, cookies } = await req.doSaltLogin(argv.user!);
  console.log("Cookies            :", cookies);

  const hashed1 = doPbkdf2NotCoded(argv.pass!, salt);
  console.log("Encrypted Password :", hashed1);

  const hashedPassword = doPbkdf2NotCoded(hashed1, saltwebui);
  console.log("Hashed Password    :", hashedPassword);

  const res = await req.doLogin(argv.user!, hashedPassword, cookies);
  if (res) {
    console.log("X-CSRF-TOKEN       :", res.xCsrfToken);
    console.log("Cookies            :", res.cookies);

    const wifis = await req.getWifis(res, [...Array.from({ length: 100 }, (_, i) => i), ...[9]]);
    console.log("Wifis Found?       :", !!wifis);

    console.log("");

    // voy a identificar los wifis ahora  
    Object.keys(wifis)
      .filter((wifiId) => !isNaN(Number(wifiId)))
      .forEach((wifiId) => {
        const ssid = wifis[wifiId];
        console.log("WIFI ID        : ", wifiId);
        console.log("WIFI SSID      : ", ssid.data?.SSID);
        console.log("WIFI ENABLED   : ", ssid.data?.SSIDEnable);
        console.log("WIFI BROADCAST : ", ssid.data?.SSIDAdvertisementEnabled);
        console.log("ACL ENABLED    : ", ssid.data?.ACLEnable);
        console.log("RADIO ENABLED  : ", ssid.data?.RadioEnable);
        console.log("RADIO POWER    : ", ssid.data?.TransmitPower);
        console.log("PASSPHRASE     : ", ssid.data?.KeyPassphrase);
        console.log("MODE ENABLED   : ", ssid.data?.ModeEnabled);
        console.log("ENCRYPT METHOD : ", ssid.data?.EncryptionMethod);
        console.log("=======================================================");
      });

    const isPersonalWiFi = (wifi: any): boolean => String(wifi.data?.SSID ?? "").toLowerCase().includes("personal");

    // voy a identificar entonces que SSID está "enabled" y así, deshabilitarlo luego
    const enabledWifi = Object.keys(wifis)
      .filter((wifiId) => {
        const wifi = wifis[wifiId];
        return !isNaN(parseInt(wifiId)) && (
          ((wifi.data?.SSIDEnable === "true") || isPersonalWiFi(wifi)) ||
          !!argv.force ||
          !!argv.forceAll
        );
      })
      .map((wifiId) => ({ wifiId, data: pick(wifis[wifiId].data, ["SSID", "SSIDEnable", "SSIDAdvertisementEnabled", "RadioEnable", "WPSEnable", "TransmitPower", "KeyPassphrase", "ModeEnabled", "EncryptionMethod"]) }))
      .filter((wifi) => !argv.forceAll ? isPersonalWiFi(wifi) : true);

    console.log("");
    console.log("Identified WiFi(s) : ", enabledWifi);
    console.log("");

    if (argv.disable || argv.enable) {
      console.log(`${argv.enable ? "Enabling" : "Disabling"} WiFi settings...`);
      console.log("All other arguments are being ignored.");

      await req.toggleWifiSettings(res, argv.enable ?? argv.disable ?? 0, !!argv.enable);
    } else if (!argv.notUpdate) {
      console.log("Updating WiFi settings...");
      await req.updateWifiSettings(res, enabledWifi, !!argv.rename, !!argv.restore);
      console.log("WiFi settings updated.");
      console.log("");

      if (!argv.notUpdateACL) {
        console.log("Applying ACL configuration...");
        await req.applyACL(res, enabledWifi);
        console.log("ACL configuration applied.");
      }
    }

    console.log("");
    console.log("Done!");
  }
}

main();

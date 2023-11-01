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
        console.log("WIFI ID      : ", wifiId);
        console.log("WIFI SSID    : ", ssid.data?.SSID);
        console.log("WIFI ENABLED : ", ssid.data?.SSIDEnable);
        console.log("=======================================================");
      });

    // voy a identificar entonces que SSID está "enabled" y así, deshabilitarlo luego
    const enabledWifi = Object.keys(wifis)
      .filter((wifiId) => {
        const ssid = wifis[wifiId];
        return !isNaN(parseInt(wifiId)) && ((ssid.data?.SSIDEnable === "true") || !!argv.force || !!argv.forceAll);
      })
      .map((wifiId) => ({ wifiId, data: pick(wifis[wifiId].data, ["SSID", "SSIDEnable", "SSIDAdvertisementEnabled"]) }))
      .filter((wifi) => !argv.forceAll ? String(wifi.data?.SSID ?? "").toLowerCase().includes("personal") : true);

    console.log("Enabled Wifi ID: ", enabledWifi);
    req.disableWifi(res, enabledWifi);

    // req.getSystem(res);
  }

}

main();

const https = require("https");
const axios = require("axios");
const FormData = require("form-data");
const sjcl = require("sjcl");

const WIFI_FIELDS = [
  "ACLEnable",
  "FilterAsBlackList",
  "ACLTbl",
  "BSSID",
  "SSIDEnable",
  "SSIDAdvertisementEnabled",
  "OperatingStandards",
  "SSID",
  "ModeEnabled",
  "EncryptionMethod",
  "KeyPassphrase",
  "WEPKey64b1",
  "WEPKey128b1",
  "RadioEnable",
  "RadiusServerIPAddr",
  "RadiusServerPort",
  "RadiusReAuthInterval",
  "RadiusServerIPAddrSec",
  "RadiusServerPortSec",
  "WPSEnable",
  "ModesSupported",
  "TransmitPower"
].join(",");

const DEFAULT_INTERVAL_MINUTES = 60;
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_WIFI_UPDATE_TIMEOUT_MS = 45000;
const DEFAULT_ENABLE_DISABLE_DELAY_MS = 5000;
const DEFAULT_INITIAL_DELAY_MINUTES = 15;
const DEFAULT_TARGET_PREFIXES = ["personal", "flow", "zona wifi"];
const DEFAULT_TARGET_MATCHERS = ["personal wifi zone", "zona wifi", "wifi zone"];
const DEFAULT_WIFI_SCAN_IDS = Array.from({ length: 51 }, (_, index) => index);

function timestamp() {
  return new Date().toISOString();
}

function log(message) {
  console.log(`[${timestamp()}] ${message}`);
}

function logError(message, error) {
  const details = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`[${timestamp()}] ${message}${details ? `\n${details}` : ""}`);
}

function parseBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer value: ${value}`);
  }

  return parsed;
}

function parseCsv(value) {
  if (!value) {
    return [];
  }

  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseWifiIds(value) {
  const ids = parseCsv(value).map((entry) => Number.parseInt(entry, 10));
  if (ids.some(Number.isNaN)) {
    throw new Error(`Invalid TARGET_WIFI_IDS value: ${value}`);
  }
  return ids;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSsid(ssid) {
  return String(ssid || "").trim().toLowerCase();
}

function hasDisabledSuffix(ssid) {
  return normalizeSsid(ssid).endsWith("- disabled");
}

function stripDisabledSuffix(ssid) {
  return String(ssid || "").replace(/\s*- DISABLED$/i, "").trim();
}

function ensureDisabledSuffix(ssid) {
  const cleanSsid = stripDisabledSuffix(ssid);
  return cleanSsid ? `${cleanSsid} - DISABLED` : "DISABLED";
}

function readConfig() {
  const requestTimeoutMs = parsePositiveInt(process.env.REQUEST_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS);

  const config = {
    modemIp: process.env.MODEM_IP,
    modemUsername: process.env.MODEM_USERNAME,
    modemPassword: process.env.MODEM_PASSWORD,
    intervalMinutes: parsePositiveInt(process.env.CHECK_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES),
    initialDelayMinutes: parsePositiveInt(process.env.INITIAL_DELAY_MINUTES, DEFAULT_INITIAL_DELAY_MINUTES),
    requestTimeoutMs,
    wifiUpdateTimeoutMs: parsePositiveInt(
      process.env.WIFI_UPDATE_TIMEOUT_MS,
      Math.max(requestTimeoutMs, DEFAULT_WIFI_UPDATE_TIMEOUT_MS)
    ),
    enableDisableDelayMs: parsePositiveInt(process.env.ENABLE_DISABLE_DELAY_MS, DEFAULT_ENABLE_DISABLE_DELAY_MS),
    targetWifiIds: parseWifiIds(process.env.TARGET_WIFI_IDS),
    targetPrefixes: parseCsv(process.env.TARGET_SSID_PREFIXES).map((value) => value.toLowerCase()),
    targetMatchers: parseCsv(process.env.TARGET_SSID_MATCHERS).map((value) => value.toLowerCase()),
    dryRun: parseBoolean(process.env.DRY_RUN, false),
    runOnStart: parseBoolean(process.env.RUN_ON_START, true)
  };

  if (!config.modemIp || !config.modemUsername || !config.modemPassword) {
    throw new Error("MODEM_IP, MODEM_USERNAME and MODEM_PASSWORD are required");
  }

  if (!config.targetWifiIds.length && !config.targetPrefixes.length && !config.targetMatchers.length) {
    config.targetPrefixes = [...DEFAULT_TARGET_PREFIXES];
  }

  if (!config.targetWifiIds.length && !config.targetPrefixes.length && !config.targetMatchers.length) {
    config.targetMatchers = [...DEFAULT_TARGET_MATCHERS];
  }

  return config;
}

class ModemClient {
  constructor(host, timeoutMs, wifiUpdateTimeoutMs) {
    this.host = host;
    this.wifiUpdateTimeoutMs = wifiUpdateTimeoutMs;
    this.http = axios.create({
      baseURL: `https://${host}`,
      timeout: timeoutMs,
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });
  }

  defaultHeaders(csrf = "") {
    return {
      Accept: "*/*",
      "User-Agent": "Personal WiFi (nothing is free)",
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRF-TOKEN": csrf,
      Referer: `https://${this.host}/`,
      Host: this.host,
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive"
    };
  }

  parseCookies(rawCookies) {
    return (rawCookies || [])
      .flatMap((cookie) => cookie.split(";"))
      .map((cookie) => cookie.trim())
      .filter((cookie) => cookie.startsWith("auth=") || cookie.startsWith("PHPSESSID="));
  }

  hashPassword(password, salt) {
    const derivedKey = sjcl.misc.pbkdf2(password, salt, 1000, 128);
    return sjcl.codec.hex.fromBits(derivedKey);
  }

  async doSaltLogin(username) {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", "seeksalthash");

    const response = await this.http.post("/api/v1/session/login", formData, {
      headers: {
        ...formData.getHeaders(),
        ...this.defaultHeaders()
      }
    });

    const cookies = this.parseCookies(response.headers["set-cookie"]).join("; ").concat(";");

    return {
      salt: response.data.salt,
      saltwebui: response.data.saltwebui,
      cookies
    };
  }

  async doLogin(username, password) {
    const saltLogin = await this.doSaltLogin(username);
    const hashed1 = this.hashPassword(password, saltLogin.salt);
    const hashedPassword = this.hashPassword(hashed1, saltLogin.saltwebui);

    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", hashedPassword);

    const loginResponse = await this.http.post("/api/v1/session/login", formData, {
      headers: {
        ...formData.getHeaders(),
        ...this.defaultHeaders(),
        Cookie: saltLogin.cookies
      }
    });

    if (loginResponse.data.error !== "ok") {
      throw new Error("Modem login failed");
    }

    const cookies = this.parseCookies(loginResponse.headers["set-cookie"]);
    const csrfCookie = cookies.find((cookie) => cookie.startsWith("auth="));
    if (!csrfCookie) {
      throw new Error("Missing auth cookie after login");
    }

    const xCsrfToken = csrfCookie.split("=")[1];
    const cookieHeader = cookies.join("; ").concat(";");

    await this.http.get("/", {
      headers: {
        ...this.defaultHeaders(xCsrfToken),
        Cookie: cookieHeader
      }
    });

    return { cookies: cookieHeader, xCsrfToken };
  }

  async getWifis(headers, ids = DEFAULT_WIFI_SCAN_IDS) {
    const cookieHeaders = {
      ...this.defaultHeaders(headers.xCsrfToken),
      Cookie: headers.cookies
    };

    await this.http.get("/api/v1/session/menu", { headers: cookieHeaders });

    const response = await this.http.get(`/api/v1/wifi/${ids}/${WIFI_FIELDS}`, {
      headers: cookieHeaders
    });

    return Object.keys(response.data)
      .map((wifiId) => ({
        wifiId: Number.parseInt(wifiId, 10),
        data: response.data[wifiId] && response.data[wifiId].data
      }))
      .filter((wifi) => Number.isInteger(wifi.wifiId) && wifi.data);
  }

  buildToggleForm(wifiId, wifiName, enable, minimal) {
    const formData = new FormData();
    const cleanWifiName = stripDisabledSuffix(wifiName);

    ["SSIDEnable", "RadioEnable", "SSIDAdvertisementEnabled"].forEach((key) => {
      formData.append(`${wifiId}[${key}]`, enable ? "true" : "false");
    });
    formData.append(`${wifiId}[WPSEnable]`, "false");

    if (!enable && !minimal) {
      formData.append(`${wifiId}[SSID]`, ensureDisabledSuffix(wifiName));
      formData.append(`${wifiId}[TransmitPower]`, "25");
      formData.append(`${wifiId}[KeyPassphrase]`, this.generateRandomPassword());
      formData.append(`${wifiId}[ModeEnabled]`, "WPA2-Personal");
      formData.append(`${wifiId}[EncryptionMethod]`, "AES");
    } else if (enable) {
      formData.append(`${wifiId}[SSID]`, cleanWifiName);
    }

    return formData;
  }

  generateRandomPassword() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&*+,-./:=?@^_~";
    const passwordLength = Math.floor(Math.random() * (32 - 16 + 1)) + 16;
    let password = "";

    for (let index = 0; index < passwordLength; index += 1) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      password += chars[randomIndex];
    }

    return password;
  }

  logWifiUpdateResult(responseData) {
    Object.keys(responseData).forEach((wifiId) => {
      const result = responseData[wifiId];
      if (!result || typeof result !== "object") {
        return;
      }

      const extra = result.error === "ok" ? "" : ` | ${JSON.stringify(result.data || {})}`;
      log(`WiFi [${wifiId}] => ${result.error}: ${result.message}${extra}`);
    });
  }

  hasWifiUpdateError(responseData) {
    return Object.keys(responseData).some((wifiId) => responseData[wifiId] && responseData[wifiId].error === "error");
  }

  async postWifiUpdate(headers, wifiId, formData) {
    const response = await this.http.post(`/api/v1/wifi/${wifiId}`, formData, {
      timeout: this.wifiUpdateTimeoutMs,
      headers: {
        ...formData.getHeaders(),
        ...this.defaultHeaders(headers.xCsrfToken),
        Cookie: headers.cookies
      }
    });

    this.logWifiUpdateResult(response.data);
    return response.data;
  }

  async toggleWifi(headers, wifiId, wifiName, enable) {
    const fullResponse = await this.postWifiUpdate(
      headers,
      wifiId,
      this.buildToggleForm(wifiId, wifiName, enable, false)
    );

    if (!this.hasWifiUpdateError(fullResponse)) {
      return;
    }

    if (!enable) {
      log(`WiFi [${wifiId}] disable failed with full payload, retrying with minimal payload.`);
      const minimalResponse = await this.postWifiUpdate(
        headers,
        wifiId,
        this.buildToggleForm(wifiId, wifiName, enable, true)
      );

      if (!this.hasWifiUpdateError(minimalResponse)) {
        return;
      }
    }

    throw new Error(`WiFi update failed for ID ${wifiId} (${enable ? "enable" : "disable"})`);
  }

  async logout(headers) {
    const formData = new FormData();

    try {
      await this.http.post("/api/v1/session/logout", formData, {
        headers: {
          ...formData.getHeaders(),
          ...this.defaultHeaders(headers.xCsrfToken),
          Cookie: headers.cookies
        }
      });
    } catch (error) {
      logError("Logout request failed; continuing anyway.", error);
    }
  }
}

function matchesTarget(wifi, config) {
  if (!wifi || !wifi.data) {
    return false;
  }

  if (config.targetWifiIds.length > 0) {
    return config.targetWifiIds.includes(wifi.wifiId);
  }

  const ssid = normalizeSsid(wifi.data.SSID);
  if (!ssid) {
    return false;
  }

  if (config.targetPrefixes.length > 0) {
    return config.targetPrefixes.some((prefix) => ssid.startsWith(prefix));
  }

  return config.targetMatchers.some((matcher) => ssid.includes(matcher));
}

function describeWifi(wifi) {
  return `#${wifi.wifiId} (${wifi.data.SSID || "SSID vacio"})`;
}

function findCurrentWifi(wifis, originalWifi) {
  const byId = wifis.find((wifi) => wifi.wifiId === originalWifi.wifiId);
  if (byId) {
    return byId;
  }

  const originalBaseSsid = stripDisabledSuffix(originalWifi.data.SSID);
  return wifis.find((wifi) => stripDisabledSuffix(wifi.data.SSID) === originalBaseSsid) || originalWifi;
}

async function runCycle(config) {
  const client = new ModemClient(config.modemIp, config.requestTimeoutMs, config.wifiUpdateTimeoutMs);
  let headers;

  try {
    log(`Starting cycle against modem ${config.modemIp}`);
    headers = await client.doLogin(config.modemUsername, config.modemPassword);
    log("Login succeeded.");

    const wifis = await client.getWifis(headers);
    const targets = wifis.filter((wifi) => matchesTarget(wifi, config));

    if (targets.length === 0) {
      const available = wifis
        .map((wifi) => describeWifi(wifi))
        .slice(0, 10)
        .join(", ");
      throw new Error(`No target WiFi matched. First detected entries: ${available || "none"}`);
    }

    log(`Matched ${targets.length} target WiFi entries: ${targets.map((wifi) => describeWifi(wifi)).join(", ")}`);

    if (config.dryRun) {
      log("DRY_RUN enabled. Skipping modem updates.");
      return;
    }

    for (const targetWifi of targets) {
      let currentWifi = targetWifi;
      let wifiName = currentWifi.data.SSID || `WiFi #${currentWifi.wifiId}`;

      log(`Sending enable for ${describeWifi(currentWifi)}`);
      await client.toggleWifi(headers, currentWifi.wifiId, wifiName, true);

      const refreshedAfterEnable = await client.getWifis(headers);
      currentWifi = findCurrentWifi(refreshedAfterEnable, currentWifi);
      log(`State after enable: ${describeWifi(currentWifi)}`);

      if (config.enableDisableDelayMs > 0) {
        log(`Waiting ${config.enableDisableDelayMs} ms before disable for ${describeWifi(currentWifi)}`);
        await sleep(config.enableDisableDelayMs);
      }

      const refreshedBeforeDisable = await client.getWifis(headers);
      currentWifi = findCurrentWifi(refreshedBeforeDisable, currentWifi);
      wifiName = currentWifi.data.SSID || `WiFi #${currentWifi.wifiId}`;

      log(`Sending disable for ${describeWifi(currentWifi)}`);
      await client.toggleWifi(headers, currentWifi.wifiId, wifiName, false);
    }

    log("Cycle completed successfully.");
  } finally {
    if (headers) {
      await client.logout(headers);
    }
  }
}

function printHelp() {
  console.log(`Technicolor WiFi Zone daemon

Required environment variables:
  MODEM_IP
  MODEM_USERNAME
  MODEM_PASSWORD

Optional environment variables:
  TARGET_WIFI_IDS=9
  TARGET_SSID_PREFIXES=personal,flow,zona wifi
  TARGET_SSID_MATCHERS=personal wifi zone,zona wifi
  CHECK_INTERVAL_MINUTES=60
  INITIAL_DELAY_MINUTES=15
  ENABLE_DISABLE_DELAY_MS=5000
  REQUEST_TIMEOUT_MS=15000
  WIFI_UPDATE_TIMEOUT_MS=45000
  RUN_ON_START=true
  DRY_RUN=false

CLI flags:
  --once   Run a single cycle and exit
  --help   Show this message
`);
}

async function main() {
  if (process.argv.includes("--help")) {
    printHelp();
    return;
  }

  const once = process.argv.includes("--once");
  const config = readConfig();
  const intervalMs = config.intervalMinutes * 60 * 1000;
  const initialDelayMs = config.initialDelayMinutes * 60 * 1000;

  let isRunning = false;
  let timer = null;
  let stopped = false;

  const scheduleNext = (delayMs) => {
    if (stopped || once) {
      return;
    }

    timer = setTimeout(() => {
      void executeCycle();
    }, delayMs);
    log(`Next cycle scheduled in ${Math.round(delayMs / 1000)} seconds.`);
  };

  const executeCycle = async () => {
    if (stopped) {
      return;
    }

    if (isRunning) {
      log("Previous cycle is still running. Skipping overlapping execution.");
      scheduleNext(intervalMs);
      return;
    }

    isRunning = true;
    try {
      await runCycle(config);
      if (once) {
        return;
      }
    } catch (error) {
      logError("Cycle failed.", error);
      if (once) {
        process.exitCode = 1;
        return;
      }
    } finally {
      isRunning = false;
    }

    scheduleNext(intervalMs);
  };

  const shutdown = (signal) => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    log(`Received ${signal}. Exiting daemon.`);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  if (once) {
    await executeCycle();
    return;
  }

  if (config.runOnStart) {
    if (initialDelayMs > 0) {
      log(`Daemon started. First cycle will run in ${config.initialDelayMinutes} minute(s).`);
      scheduleNext(initialDelayMs);
      return;
    }

    await executeCycle();
    return;
  }

  log(`Daemon started. First cycle will run in ${config.intervalMinutes} minute(s).`);
  scheduleNext(intervalMs);
}

void main().catch((error) => {
  logError("Fatal startup error.", error);
  process.exitCode = 1;
});
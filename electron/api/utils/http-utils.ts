import https from "https";

export const httpsAgent: { httpsAgent: https.Agent } = {
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
};

export const  defaultHeaders = (csrf: string = "", sourceHost: string = "192.168.0.1") => ({
  "Accept": "*/*",
  "User-Agent": "Personal WiFi (nothing is free)",
  "X-Requested-With": "XMLHttpRequest",
  "X-CSRF-TOKEN": csrf,
  "Referer": `https://${sourceHost}/`,
  "Host": sourceHost,
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"
});

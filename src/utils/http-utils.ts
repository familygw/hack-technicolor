import https from "https";

export const httpsAgent: { httpsAgent: https.Agent } = {
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
};

export const defaultHeaders = (csrf: string = "") => ({
  "Accept": "*/*",
  "User-Agent": "Personal WiFi (nothing is free)",
  "X-Requested-With": "XMLHttpRequest",
  "X-CSRF-TOKEN": csrf,
  "Referer": "https://192.168.100.1/",
  "Host": "192.168.100.1",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"
});

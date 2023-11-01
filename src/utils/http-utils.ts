import https from "https";

export const httpsAgent: { httpsAgent: https.Agent } = {
  httpsAgent: new https.Agent({
    rejectUnauthorized: false
  })
};

export const defaultHeaders = (csrf: string = "") => ({
  "Accept": "*/*",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
  "X-CSRF-TOKEN": csrf,
  "Referer": "https://192.168.100.1/",
  "Host": "192.168.100.1",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"
});

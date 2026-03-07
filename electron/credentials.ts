import { safeStorage, app } from "electron";
import fs from "fs";
import path from "path";

interface StoredCredentials {
  modemIp: string;
  username: string;
  password: string;
}

const getCredsPath = () => path.join(app.getPath("userData"), "credentials.enc");

export function saveCredentials(creds: StoredCredentials): void {
  if (!safeStorage.isEncryptionAvailable()) return;
  const encrypted = safeStorage.encryptString(JSON.stringify(creds));
  fs.writeFileSync(getCredsPath(), encrypted);
}

export function loadCredentials(): StoredCredentials | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  const credsPath = getCredsPath();
  if (!fs.existsSync(credsPath)) return null;
  try {
    const encrypted = fs.readFileSync(credsPath);
    const decrypted = safeStorage.decryptString(encrypted);
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

export function clearCredentials(): void {
  const credsPath = getCredsPath();
  if (fs.existsSync(credsPath)) fs.unlinkSync(credsPath);
}

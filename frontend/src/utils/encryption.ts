import CryptoJS from "crypto-js";
import { apiConfig } from "@/config";

export const encryptText = (text: string) => {
  if (!apiConfig.encryptionSecret) {
    throw new Error("VITE_ENCRYPTION_SECRET is required");
  }

  return CryptoJS.AES.encrypt(text, apiConfig.encryptionSecret).toString();
};

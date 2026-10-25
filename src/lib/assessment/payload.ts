import { APP } from "./config";

// Tamper-evident payload: base64url(JSON) + "." + HMAC-SHA256(base64url, pepper)
const PEPPER = "ICC-DSA-ROUNDCHECK-9f41c7e2b8d3";

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacHex(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(PEPPER),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function encodePayload(payload: unknown): Promise<string> {
  const json = JSON.stringify(payload);
  const b64 = bytesToBase64Url(new TextEncoder().encode(json));
  const mac = await hmacHex(b64);
  return `ICC1.${b64}.${mac}`;
}

export async function decodePayload(code: string): Promise<unknown> {
  const trimmed = code.trim();
  const [tag, b64, mac] = trimmed.split(".");
  if (tag !== "ICC1" || !b64 || !mac) {
    throw new Error("Invalid result code format.");
  }
  const expected = await hmacHex(b64);
  if (expected !== mac) {
    throw new Error("Verification failed: the result code has been tampered with.");
  }
  const json = new TextDecoder().decode(base64UrlToBytes(b64));
  return JSON.parse(json);
}

export function gmailComposeUrl(resultCode: string, candidateName: string, summary: string): string {
  const subject = `${APP.emailSubjectPrefix} ${candidateName}`;
  const body = `${summary}\n\nDo not modify the text below.\n\nOfficial verification code:\n${resultCode}`;
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
    APP.evaluatorEmail,
  )}&cc=${encodeURIComponent(APP.evaluatorCcEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export interface DeviceLock {
  attemptId: string;
  name: string;
  email: string;
  at: string;
}

export const DEVICE_LOCK_KEY = "icc-assessment-device-lock";

export function readDeviceLock(): DeviceLock | null {
  try {
    const raw = localStorage.getItem(DEVICE_LOCK_KEY);
    return raw ? (JSON.parse(raw) as DeviceLock) : null;
  } catch {
    // unreadable storage: allow the attempt rather than blocking a candidate
    return null;
  }
}

export function writeDeviceLock(lock: DeviceLock): void {
  try {
    localStorage.setItem(DEVICE_LOCK_KEY, JSON.stringify(lock));
  } catch {
    // storage unavailable: device lock cannot be enforced
  }
}

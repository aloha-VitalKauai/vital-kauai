"use client";

// Biometric unlock helper for the Capacitor iOS shell.
//
// Wraps @aparajita/capacitor-biometric-auth in a small typed surface
// that is *safe to call from any client component*. Every entry point
// short-circuits to an inert default when not running inside the
// Capacitor native shell, so web and PWA users never trigger native
// code paths and never see permission prompts.
//
// What this is NOT:
// - Not an auth system. Supabase remains the source of truth for
//   sessions and middleware-enforced authorization.
// - Not a credential store. We never write Supabase passwords or
//   tokens here. The only persisted bit is a single localStorage
//   flag ("vk_biometric_enabled") indicating the user opted in on
//   this device.
// - Not a security boundary on its own. Biometric verification is a
//   *local convenience* layered on top of the existing authenticated
//   WebView session. If the device-holder fails biometric, we sign
//   them out and route them through the existing /login flow.
//
// Why dynamic imports: the plugin's JS module references native
// bridge code that does not exist in a browser context. Statically
// importing it would pull native-only references into every client
// bundle (and break SSR). Dynamic-importing inside guarded entry
// points keeps the plugin out of the web build's hot path.

import { Capacitor } from "@capacitor/core";

const ENABLED_KEY = "vk_biometric_enabled";
const DISMISSED_KEY = "vk_biometric_enroll_dismissed";

export type BiometryKind = "faceId" | "touchId" | "other" | "none";

export type BiometricAvailability = {
  available: boolean;
  kind: BiometryKind;
};

// True only inside the Capacitor native iOS shell. Web, PWA, and
// any future Android wrapper return false. This is the single gate
// every other function in this module checks first.
export function isNativeIOS(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

// Probes the device for biometric availability. Returns
// { available: false, kind: "none" } whenever we are not in native
// iOS, so the caller can render conditionally without its own guard.
export async function checkAvailability(): Promise<BiometricAvailability> {
  if (!isNativeIOS()) return { available: false, kind: "none" };
  try {
    const { BiometricAuth, BiometryType } = await import(
      "@aparajita/capacitor-biometric-auth"
    );
    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable) return { available: false, kind: "none" };
    let kind: BiometryKind = "other";
    if (info.biometryType === BiometryType.faceId) kind = "faceId";
    else if (info.biometryType === BiometryType.touchId) kind = "touchId";
    return { available: true, kind };
  } catch {
    return { available: false, kind: "none" };
  }
}

// Prompts the OS for biometric verification. Resolves true on
// success (Face ID / Touch ID / device-passcode fallback all count),
// false on cancel or failure. No-op (returns false) outside native iOS.
export async function authenticate(reason: string): Promise<boolean> {
  if (!isNativeIOS()) return false;
  try {
    const { BiometricAuth } = await import(
      "@aparajita/capacitor-biometric-auth"
    );
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      iosFallbackTitle: "Use Passcode",
      allowDeviceCredential: true,
    });
    return true;
  } catch {
    return false;
  }
}

// localStorage helpers. Per-WebView storage; uninstalling the native
// app clears these alongside the Supabase session, returning the
// device to the same state as a fresh install.

export function isEnrolled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ENABLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setEnrolled(enrolled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enrolled) window.localStorage.setItem(ENABLED_KEY, "1");
    else window.localStorage.removeItem(ENABLED_KEY);
  } catch {
    // localStorage may be unavailable (private mode, quota); silent.
  }
}

export function isEnrollPromptDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissEnrollPrompt(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // silent
  }
}

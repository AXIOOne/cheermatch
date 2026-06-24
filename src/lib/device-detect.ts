// Lightweight device detection for the mobile capture flow.
// Distinguishes phone / tablet / desktop and OS without any user-agent parsing libs.

export type DeviceKind = "phone" | "tablet" | "desktop";
export type DeviceOS = "ios" | "android" | "other";

export type DetectedDevice = {
  kind: DeviceKind;
  os: DeviceOS;
};

export function detectDevice(): DetectedDevice {
  if (typeof navigator === "undefined") return { kind: "desktop", os: "other" };
  const ua = navigator.userAgent || "";
  const maxTouch = navigator.maxTouchPoints || 0;

  // iPadOS 13+ reports as "MacIntel" desktop Safari; disambiguate via touch points.
  const isIPad =
    /iPad/i.test(ua) ||
    (/(Macintosh|MacIntel)/.test(ua) && maxTouch > 1);
  const isIPhone = /iPhone|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isAndroidTablet = isAndroid && !/Mobile/i.test(ua);
  const isAndroidPhone = isAndroid && /Mobile/i.test(ua);

  let kind: DeviceKind = "desktop";
  if (isIPhone || isAndroidPhone) kind = "phone";
  else if (isIPad || isAndroidTablet) kind = "tablet";

  let os: DeviceOS = "other";
  if (isIPhone || isIPad) os = "ios";
  else if (isAndroid) os = "android";

  return { kind, os };
}

export function deviceLabel(d: DetectedDevice): string {
  if (d.os === "ios" && d.kind === "phone") return "iPhone";
  if (d.os === "ios" && d.kind === "tablet") return "iPad";
  if (d.os === "android" && d.kind === "phone") return "Android phone";
  if (d.os === "android" && d.kind === "tablet") return "Android tablet";
  if (d.kind === "tablet") return "Tablet";
  if (d.kind === "phone") return "Phone";
  return "Laptop / Desktop";
}

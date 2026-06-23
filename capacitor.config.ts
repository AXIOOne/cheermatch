import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.2c3cf65aff5b451a87e1f8f6c14f9f5c",
  appName: "cheermatch",
  webDir: "dist",
  server: {
    // Hot-reload from the Lovable preview while developing.
    // Remove this `server` block when building a production .ipa / .aab.
    url: "https://2c3cf65a-ff5b-451a-87e1-f8f6c14f9f5c.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    // Allow inline (non-fullscreen) video playback in WKWebView.
    contentInset: "always",
  },
};

export default config;

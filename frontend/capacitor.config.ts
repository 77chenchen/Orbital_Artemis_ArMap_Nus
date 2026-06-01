import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.atlas.nus",
  appName: "Atlas",
  webDir: "dist",
  server: {
    url: "https://orbital-artemis-armap-nus.onrender.com",
    cleartext: false,
  },
};

export default config;

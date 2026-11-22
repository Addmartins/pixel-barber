import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pixelbarber.app",
  appName: "Pixel Barber",
  webDir: "out",
  server: { hostname: "localhost", androidScheme: "https", iosScheme: "capacitor" },
  backgroundColor: "#0b0d13",
  plugins: {
    CapacitorHttp: { enabled: true },
    StatusBar: { style: "DARK", backgroundColor: "#0b0d13", overlaysWebView: true },
    SystemBars: { style: "DARK", insetsHandling: "css" },
  },
};

export default config;

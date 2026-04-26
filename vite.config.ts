import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Ahlul Athar Platform",
        short_name: "Ahlul Athar",
        description: "منصة أهل الأثر",
        theme_color: "#0f172a",
        background_color: "#0b1120",
        display: "standalone",
        start_url: "/",
        lang: "ar",
        orientation: "portrait",
        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }
          if (id.includes("firebase") || id.includes("@firebase")) {
            return "vendor-firebase";
          }
          if (id.includes("react-router") || id.includes("react-dom") || id.includes("react/")) {
            return "vendor-react";
          }
          if (id.includes("react-icons")) {
            return "vendor-icons";
          }
          if (id.includes("workbox") || id.includes("vite-plugin-pwa")) {
            return undefined;
          }
          return "vendor";
        },
      },
    },
  },
});

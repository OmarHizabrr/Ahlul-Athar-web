import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/** يُستخدم عند غياب VITE_SITE_URL في .env (مثال: نطاق Firebase الافتراضي). غيّره إلى نطاقك النهائي. */
const DEFAULT_SITE_URL = "https://ahlul-athar-foundation-8734b.web.app";

function htmlSeoReplacePlugin(siteUrl: string, googleVerify: string | undefined) {
  const site = siteUrl.replace(/\/$/, "");
  return {
    name: "html-seo-replace",
    transformIndexHtml(html: string) {
      let out = html.replaceAll("__SITE_URL__", site);
      if (googleVerify?.trim()) {
        out = out.replace(
          "</head>",
          `    <meta name="google-site-verification" content="${googleVerify.trim()}" />\n  </head>`,
        );
      }
      return out;
    },
  };
}

function seoWritePlugin(siteUrl: string) {
  const site = siteUrl.replace(/\/$/, "");
  const publicPaths = ["/", "/login", "/role-selector"] as const;
  return {
    name: "vite-plugin-seo-files",
    closeBundle() {
      const dist = resolve(process.cwd(), "dist");
      const robots = [
        "User-agent: *",
        "Allow: /",
        "",
        "# مناطق التطبيق المحمية — تقليل فهرسة صفحات لوحة التحكم ومساحة الطالب",
        "Disallow: /admin",
        "Disallow: /student",
        "",
        `Sitemap: ${site}/sitemap.xml`,
        "",
      ].join("\n");
      writeFileSync(resolve(dist, "robots.txt"), robots, "utf8");

      const urlEntries = publicPaths
        .map((p) => {
          const loc = p === "/" ? `${site}/` : `${site}${p}`;
          const priority = p === "/" ? "1.0" : "0.7";
          return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
        })
        .join("\n");
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlEntries}\n</urlset>\n`;
      writeFileSync(resolve(dist, "sitemap.xml"), sitemap, "utf8");
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const siteUrl = (env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
  const googleVerify = env.VITE_GOOGLE_SITE_VERIFICATION;

  return {
    plugins: [
      htmlSeoReplacePlugin(siteUrl, googleVerify),
      react(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["logo.png"],
        manifest: {
          name: "أهل الأثر | منصة تعليمية",
          short_name: "أهل الأثر",
          description:
            "منصة أهل الأثر: دورات، ملفات، منشورات، وإشعارات — بين الويب والتطبيق.",
          theme_color: "#0f172a",
          background_color: "#0b1120",
          display: "standalone",
          start_url: "/",
          lang: "ar",
          orientation: "portrait",
          icons: [
            {
              src: "/logo.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/logo.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "/logo.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
      }),
      seoWritePlugin(siteUrl),
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
  };
});

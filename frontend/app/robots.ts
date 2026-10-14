import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/assets";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/login",
          "/register",
          "/post",
          "/my-account",
          "/reset-password",
          "/owner-reset-password",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

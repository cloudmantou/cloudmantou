import { MetadataRoute } from "next";
import { DEFAULT_SITE_URL } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.SITE_URL?.replace(/\/$/, "") ||
    DEFAULT_SITE_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/post/", "/category/", "/login", "/register"],
        disallow: ["/admin/", "/api/", "/dashboard/", "/private/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://cloudmantou.com";

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

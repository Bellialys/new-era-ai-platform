import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/arena", "/code", "/history", "/share/"],
        disallow: ["/api/", "/profile/", "/login", "/signup", "/auth/"],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://new-era-ai.vercel.app"}/sitemap.xml`,
  };
}

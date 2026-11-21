import type { Metadata } from "next";
import { DEFAULT_SITE_URL } from "@/config/site";
import { HONGJIAN_APP, getHongjianPage, type HongjianPageKey } from "@/config/hongjian-app";

export function buildHongjianMetadata(page: HongjianPageKey): Metadata {
  const copy = getHongjianPage(page);
  const title = page === "home" ? `${HONGJIAN_APP.name} - 阅读与听书` : `${copy.title} - ${HONGJIAN_APP.name}`;
  const url = `${DEFAULT_SITE_URL}${copy.path}`;
  return {
    title: { absolute: title },
    description: copy.description,
    alternates: { canonical: url },
    openGraph: { title, description: copy.description, url, type: "website" },
    robots: { index: true, follow: true },
  };
}

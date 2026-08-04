import { isOfficialSite } from "@/config/site";
import {
  buildBlogJsonLd,
  buildSoftwareApplicationJsonLd,
  buildWebSiteJsonLd,
  type SeoContext,
} from "@/lib/seo";
import { serializeJsonLd } from "@/lib/json-ld";

type Props = {
  ctx: SeoContext;
  extra?: Record<string, unknown>[];
  nonce?: string;
  variant?: "auto" | "editorial" | "extra";
};

export function JsonLd({ ctx, extra = [], nonce, variant = "auto" }: Props) {
  const baseGraphs = variant === "extra"
    ? []
    : variant === "editorial"
      ? [buildWebSiteJsonLd(ctx), buildBlogJsonLd(ctx)]
      : [
          buildWebSiteJsonLd(ctx),
          buildSoftwareApplicationJsonLd(ctx),
          ...(isOfficialSite ? [] : [buildBlogJsonLd(ctx)]),
        ];
  const graphs = [...baseGraphs, ...extra];

  return (
    <script
      type="application/ld+json"
      {...(nonce ? { nonce } : {})}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(graphs) }}
    />
  );
}

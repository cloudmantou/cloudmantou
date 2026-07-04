import {
  buildBlogJsonLd,
  buildSoftwareApplicationJsonLd,
  buildWebSiteJsonLd,
  type SeoContext,
} from "@/lib/seo";

type Props = {
  ctx: SeoContext;
  extra?: Record<string, unknown>[];
};

export function JsonLd({ ctx, extra = [] }: Props) {
  const graphs = [
    buildBlogJsonLd(ctx),
    buildWebSiteJsonLd(ctx),
    buildSoftwareApplicationJsonLd(ctx),
    ...extra,
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graphs) }}
    />
  );
}
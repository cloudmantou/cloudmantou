import {
  buildBlogJsonLd,
  buildSoftwareApplicationJsonLd,
  buildWebSiteJsonLd,
  type SeoContext,
} from "@/lib/seo";

type Props = {
  ctx: SeoContext;
  extra?: Record<string, unknown>[];
  nonce?: string;
};

export function JsonLd({ ctx, extra = [], nonce }: Props) {
  const graphs = [
    buildBlogJsonLd(ctx),
    buildWebSiteJsonLd(ctx),
    buildSoftwareApplicationJsonLd(ctx),
    ...extra,
  ];

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graphs) }}
    />
  );
}
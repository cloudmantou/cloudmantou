import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";
import { isSafeExternalHref, isSafeMarkdownImageSrc } from "@/lib/safe-image-url";
import { createHeadingId } from "@/lib/editorial-article";

type MarkdownRendererProps = {
  content: string;
  className?: string;
  locale?: "zh" | "en";
};

function textFromChildren(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      if (!isValidElement(child)) return "";
      return textFromChildren((child as ReactElement<{ children?: ReactNode }>).props.children);
    })
    .join("");
}

export function MarkdownRenderer({
  content,
  className = "article-prose",
  locale = "zh",
}: MarkdownRendererProps) {
  const headingOccurrence = new Map<string, number>();
  const heading = (level: 2 | 3, children: ReactNode) => {
    const headingText = textFromChildren(children);
    const headingId = createHeadingId(headingText, headingOccurrence);
    const content = (
      <>
        {children}
        <a
          className="article-heading-anchor"
          href={`#${headingId}`}
          aria-label={locale === "en" ? `Link to ${headingText}` : `链接到${headingText}`}
        >
          <span aria-hidden="true">#</span>
        </a>
      </>
    );
    return level === 2 ? <h2 id={headingId}>{content}</h2> : <h3 id={headingId}>{content}</h3>;
  };

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSanitize]}
        components={{
          h2: ({ children }) => heading(2, children),
          h3: ({ children }) => heading(3, children),
          img: ({ src, alt }) => {
            if (!src?.trim() || !isSafeMarkdownImageSrc(src)) return null;
            return (
              <figure className="md-figure">
                <span className="md-image-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={alt || ""}
                    width={1200}
                    height={675}
                    loading="lazy"
                    decoding="async"
                  />
                </span>
                {alt && alt !== "image" && alt !== "paste" ? (
                  <figcaption>{alt}</figcaption>
                ) : null}
              </figure>
            );
          },
          a: ({ href, children }) => {
            if (!href || !isSafeExternalHref(href)) {
              return <span>{children}</span>;
            }
            const internal = href.startsWith("#") || (href.startsWith("/") && !href.startsWith("//"));
            return (
              <a
                href={href}
                target={internal ? undefined : "_blank"}
                rel={internal ? undefined : "noopener noreferrer nofollow"}
                referrerPolicy={internal ? undefined : "no-referrer"}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

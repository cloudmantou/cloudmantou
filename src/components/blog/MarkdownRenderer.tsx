import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize from "rehype-sanitize";

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

export function MarkdownRenderer({
  content,
  className = "article-prose",
}: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeSanitize]}
        components={{
          img: ({ src, alt }) => (
            <figure className="md-figure">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={alt || ""} loading="lazy" decoding="async" />
              {alt && alt !== "image" && alt !== "paste" ? (
                <figcaption>{alt}</figcaption>
              ) : null}
            </figure>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

import { LockKeyhole, Timer } from "lucide-react";
import type { BlogPost } from "@/types";
import { AccentTag } from "@/components/ui/AccentTag";

type BlogCardProps = {
  post: BlogPost;
  index?: number;
};

export function BlogCard({ post, index = 0 }: BlogCardProps) {
  return (
    <article
      className="blog-card fade-up"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <span className="blog-cover" style={{ backgroundImage: post.cover }}>
        <span>{post.icon}</span>
      </span>
      <span className="blog-body">
        <span className="blog-meta">
          {post.categoryName ? (
            <>
              <span className="blog-category-pill">{post.categoryName}</span>
              <span className="meta-dot" />
            </>
          ) : null}
          <span>{post.date}</span>
          <span className="meta-dot" />
          <Timer size={13} aria-hidden="true" />
          <span>{post.readTime}</span>
          {post.premium ? (
            <span className="premium-lock">
              <LockKeyhole size={12} aria-hidden="true" />
              会员
            </span>
          ) : null}
        </span>
        <span className="tag-row">
          {post.tags.map((tag) => (
            <AccentTag accent={tag.accent} key={tag.label}>
              {tag.label}
            </AccentTag>
          ))}
        </span>
        <strong className="blog-title">{post.title}</strong>
        <span className="blog-excerpt">{post.excerpt}</span>
      </span>
    </article>
  );
}
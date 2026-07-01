export default function PostLoading() {
  return (
    <div className="min-h-screen" style={{ background: "var(--article-bg)" }}>
      {/* Top bar skeleton */}
      <div
        className="flex items-center px-4 sm:px-8 py-3"
        style={{ borderBottom: "1px solid var(--article-border)" }}
      >
        <div
          className="w-20 h-4 rounded animate-pulse"
          style={{ background: "var(--card)" }}
        />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Cover skeleton */}
        <div
          className="w-full aspect-[21/9] rounded-xl mb-8 animate-pulse"
          style={{ background: "var(--card)" }}
        />

        {/* Title skeleton */}
        <div className="flex flex-col gap-3 mb-8">
          <div
            className="w-4/5 h-8 rounded animate-pulse"
            style={{ background: "var(--card)" }}
          />
          <div
            className="w-3/5 h-8 rounded animate-pulse"
            style={{ background: "var(--card)" }}
          />
        </div>

        {/* Meta skeleton */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className="w-16 h-4 rounded animate-pulse"
            style={{ background: "var(--card)" }}
          />
          <div
            className="w-24 h-4 rounded animate-pulse"
            style={{ background: "var(--card)" }}
          />
          <div
            className="w-16 h-4 rounded animate-pulse"
            style={{ background: "var(--card)" }}
          />
        </div>

        {/* Content skeleton */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-4 rounded mb-4 animate-pulse"
            style={{
              background: "var(--card)",
              width: `${60 + Math.random() * 40}%`,
              animationDelay: `${i * 100}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

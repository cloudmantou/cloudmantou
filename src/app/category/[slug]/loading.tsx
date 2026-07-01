export default function CategoryLoading() {
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="page-head" style={{ marginBottom: 28 }}>
        <div
          className="w-40 h-8 rounded animate-pulse mb-2"
          style={{ background: "var(--card)" }}
        />
        <div
          className="w-64 h-4 rounded animate-pulse"
          style={{ background: "var(--card)" }}
        />
      </div>

      <div className="blog-list">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="blog-card"
            style={{ pointerEvents: "none", opacity: 0.6 }}
          >
            <span className="blog-body">
              <div
                className="w-32 h-3 rounded animate-pulse mb-3"
                style={{ background: "var(--border)" }}
              />
              <div
                className="w-3/4 h-5 rounded animate-pulse mb-2"
                style={{ background: "var(--border)", animationDelay: `${i * 80}ms` }}
              />
              <div
                className="w-full h-3 rounded animate-pulse mb-1"
                style={{ background: "var(--border)", animationDelay: `${i * 80 + 40}ms` }}
              />
              <div
                className="w-2/3 h-3 rounded animate-pulse"
                style={{ background: "var(--border)", animationDelay: `${i * 80 + 80}ms` }}
              />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

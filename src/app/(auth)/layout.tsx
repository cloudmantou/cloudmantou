export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-logo">☁️ CloudMantou</h1>
          <p className="auth-subtitle">博客会员平台</p>
        </div>
        {children}
      </div>
    </div>
  );
}

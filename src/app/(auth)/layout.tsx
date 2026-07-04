import { HomeBackdrop } from "@/components/home/HomeBackdrop";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="auth-page">
      <HomeBackdrop />
      <div className="auth-container">
        <div className="auth-header">
          <h1 className="auth-logo">🥟 馒头的博客</h1>
          <p className="auth-subtitle">个人技术博客</p>
        </div>
        {children}
      </div>
    </div>
  );
}
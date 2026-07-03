export default function MaintenancePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "var(--bg, #0b0c15)",
        color: "var(--text, #e8e6e3)",
        textAlign: "center",
      }}
    >
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>站点维护中</h1>
        <p style={{ color: "var(--text-secondary, #9ca3af)", lineHeight: 1.7 }}>
          CloudMantou 正在进行维护，请稍后再访问。
        </p>
      </div>
    </div>
  );
}
export default function AdminLoading() {
  return (
    <div className="admin-route-loading" aria-hidden="true">
      <div className="admin-route-loading-bar" />
      <div className="admin-route-loading-grid">
        <div className="admin-route-loading-card" />
        <div className="admin-route-loading-card" />
        <div className="admin-route-loading-card" />
        <div className="admin-route-loading-panel" />
      </div>
    </div>
  );
}
import "../styles/dashboard.css";

export default function StatusList({ rows }) {
  if (!rows || rows.length === 0) {
    return <div className="empty">No status data available.</div>;
  }

  return (
    <div className="status-list">
      {rows.map((r) => {
        const isOnline =
          typeof r.status === "string" && r.status.includes("Online");

        const initials = (r.full_name || "U")
          .split(" ")
          .map((name) => name[0])
          .slice(0, 2)
          .join("")
          .toUpperCase();

        return (
          <div key={r.user_id} className="status-row">
            <div className="status-user-block">
              <div className="status-avatar">{initials}</div>

              <div>
                <div className="status-name">{r.full_name}</div>
                <div className="status-subtext">User ID: {r.user_id}</div>
              </div>
            </div>

            <div className="status-pill">
              {isOnline && <span className="online-dot" />}
              {r.status}
            </div>
          </div>
        );
      })}
    </div>
  );
}
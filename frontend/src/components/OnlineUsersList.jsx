// src/components/OnlineUsersList.jsx

export default function OnlineUsersList({ rows = [] }) {
  const onlineRows = rows.filter(
    (row) =>
      typeof row.status === "string" &&
      row.status.toLowerCase().includes("online")
  );

  if (onlineRows.length === 0) {
    return <div className="empty">No users are currently online.</div>;
  }

  return (
    <div className="online-users-list">
      {onlineRows.slice(0, 5).map((row) => {
        const initials =
          `${row.first_name?.[0] || ""}${row.last_name?.[0] || ""}`.toUpperCase();

        return (
          <div key={row.user_id} className="online-user-card">
            <div className="online-user-left">
              {row.profile_pic ? (
                <img
                  className="online-user-avatar-img"
                  src={`http://127.0.0.1:5000/${row.profile_pic}?t=${Date.now()}`}
                  alt={`${row.first_name || ""} ${row.last_name || ""}`.trim()}
                />
              ) : (
                <div className="online-user-avatar">{initials || "U"}</div>
              )}

              <div className="online-user-info">
                <div className="online-user-name">
                  {row.first_name} {row.last_name}
                </div>
                <div className="online-user-role">{row.role || "user"}</div>
              </div>
            </div>

            <div className="online-user-status">
              <span className="online-status-dot"></span>
              <span>Online</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
import "../styles/dashboard.css";

function getStatusType(statusText) {
  const value = String(statusText || "").toLowerCase();

  if (value.includes("locked")) return "locked";
  if (value.includes("online")) return "online";
  return "offline";
}

function getReadableLastActive(row) {
  const statusType = getStatusType(row.status);

  if (statusType === "online") {
    return "Active now";
  }

  return row.last_active || row.last_seen || "Not available";
}

export default function StatusList({ rows = [], onRowClick }) {
  return (
    <div className="status-list-wrap">
      <table className="manage-users-table status-monitor-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Status</th>
            <th>Last Active</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan="4">
                <div className="empty-users-state">
                  <div className="empty-users-title">No user activity found</div>
                  <div className="empty-users-subtitle">
                    Status information will appear here once available.
                  </div>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const statusType = getStatusType(row.status);

              return (
                <tr
                  key={row.user_id || index}
                  className={`status-monitor-row ${
                    onRowClick ? "status-monitor-row-clickable" : ""
                  }`}
                  onClick={() => onRowClick?.(row)}
                  title={onRowClick ? "Open user account details" : undefined}
                >
                  <td>
                    <div className="user-identity">
                      {row.profile_pic ? (
                        <img
                          className="user-avatar-img"
                          src={`http://127.0.0.1:5000/${row.profile_pic}?t=${Date.now()}`}
                          alt={`${row.first_name || ""} ${row.last_name || ""}`}
                        />
                      ) : (
                        <div className="user-avatar">
                          {row.first_name?.[0] || "U"}
                          {row.last_name?.[0] || ""}
                        </div>
                      )}

                      <div className="user-info">
                        <div className="user-name">
                          {row.first_name || "Unknown"} {row.last_name || "User"}
                        </div>
                        <div className="user-email">
                          {row.email || `User ID: ${row.user_id ?? "—"}`}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td>
                    <span
                      className={`role-badge ${
                        row.role === "admin" || row.role === "super_admin"
                          ? "role-admin"
                          : row.role === "prosecutor"
                          ? "role-prosecutor"
                          : "role-staff"
                      }`}
                    >
                      {row.role || "Unknown"}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`live-status-badge ${
                        statusType === "online"
                          ? "status-online"
                          : statusType === "locked"
                          ? "status-locked"
                          : "status-offline"
                      }`}
                    >
                      <span className="live-status-dot"></span>
                      {statusType === "online"
                        ? "Online"
                        : statusType === "locked"
                        ? "Locked"
                        : "Offline"}
                    </span>
                  </td>

                  <td>{getReadableLastActive(row)}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
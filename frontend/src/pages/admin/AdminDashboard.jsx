import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiRefreshCw } from "react-icons/fi";

import api from "../../api";
import { logout } from "../../auth";

import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import StatCard from "../../components/StatCard";
import StatusList from "../../components/StatusList";

import "../../styles/dashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );

  const [users, setUsers] = useState([]);
  const [statusRows, setStatusRows] = useState([]);
  const [logs, setLogs] = useState([]);

  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    async function refreshUser() {
      try {
        const res = await api.get("/my-profile");
        localStorage.setItem("user", JSON.stringify(res.data));
        setUser(res.data);
      } catch (err) {
        console.error("Failed to refresh user profile", err);
      }
    }

    if (user.role !== "admin") {
      navigate("/unauthorized");
      return;
    }

    refreshUser();
    loadAll();

    const interval = setInterval(() => {
      loadAll();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  async function loadAll() {
    setLoading(true);

    try {
      const [usersRes, statusRes, logsRes] = await Promise.all([
        api.get("/admin/users"),
        api.get("/users-status"),
        api.get("/admin/action-logs"),
      ]);

      setUsers(usersRes.data);
      setStatusRows(statusRes.data);
      setLogs(logsRes.data);
    } catch (err) {
      console.error("Failed to load admin dashboard data", err);
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  function toggleSidebar() {
    setSidebarOpen(!sidebarOpen);
  }

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  const totalUsers = users.length;

  const onlineUsers = statusRows.filter(
    (u) => typeof u.status === "string" && u.status.includes("Online")
  ).length;

  const lockedUsers = users.filter((u) => u.status === "locked").length;
  const prosecutors = users.filter((u) => u.role === "prosecutor").length;

  const stats = [
    { title: "Total Users", value: totalUsers, icon: "👥" },
    { title: "Online Now", value: onlineUsers, icon: "🟢" },
    { title: "Locked Accounts", value: lockedUsers, icon: "🔒" },
    { title: "Prosecutors", value: prosecutors, icon: "⚖️" },
  ];

  const groupedLogs = logs.reduce((groups, log) => {
    const date = log.created_at ? new Date(log.created_at) : null;

    let label = "Unknown Date";

    if (date) {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      const dateOnly = date.toDateString();
      const todayOnly = today.toDateString();
      const yesterdayOnly = yesterday.toDateString();

      if (dateOnly === todayOnly) {
        label = "Today";
      } else if (dateOnly === yesterdayOnly) {
        label = "Yesterday";
      } else {
        label = date.toLocaleDateString();
      }
    }

    if (!groups[label]) {
      groups[label] = [];
    }

    groups[label].push(log);
    return groups;
  }, {});

  const todayString = new Date().toDateString();

  const logsToday = logs.filter((log) => {
    if (!log.created_at) return false;
    return new Date(log.created_at).toDateString() === todayString;
  });

  const actionsToday = logsToday.length;

  const usersCreatedToday = logsToday.filter(
    (log) => log.action === "CREATE_USER"
  ).length;

  const passwordsResetToday = logsToday.filter(
    (log) => log.action === "RESET_PASSWORD"
  ).length;

  const lockedToday = logsToday.filter(
    (log) => log.action === "LOCK_USER"
  ).length;

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        user={user}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main">
        <Topbar
          user={user}
          onLogout={handleLogout}
          onToggleSidebar={toggleSidebar}
        />

        <div className="content">
          <div className="welcome-block">
            <div className="page-badge">Administrator Portal</div>
            <h1>Welcome, Admin {user.first_name}!</h1>
            <p className="subtitle">
              Manage users, monitor system activity, and oversee administrative
              controls.
            </p>
          </div>

          <div className="action-grid">
            <div
              className="action-card action-users"
              onClick={() => navigate("/admin/users")}
            >
              <div className="action-icon">👥</div>
              <div className="action-title">Manage Users</div>
              <div className="action-desc">
                Create, update, lock, unlock, and reset user accounts.
              </div>
            </div>

            <div
              className="action-card action-monitor"
              onClick={() => navigate("/admin/user-status")}
            >
              <div className="action-icon">🟢</div>
              <div className="action-title">User Monitor</div>
              <div className="action-desc">
                View online users and last active status in real time.
              </div>
            </div>

            <div
              className="action-card action-profile"
              onClick={() => navigate("/my-profile")}
            >
              <div className="action-icon">👤</div>
              <div className="action-title">My Profile</div>
              <div className="action-desc">
                Update your profile details and upload your profile picture.
              </div>
            </div>
          </div>

          <div className="cards">
            {stats.map((s) => (
              <StatCard
                key={s.title}
                title={s.title}
                value={s.value}
                icon={s.icon}
              />
            ))}
          </div>

          <div className="panel admin-analytics-panel">
            <div className="panel-header">
              <h3>Admin Analytics Today</h3>
            </div>

            <div className="admin-analytics-grid">
              <div className="admin-analytic-box">
                <div className="admin-analytic-label">Actions Today</div>
                <div className="admin-analytic-value">{actionsToday}</div>
              </div>

              <div className="admin-analytic-box">
                <div className="admin-analytic-label">Users Created</div>
                <div className="admin-analytic-value">{usersCreatedToday}</div>
              </div>

              <div className="admin-analytic-box">
                <div className="admin-analytic-label">Passwords Reset</div>
                <div className="admin-analytic-value">{passwordsResetToday}</div>
              </div>

              <div className="admin-analytic-box">
                <div className="admin-analytic-label">Accounts Locked</div>
                <div className="admin-analytic-value">{lockedToday}</div>
              </div>
            </div>
          </div>

          <div className="admin-bottom-grid">
            <div className="panel monitor-panel">
              <div className="panel-header">
                <h3>User Activity Monitor</h3>
                <button
                  className="refresh-btn"
                  onClick={loadAll}
                  title="Refresh"
                >
                  <FiRefreshCw />
                </button>
              </div>

              <StatusList rows={statusRows.slice(0, 5)} />
            </div>

            <div className="admin-side-panels">
              <div className="panel admin-controls-panel">
                <div className="panel-header">
                  <h3>Administrative Controls</h3>
                </div>

                <div className="notes">
                  <ul>
                    <li>Create staff and prosecutor accounts</li>
                    <li>Lock and unlock user accounts</li>
                    <li>Reset passwords and force password change</li>
                    <li>Assign permissions to admin users</li>
                  </ul>
                </div>
              </div>

              <div className="panel system-notes-panel">
                <div className="panel-header">
                  <h3>Admin Action Logs</h3>
                </div>

                <div className="admin-logs-list">
                  {logs.length === 0 && (
                    <div className="admin-log-item">
                      <div className="admin-log-action">
                        No admin actions recorded yet.
                      </div>
                    </div>
                  )}

                  {Object.entries(groupedLogs).map(([groupLabel, groupItems]) => (
                    <div key={groupLabel} className="admin-log-group">
                      <div className="admin-log-group-title">{groupLabel}</div>

                      {groupItems.map((log) => (
                        <div key={log.log_id} className="admin-log-item">
                          <div
                            className={`admin-log-action action-${log.action?.toLowerCase()}`}
                          >
                            {String(log.action || "")
                              .replaceAll("_", " ")
                              .toUpperCase()}
                          </div>

                          <div className="admin-log-meta">
                            Admin: {log.admin_name}
                          </div>

                          {log.target_name && (
                            <div className="admin-log-meta">
                              Target: {log.target_name}
                            </div>
                          )}

                          {log.details && (
                            <div className="admin-log-meta">{log.details}</div>
                          )}

                          <div className="admin-log-time">
                            {log.created_at
                              ? new Date(log.created_at).toLocaleTimeString()
                              : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="footer">
            <span>Case Management System • DOJ Prototype</span>
          </div>
        </div>
      </div>
    </div>
  );
}
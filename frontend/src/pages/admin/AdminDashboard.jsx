  import { useEffect, useState } from "react";
  import { useNavigate } from "react-router-dom";
  import { FiRefreshCw } from "react-icons/fi";
  import { getAppSettings } from "../../utils/appSettings";

  import api from "../../api";
  import {
    getAdminUsers,
    getUsersStatus,
    getAdminActionLogs,
  } from "../../services/adminService";

  import AdminLayout from "../../components/AdminLayout";
  import StatCard from "../../components/StatCard";
  import OnlineUsersList from "../../components/OnlineUsersList";

  import "../../styles/dashboard.css";
  import { isAdminLevel, isSuperAdmin } from "../../utils/roles";
  import { getStoredUser, setStoredUser } from "../../utils/storage";

  export default function AdminDashboard() {
    const navigate = useNavigate();

    const [user, setUser] = useState(getStoredUser());

    const [users, setUsers] = useState([]);
    const [statusRows, setStatusRows] = useState([]);
    const [logs, setLogs] = useState([]);

    const [loading, setLoading] = useState(false);

    const adminLevel = isAdminLevel(user);
    const superAdmin = isSuperAdmin(user);

    useEffect(() => {
      async function init() {
        if (!user) {
          navigate("/");
          return;
        }

        try {
          const res = await api.get("/my-profile");
          setStoredUser(res.data);
          setUser(res.data);

          if (!isAdminLevel(res.data)) {
            navigate("/unauthorized");
            return;
          }

          await loadAll();
        } catch (err) {
          console.error("Failed to refresh user profile", err);
          navigate("/unauthorized");
        }
      }

      init();

      const interval = setInterval(() => {
        loadAll();
      }, 10000);

      return () => clearInterval(interval);
    }, []);

    async function loadAll() {
      setLoading(true);

      try {
        const [usersRes, statusRes, logsRes] = await Promise.all([
          getAdminUsers(),
          getUsersStatus(),
          getAdminActionLogs(),
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

    if (!user) {
      return <div style={{ padding: 20 }}>Redirecting...</div>;
    }

    if (!adminLevel) {
      return <div style={{ padding: 20 }}>Checking access...</div>;
    }

    const totalUsers = users.length;

    const onlineUsers = statusRows.filter(
      (u) => typeof u.status === "string" && u.status.includes("Online")
    ).length;

    const lockedUsers = users.filter((u) => u.status === "locked").length;
    const prosecutors = users.filter((u) => u.role === "prosecutor").length;
    const adminAccounts = users.filter(
      (u) => u.role === "admin" || u.role === "super_admin"
    ).length;

    const stats = [
      { title: "Total Users", value: totalUsers, icon: "👥" },
      { title: "Online Now", value: onlineUsers, icon: "🟢" },
      { title: "Locked Accounts", value: lockedUsers, icon: "🔒" },
      ...(superAdmin
        ? [{ title: "Admin Accounts", value: adminAccounts, icon: "🛡️" }]
        : [{ title: "Prosecutors", value: prosecutors, icon: "⚖️" }]),
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

    const onlineUserRows = statusRows
      .filter(
        (row) =>
          typeof row.status === "string" &&
          row.status.toLowerCase().includes("online")
      )
      .map((row) => {
        const matchedUser = users.find((u) => u.user_id === row.user_id);

        return {
          ...row,
          first_name: matchedUser?.first_name || row.first_name,
          last_name: matchedUser?.last_name || row.last_name,
          role: matchedUser?.role || row.role,
          profile_pic: matchedUser?.profile_pic || row.profile_pic,
        };
      });

      const appSettings = getAppSettings();
    return (
      <AdminLayout user={user}>
        <div className="welcome-block">
          <div className="page-badge">
            {superAdmin ? "Super Admin Portal" : "Administrator Portal"}
          </div>

          <h1>
            Welcome, {superAdmin ? "Super Admin" : "Admin"} {user.first_name}!
          </h1>

          <p className="subtitle">
            {superAdmin
              ? "Manage administrator access, review permission controls, and oversee system-wide account governance."
              : "Manage users, monitor system activity, and oversee administrative controls based on your assigned permissions."}
          </p>
        </div>

        <div className={`action-grid ${superAdmin ? "action-grid-superadmin" : ""}`}>
          <div
            className="action-card action-users"
            onClick={() => navigate("/admin/users")}
          >
            <div className="action-icon">👥</div>
            <div className="action-title">Manage Users</div>
            <div className="action-desc">
              {superAdmin
                ? "Create and oversee admin, prosecutor, and staff accounts across the system."
                : "Manage prosecutor and staff accounts based on your assigned permissions."}
            </div>
          </div>

          {superAdmin && (
    <div
      className="action-card action-users"
      onClick={() => navigate("/admin/permissions")}
    >
      <div className="action-icon">🛡️</div>
      <div className="action-title">Admin Permissions</div>
      <div className="action-desc">
        Assign, review, and govern permissions for administrator accounts.
      </div>
    </div>
  )}
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



        {appSettings.showActivityPanels && (
    <div className="admin-bottom-grid">
      <div className="panel monitor-panel">
        <div className="panel-header">
          <div>
            <h3>Online Users</h3>
            <p className="panel-subtitle">
              {superAdmin
                ? "Currently active accounts across the system."
                : "Currently active personnel accounts."}
            </p>
          </div>

          <button
            className={`refresh-btn ${loading ? "loading" : ""}`}
            onClick={loadAll}
            title="Refresh"
          >
            <FiRefreshCw />
          </button>
        </div>

        <OnlineUsersList rows={onlineUserRows} />
      </div>

      <div className="admin-side-panels">
        <div className="panel admin-analytics-panel">
          <div className="panel-header">
            <h3>{superAdmin ? "Activity Today" : "Admin Analytics Today"}</h3>
          </div>

          <div className="admin-analytics-grid side-analytics-grid">
            <div className="admin-analytic-box">
              <div className="admin-analytic-label">
                {superAdmin ? "Governance Actions" : "Actions Today"}
              </div>
              <div className="admin-analytic-value">{actionsToday}</div>
            </div>

            <div className="admin-analytic-box">
              <div className="admin-analytic-label">
                {superAdmin ? "Accounts Created" : "Users Created"}
              </div>
              <div className="admin-analytic-value">{usersCreatedToday}</div>
            </div>

            <div className="admin-analytic-box">
              <div className="admin-analytic-label">
                {superAdmin ? "Password Resets" : "Passwords Reset"}
              </div>
              <div className="admin-analytic-value">{passwordsResetToday}</div>
            </div>

            <div className="admin-analytic-box">
              <div className="admin-analytic-label">Accounts Locked</div>
              <div className="admin-analytic-value">{lockedToday}</div>
            </div>
          </div>
        </div>

        <div className="panel system-notes-panel">
          <div className="panel-header">
            <h3>{superAdmin ? "Administrative Audit Trail" : "Admin Action Logs"}</h3>
          </div>

          <div className="admin-logs-list">
            {logs.length === 0 && (
              <div className="admin-log-item">
                <div className="admin-log-action">
                  {superAdmin
                    ? "No governance actions recorded yet."
                    : "No admin actions recorded yet."}
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
  )}

        <div className="footer">
          <span>Case Management System • DOJ Prototype</span>
        </div>
      </AdminLayout>
    );
  }
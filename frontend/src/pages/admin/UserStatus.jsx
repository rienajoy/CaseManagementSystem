import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiRefreshCw } from "react-icons/fi";

import api from "../../api";
import { logout } from "../../auth";

import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import StatusList from "../../components/StatusList";

import "../../styles/dashboard.css";

export default function UserStatus() {
  const navigate = useNavigate();

  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    if (user.role !== "admin") {
      navigate("/unauthorized");
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

    refreshUser();
    load();

    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get("/users-status");
      setRows(res.data);
    } catch (err) {
      console.error("Failed to load user status", err);
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
            <div className="page-badge">Monitoring</div>
            <h1>User Activity Monitor</h1>
            <p className="subtitle">
              View account activity and online or last-seen status of registered
              users.
            </p>
          </div>

          <div className="panel monitor-panel">
            <div className="panel-header">
              <div>
                <h3>User Status Directory</h3>
                <p className="panel-subtitle">
                  Status refreshes automatically every 10 seconds.
                </p>
              </div>

              <button
                className="refresh-btn"
                onClick={load}
                title="Refresh"
              >
                <FiRefreshCw />
              </button>
            </div>

            <StatusList rows={rows} />
          </div>

          <div className="footer">
            <span>Case Management System • DOJ Prototype</span>
          </div>
        </div>
      </div>
    </div>
  );
}
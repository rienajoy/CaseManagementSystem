import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiRefreshCw } from "react-icons/fi";

import api from "../../api";

import AdminLayout from "../../components/AdminLayout";
import StatusList from "../../components/StatusList";

import "../../styles/dashboard.css";
import { isAdminLevel } from "../../utils/roles";
import { getStoredUser, setStoredUser } from "../../utils/storage";
import { getUsersStatus } from "../../services/adminService";

export default function UserStatus() {
  const navigate = useNavigate();

  const [user, setUser] = useState(getStoredUser());

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const adminLevel = isAdminLevel(user);

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

        await load();
      } catch (err) {
        console.error("Failed to refresh user profile", err);
        navigate("/unauthorized");
      }
    }

    init();

    const interval = setInterval(() => {
      load();
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  async function load() {
    setLoading(true);

    try {
      const res = await getUsersStatus();
      setRows(res.data);
    } catch (err) {
      console.error("Failed to load user status", err);
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

  return (
    <AdminLayout user={user}>
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
            className={`refresh-btn ${loading ? "loading" : ""}`}
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
    </AdminLayout>
  );
}
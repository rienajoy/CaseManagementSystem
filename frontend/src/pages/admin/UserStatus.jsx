import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiRefreshCw, FiArrowLeft } from "react-icons/fi";

import api from "../../api";

import AdminLayout from "../../components/AdminLayout";
import StatusList from "../../components/StatusList";

import "../../styles/dashboard.css";
import { isAdminLevel } from "../../utils/roles";
import { getStoredUser, setStoredUser } from "../../utils/storage";
import { getUsersStatus, getAdminUsers } from "../../services/adminService";

function getDerivedStatus(statusText) {
  const raw = String(statusText || "").toLowerCase();
  if (raw.includes("online")) return "online";
  if (raw.includes("locked")) return "locked";
  return "offline";
}

export default function UserStatus() {
  const navigate = useNavigate();

  const [user, setUser] = useState(getStoredUser());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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

  function showSuccess(message) {
    setMsg(message);
    setMsgType("success");
  }

  function showError(message) {
    setMsg(message);
    setMsgType("error");
  }

  async function load(showRefreshMessage = false) {
    setLoading(true);

    try {
      const [statusRes, usersRes] = await Promise.all([
        getUsersStatus(),
        getAdminUsers(),
      ]);

      const statusData = statusRes.data || [];
      const usersData = usersRes.data || [];

      const mergedRows = statusData.map((row) => {
        const matchedUser = usersData.find((u) => u.user_id === row.user_id);

        return {
          ...row,
          first_name: matchedUser?.first_name || row.first_name,
          last_name: matchedUser?.last_name || row.last_name,
          email: matchedUser?.email || row.email,
          role: matchedUser?.role || row.role,
          profile_pic: matchedUser?.profile_pic || row.profile_pic,
          account_status: matchedUser?.status || row.account_status,
        };
      });

      const sortedRows = [...mergedRows].sort((a, b) => {
        const priority = { online: 0, locked: 1, offline: 2 };
        return (
          priority[getDerivedStatus(a.status)] - priority[getDerivedStatus(b.status)]
        );
      });

      setRows(sortedRows);

      if (showRefreshMessage) {
        showSuccess("User status refreshed successfully.");
      }
    } catch (err) {
      console.error("Failed to load user status", err);
      showError(err?.response?.data?.message || "Failed to load user status");
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const text =
        `${row.first_name || ""} ${row.last_name || ""} ${row.email || ""} ${row.role || ""}`
          .toLowerCase();

      const matchesSearch = text.includes(search.toLowerCase());
      const derivedStatus = getDerivedStatus(row.status);

      const matchesStatus =
        statusFilter === "all" || derivedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const summary = useMemo(() => {
    const online = filteredRows.filter(
      (row) => getDerivedStatus(row.status) === "online"
    ).length;
    const locked = filteredRows.filter(
      (row) => getDerivedStatus(row.status) === "locked"
    ).length;
    const offline = filteredRows.filter(
      (row) => getDerivedStatus(row.status) === "offline"
    ).length;

    return {
      total: filteredRows.length,
      online,
      offline,
      locked,
    };
  }, [filteredRows]);

  function handleRowClick(row) {
    navigate("/admin/users", {
      state: {
        focusUserId: row.user_id,
      },
    });
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

      {msg && (
        <div
          className={`alert ${
            msgType === "success" ? "alert-success" : "alert-error"
          }`}
        >
          {msg}
        </div>
      )}

      <div className="panel monitor-panel">
        <div className="panel-header">
          <div>
            <h3>User Status Directory</h3>
            <p className="panel-subtitle">
              Status refreshes automatically every 10 seconds.
            </p>
          </div>

          <div className="manage-users-header-actions">
            <button
              type="button"
              className="btn btn-light admin-back-btn"
              onClick={() => navigate("/admin/dashboard")}
            >
              <FiArrowLeft />
              <span>Back</span>
            </button>

            <button
              className={`refresh-btn ${loading ? "loading" : ""}`}
              onClick={() => load(true)}
              title="Refresh"
            >
              <FiRefreshCw />
            </button>
          </div>
        </div>

        <div className="user-filters" style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search user name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="locked">Locked</option>
          </select>
        </div>

        <div className="status-summary-line">
          Showing {summary.total} {summary.total === 1 ? "user" : "users"} •{" "}
          {summary.online} online • {summary.offline} offline • {summary.locked} locked
        </div>

        <StatusList rows={filteredRows} onRowClick={handleRowClick} />
      </div>

      <div className="footer">
        <span>Case Management System • DOJ Prototype</span>
      </div>
    </AdminLayout>
  );
}
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../api";
import { logout } from "../../auth";

import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import { FiRefreshCw } from "react-icons/fi";
import { FiPlus } from "react-icons/fi";

import "../../styles/dashboard.css";

export default function AdminUsers() {
  const navigate = useNavigate();

  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );

  const [users, setUsers] = useState([]);
  const [availablePerms, setAvailablePerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusRows, setStatusRows] = useState([]);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
    role: "staff",
  });

useEffect(() => {
  loadAll();
  const interval = setInterval(loadAll, 10000);
  return () => clearInterval(interval);
}, []);


  async function loadAll() {
    setMsg("");
    setLoading(true);

    try {
      const [uRes, pRes, sRes] = await Promise.all([
  api.get("/admin/users"),
  api.get("/admin/permissions"),
  api.get("/users-status"),
]);

setUsers(uRes.data);
setAvailablePerms(pRes.data);
setStatusRows(sRes.data);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to load users/permissions");
    } finally {
      setLoading(false);
    }
  }

  async function createUser(e) {
    e.preventDefault();
    setMsg("");

    try {
      await api.post("/admin/users", form);

     setMsg("User account successfully created.");

      setForm({
        first_name: "",
        last_name: "",
        email: "",
        username: "",
        password: "",
        role: "staff",
      });

      setShowCreateForm(false);
      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to create user");
    }
  }

  async function lockUser(user_id) {
    setMsg("");

    try {
      await api.put(`/admin/users/${user_id}/lock`);
      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to lock user");
    }
  }

  async function unlockUser(user_id) {
    setMsg("");

    try {
      await api.put(`/admin/users/${user_id}/unlock`);
      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to unlock user");
    }
  }

  async function deleteUser(user_id) {
    setMsg("");

    if (!confirm("Delete this user?")) return;

    try {
      await api.delete(`/admin/users/${user_id}`);
      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to delete user");
    }
  }

  async function resetPassword(user_id) {
    const newPass = prompt("Enter new password:");
    if (!newPass) return;

    setMsg("");

    try {
      await api.put(`/admin/users/${user_id}/reset-password`, {
        password: newPass,
      });

      setMsg("Password reset ✅ (user must change on next login)");
      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to reset password");
    }
  }

  async function setPermissions(user_id) {
    const current = users.find((u) => u.user_id === user_id);
    const currentPerms = current?.permissions || [];

    const input = prompt(
      "Enter permissions comma-separated:\n" +
        availablePerms.join(", ") +
        "\n\nCurrent:\n" +
        currentPerms.join(", "),
      currentPerms.join(", ")
    );

    if (input === null) return;

    const perms = input
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    setMsg("");

    try {
      await api.put(`/admin/users/${user_id}/permissions`, {
        permissions: perms,
      });

      setMsg("Permissions updated ✅");
      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to update permissions");
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
function getLiveStatus(user) {
  if (user.status === "locked") return "locked";

  const statusEntry = statusRows.find((row) => row.user_id === user.user_id);
  const rawStatus = statusEntry?.status || "";

  if (typeof rawStatus === "string" && rawStatus.includes("Online")) {
    return "active";
  }

  return "offline";
}
 const filteredUsers = users.filter((u) => {
  const matchesSearch = `${u.first_name} ${u.last_name} ${u.email}`
    .toLowerCase()
    .includes(search.toLowerCase());

  const matchesRole = roleFilter === "all" || u.role === roleFilter;

  const liveStatus = getLiveStatus(u);
  const matchesStatus = statusFilter === "all" || liveStatus === statusFilter;

  return matchesSearch && matchesRole && matchesStatus;
});

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
          <div className="welcome-block manage-users-top">

  <div className="manage-users-header">

    <div className="manage-users-title">
      <h1>User Account Administration</h1>
      <p className="subtitle">
        Manage personnel accounts, access status, password resets, and user permissions for the Prosecutor’s Office system.
      </p>
    </div>

    <div className="manage-users-header-actions">

      <button
        type="button"
        className="create-user-split-btn"
        onClick={() => setShowCreateForm(!showCreateForm)}
      >
        <span className="create-user-text">Add New User Account</span>
        <span className="create-user-icon">+</span>
      </button>

      <button
        type="button"
        className={`refresh-icon-btn ${loading ? "loading" : ""}`}
        onClick={loadAll}
        title="Refresh"
      >
        <FiRefreshCw />
      </button>

    </div>

  </div>

</div>

          {msg && (
  <div className="alert alert-info">
    {msg}
  </div>
)}
          <div className="manage-users-grid">
            {showCreateForm && (
              <div className="panel create-user-panel">
                <div className="panel-header">
                  <div>
                    <h3>Create User Account</h3>
                    <p className="panel-subtitle">
                      Register a new staff or prosecutor account and assign an
                      initial temporary password.
                    </p>
                  </div>
                </div>

                <form onSubmit={createUser} className="manage-users-form">
                  <div className="form-grid">
                    <div className="form-field">
                      <label>First Name</label>
                      <input
                        placeholder="Enter first name"
                        value={form.first_name}
                        onChange={(e) =>
                          setForm({ ...form, first_name: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>Last Name</label>
                      <input
                        placeholder="Enter last name"
                        value={form.last_name}
                        onChange={(e) =>
                          setForm({ ...form, last_name: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>Email Address</label>
                      <input
                        placeholder="Enter official email address"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>Username</label>
                      <input
                        placeholder="Enter username"
                        value={form.username}
                        onChange={(e) =>
                          setForm({ ...form, username: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>Temporary Password</label>
                      <input
                        placeholder="Enter temporary password"
                        type="password"
                        value={form.password}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>Role</label>
                      <select
                        value={form.role}
                        onChange={(e) =>
                          setForm({ ...form, role: e.target.value })
                        }
                      >
                        <option value="staff">Staff</option>
                        <option value="prosecutor">Prosecutor</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-note-box">
                    Newly created users will use the temporary password on first
                    login. Password reset and permission assignment can be
                    managed after account creation.
                  </div>

                  <div className="manage-users-form-actions">
                    <button type="submit" className="btn">
                      Create User
                    </button>

                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => setShowCreateForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>

                <p className="manage-users-note">
                  Creating users requires your admin account to have permission{" "}
                  <b>USER_CREATE</b>.
                </p>
              </div>
            )}

            <div className="panel">
              <div className="panel-header user-list-header">
  <div>
    <h3>User Directory</h3>
    <p className="panel-subtitle">
      View and manage registered personnel accounts.
    </p>
    <div className="user-count-text">
      Showing {filteredUsers.length} {filteredUsers.length === 1 ? "user" : "users"}
    </div>
  </div>

                <div className="user-filters">
                  <input
                    type="text"
                    placeholder="Search name or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />

                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="staff">Staff</option>
                    <option value="prosecutor">Prosecutor</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="locked">Locked</option>
                    <option value="offline">Offline</option>
                  </select>
                </div>
              </div>

              <div className="manage-users-table-wrap">
                <table className="manage-users-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>User</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
  {filteredUsers.length === 0 ? (
    <tr>
      <td colSpan="7">
        <div className="empty-users-state">
          <div className="empty-users-title">No users found</div>
          <div className="empty-users-subtitle">
            Try adjusting the search text or filters.
          </div>
        </div>
      </td>
    </tr>
  ) : (
    filteredUsers.map((u) => {
      const currentUser = JSON.parse(
        localStorage.getItem("user") || "null"
      );
      const isSelf = currentUser?.id === u.user_id;
const isAdminAccount = u.role === "admin";
const canDelete = !isSelf && !isAdminAccount;
const liveStatus = getLiveStatus(u);

      return (
        <tr key={u.user_id}>
          <td>{u.user_id}</td>

          <td>
  <div className="user-identity">
    {u.profile_pic ? (
      <img
        className="user-avatar-img"
        src={`http://127.0.0.1:5000/${u.profile_pic}?t=${Date.now()}`}
        alt={`${u.first_name} ${u.last_name}`}
      />
    ) : (
      <div className="user-avatar">
        {u.first_name?.[0]}
        {u.last_name?.[0]}
      </div>
    )}

    <div className="user-info">
      <div className="user-name">
        {u.first_name} {u.last_name}
      </div>

      <div className="user-email">{u.email}</div>
    </div>
  </div>
</td>

          <td>{u.username}</td>

          <td>
            <span
              className={`role-badge ${
                u.role === "admin"
                  ? "role-admin"
                  : u.role === "prosecutor"
                  ? "role-prosecutor"
                  : "role-staff"
              }`}
            >
              {u.role}
            </span>
          </td>

<td>
  <span
    className={`status-badge ${
      liveStatus === "active"
        ? "status-online"
        : liveStatus === "locked"
        ? "status-locked"
        : "status-offline"
    }`}
  >
    <span
      className={`status-dot ${
        liveStatus === "active"
          ? "dot-online"
          : liveStatus === "locked"
          ? "dot-locked"
          : "dot-offline"
      }`}
    ></span>

    {liveStatus === "active"
      ? "Online"
      : liveStatus === "locked"
      ? "Locked"
      : "Offline"}
  </span>
</td>
         
          <td className="manage-users-actions">
            {!isSelf && !isAdminAccount &&
              (u.status === "locked" ? (
                <button
                  className="btn-unlock"
                  onClick={() => unlockUser(u.user_id)}
                >
                  Unlock
                </button>
              ) : (
                <button
                  className="btn-lock"
                  onClick={() => lockUser(u.user_id)}
                >
                  Lock
                </button>
              ))}

            {isAdminAccount && (
              <span className="protected-badge">Protected</span>
            )}

            <button
              className="btn-reset"
              onClick={() => resetPassword(u.user_id)}
            >
              Reset PW
            </button>

            <button
              className="btn-reset"
              onClick={() => setPermissions(u.user_id)}
            >
              Permissions
            </button>

            {canDelete && (
              <button
                className="btn-delete"
                onClick={() => deleteUser(u.user_id)}
              >
                Delete
              </button>
            )}
          </td>
        </tr>
      );
    })
  )}
</tbody>
                </table>
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
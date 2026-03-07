import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiRefreshCw,
  FiLock,
  FiUnlock,
  FiTrash2,
  FiEdit,
  FiKey,
} from "react-icons/fi";

import api from "../../api";
import {
  getAdminUsers,
  createAdminUser,
  lockAdminUser,
  unlockAdminUser,
  deleteAdminUser,
  resetAdminUserPassword,
  getAdminPermissions,
  updateAdminUserPermissions,
  getUsersStatus,
} from "../../services/adminService";

import AdminLayout from "../../components/AdminLayout";

import "../../styles/dashboard.css";
import { isAdminLevel, isSuperAdmin } from "../../utils/roles";
import { getStoredUser, setStoredUser } from "../../utils/storage";

export default function AdminUsers() {
  const navigate = useNavigate();

  const [user, setUser] = useState(getStoredUser());

  const [users, setUsers] = useState([]);
  const [availablePerms, setAvailablePerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [statusRows, setStatusRows] = useState([]);

  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEditUser, setSelectedEditUser] = useState(null);

  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [selectedResetUser, setSelectedResetUser] = useState(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteUser, setSelectedDeleteUser] = useState(null);

  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    role: "staff",
  });

  const [resetPasswordValue, setResetPasswordValue] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
    password: "",
    role: "staff",
  });

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

  function openEditModal(targetUser) {
    setSelectedEditUser(targetUser);
    setEditForm({
      first_name: targetUser.first_name || "",
      last_name: targetUser.last_name || "",
      email: targetUser.email || "",
      username: targetUser.username || "",
      role: targetUser.role || "staff",
    });
    setShowEditModal(true);
  }

  function closeEditModal() {
    setShowEditModal(false);
    setSelectedEditUser(null);
  }

  function openDeleteModal(targetUser) {
    setSelectedDeleteUser(targetUser);
    setShowDeleteModal(true);
  }

  function closeDeleteModal() {
    setShowDeleteModal(false);
    setSelectedDeleteUser(null);
  }

  function openResetPasswordModal(targetUser) {
    setShowEditModal(false);
    setSelectedEditUser(null);
    setSelectedResetUser(targetUser);
    setResetPasswordValue("");
    setShowResetPasswordModal(true);
  }

  function closeResetPasswordModal() {
    setShowResetPasswordModal(false);
    setSelectedResetUser(null);
    setResetPasswordValue("");
  }

  async function updateUserInfo(e) {
    e.preventDefault();

    if (!selectedEditUser) return;

    setMsg("");

    try {
      await api.put(`/admin/users/${selectedEditUser.user_id}`, editForm);
      setMsg("User account updated successfully.");
      closeEditModal();
      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to update user");
    }
  }

  async function submitPasswordResetFromModal(e) {
    e.preventDefault();

    if (!selectedResetUser || !resetPasswordValue.trim()) {
      setMsg("Please enter a new temporary password.");
      return;
    }

    setMsg("");

    try {
      await resetAdminUserPassword(selectedResetUser.user_id, {
        password: resetPasswordValue,
      });

      setMsg("Password reset successfully.");
      closeResetPasswordModal();
      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to reset password");
    }
  }

  async function loadAll() {
    setMsg("");
    setLoading(true);

    try {
      const [uRes, pRes, sRes] = await Promise.all([
        getAdminUsers(),
        getAdminPermissions(),
        getUsersStatus(),
      ]);

      setUsers(
        (uRes.data || []).map((u) => ({
          ...u,
          permissions: Array.isArray(u.permissions) ? u.permissions : [],
        }))
      );

      setAvailablePerms(pRes.data || []);
      setStatusRows(sRes.data || []);
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to load users/permissions");
    } finally {
      setLoading(false);
    }
  }

  async function createUser(e) {
    e.preventDefault();
    setMsg("");

    if (form.role === "admin" && !superAdmin) {
      setMsg("Only a super admin can create an admin account.");
      return;
    }

    try {
      await createAdminUser(form);

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
      await lockAdminUser(user_id);
      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to lock user");
    }
  }

  async function unlockUser(user_id) {
    setMsg("");

    try {
      await unlockAdminUser(user_id);
      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to unlock user");
    }
  }

  async function deleteUser() {
    if (!selectedDeleteUser) return;

    setMsg("");

    try {
      await deleteAdminUser(selectedDeleteUser.user_id);
      setMsg("User account deleted successfully.");
      closeDeleteModal();
      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to delete user");
    }
  }

  function openPermissionsModal(user_id) {
    const current = users.find((u) => u.user_id === user_id);
    const currentUser = getStoredUser();

    const isSelf = currentUser?.user_id === current?.user_id;
    const isRegularAdmin = current?.role === "admin";

    if (!superAdmin) {
      setMsg("Only a super admin can manage account permissions.");
      return;
    }

    if (isSelf) {
      setMsg("You cannot modify permissions for your own account.");
      return;
    }

    if (!isRegularAdmin) {
      setMsg("Permissions can only be managed for regular admin accounts.");
      return;
    }

    setSelectedUser(current || null);
    setSelectedPermissions(current?.permissions || []);
    setShowPermissionsModal(true);
  }

  function togglePermission(permission) {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  }

  async function savePermissions() {
    if (!selectedUser) return;

    setMsg("");

    try {
      await updateAdminUserPermissions(selectedUser.user_id, {
        permissions: selectedPermissions,
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.user_id === selectedUser.user_id
            ? { ...u, permissions: [...selectedPermissions] }
            : u
        )
      );

      setMsg("Permissions updated successfully.");
      setShowPermissionsModal(false);
      setSelectedUser(null);
      setSelectedPermissions([]);

      await loadAll();
    } catch (e) {
      setMsg(e?.response?.data?.message || "Failed to update permissions");
    }
  }

  function getLiveStatus(userRow) {
    if (userRow.status === "locked") return "locked";

    const statusEntry = statusRows.find((row) => row.user_id === userRow.user_id);
    const rawStatus = statusEntry?.status || "";

    if (typeof rawStatus === "string" && rawStatus.includes("Online")) {
      return "active";
    }

    return "offline";
  }

  function formatPermissionLabel(permission) {
    const labels = {
      USER_CREATE: "Create Users",
      USER_UPDATE: "Update Users",
      USER_DELETE: "Delete Users",
      USER_LOCK: "Lock Users",
      USER_UNLOCK: "Unlock Users",
      USER_RESET_PASSWORD: "Reset Passwords",
    };

    return labels[permission] || permission;
  }

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  if (!adminLevel) {
    return <div style={{ padding: 20 }}>Checking access...</div>;
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

  const totalUsers = users.length;
  const adminAccounts = users.filter(
    (u) => u.role === "admin" || u.role === "super_admin"
  ).length;
  const prosecutors = users.filter((u) => u.role === "prosecutor").length;
  const staffAccounts = users.filter((u) => u.role === "staff").length;
  const lockedAccounts = users.filter((u) => getLiveStatus(u) === "locked").length;

  return (
    <AdminLayout user={user}>
      <div className="welcome-block manage-users-top">
        <div className="manage-users-header">
          <div className="manage-users-title">
            <h1>
              {superAdmin
                ? "User and Access Administration"
                : "User Account Administration"}
            </h1>
            <p className="subtitle">
              {superAdmin
                ? "Oversee administrator, prosecutor, and staff accounts, including privileged access and permission governance."
                : "Manage personnel accounts, access status, password resets, and user permissions for the Prosecutor’s Office system."}
            </p>
          </div>

          <div className="manage-users-header-actions">
            <button
              type="button"
              className="create-user-split-btn"
              onClick={() => setShowCreateForm(!showCreateForm)}
            >
              <span className="create-user-text">
                {superAdmin ? "Add New Account" : "Add New User Account"}
              </span>
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

      <div className="admin-analytics-grid" style={{ marginBottom: 16 }}>
        <div className="admin-analytic-box">
          <div className="admin-analytic-label">Total Users</div>
          <div className="admin-analytic-value">{totalUsers}</div>
        </div>

        <div className="admin-analytic-box">
          <div className="admin-analytic-label">
            {superAdmin ? "Admin Accounts" : "Prosecutors"}
          </div>
          <div className="admin-analytic-value">
            {superAdmin ? adminAccounts : prosecutors}
          </div>
        </div>

        <div className="admin-analytic-box">
          <div className="admin-analytic-label">Staff Accounts</div>
          <div className="admin-analytic-value">{staffAccounts}</div>
        </div>

        <div className="admin-analytic-box">
          <div className="admin-analytic-label">Locked Accounts</div>
          <div className="admin-analytic-value">{lockedAccounts}</div>
        </div>
      </div>

      {msg && <div className="alert alert-info">{msg}</div>}

      <div className="manage-users-grid">
        {showCreateForm && (
          <div
            className="modal-overlay"
            onClick={() => setShowCreateForm(false)}
          >
            <div
              className="modal-card create-account-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCreateForm(false)}
                aria-label="Close form"
              >
                ×
              </button>

              <div className="create-account-modal-header">
                <div className="create-account-badge">
                  {superAdmin ? "Privileged Registration" : "User Registration"}
                </div>

                <h2>
                  {superAdmin ? "Register New Account" : "Register User Account"}
                </h2>

                <p className="create-account-subtitle">
                  {superAdmin
                    ? "Create an official administrator, prosecutor, or staff account and assign a temporary credential for first-time access."
                    : "Create an official staff or prosecutor account and assign a temporary credential for first-time access."}
                </p>
              </div>

              <form onSubmit={createUser} className="manage-users-form modal-form">
                <div className="form-grid">
                  <div className="form-field">
                    <label>First Name</label>
                    <input
                      placeholder="Enter given name"
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
                      placeholder="Enter surname"
                      value={form.last_name}
                      onChange={(e) =>
                        setForm({ ...form, last_name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label>Official Email Address</label>
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
                    <label>System Username</label>
                    <input
                      placeholder="Enter system username"
                      value={form.username}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label>Temporary Credential</label>
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
                    <label>Account Role</label>
                    <select
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value })
                      }
                    >
                      {superAdmin && <option value="admin">Admin</option>}
                      <option value="staff">Staff</option>
                      <option value="prosecutor">Prosecutor</option>
                    </select>
                  </div>
                </div>

                {superAdmin && form.role === "admin" && (
                  <div className="form-note-box form-note-warning">
                    Newly created administrator accounts should undergo permission
                    review immediately after registration to ensure appropriate
                    access control.
                  </div>
                )}

                {!superAdmin && (
                  <div className="form-note-box">
                    Newly registered users will use the temporary credential during
                    their first sign-in and will be required to update their password
                    before continuing.
                  </div>
                )}

                <div className="modal-form-footer">
                  <p className="manage-users-note">
                    Account registration is restricted to users with the{" "}
                    <b>USER_CREATE</b> permission.
                  </p>

                  <button type="submit" className="btn create-account-submit-btn">
                    Register Account
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel-header user-list-header">
            <div>
              <h3>{superAdmin ? "User and Access Directory" : "User Directory"}</h3>
              <p className="panel-subtitle">
                {superAdmin
                  ? "Review accounts, privileged roles, status, and access-related actions."
                  : "View and manage registered personnel accounts."}
              </p>
              <div className="user-count-text">
                Showing {filteredUsers.length}{" "}
                {filteredUsers.length === 1 ? "user" : "users"}
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
                {superAdmin && <option value="admin">Admin</option>}
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
                  <th>Permissions</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6">
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
                    const currentUser = getStoredUser();
const isSelf = currentUser?.user_id === u.user_id;
const isAdminAccount = u.role === "admin";
const isSuperAdminAccount = u.role === "super_admin";

// Only super admin accounts should be protected from destructive actions
const isProtectedAccount = isSuperAdminAccount;

// Super admin can manage regular admin accounts.
// Nobody should manage their own account.
const canLockOrUnlock = !isSelf && !isProtectedAccount;
const canDelete = !isSelf && !isProtectedAccount;

const canManagePermissions =
  superAdmin && isAdminAccount && !isSelf;

const liveStatus = getLiveStatus(u);
const isLocked = liveStatus === "locked";

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

                        <td>
                          <div className="username-block">
                            <span className="username-text">{u.username}</span>
                          </div>
                        </td>

                        <td>
                          <span
                            className={`role-badge ${
                              u.role === "admin" || u.role === "super_admin"
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
                          {u.role !== "admin" ? (
                            <span className="permissions-empty">Not applicable</span>
                          ) : u.permissions?.length ? (
                            <div className="permissions-list-cell compact-permissions">
                              {u.permissions.slice(0, 2).map((perm) => (
                                <span key={perm} className="permission-chip">
                                  {formatPermissionLabel(perm)}
                                </span>
                              ))}

                              {u.permissions.length > 2 && (
                                <span className="permission-chip permission-chip-more">
                                  +{u.permissions.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="permissions-empty">
                              No custom permissions
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="table-actions-row">
                           {canLockOrUnlock && (
  <button
    className={`icon-action-btn ${
      isLocked ? "icon-lock plain-icon-btn locked-state" : "icon-unlock plain-icon-btn unlocked-state"
    }`}
    onClick={() => (isLocked ? unlockUser(u.user_id) : lockUser(u.user_id))}
    title={isLocked ? "Locked account" : "Active account"}
  >
    {isLocked ? <FiLock /> : <FiUnlock />}
  </button>
)}

                            <div className="table-action-group compact-group">
                              <button
                                type="button"
                                className="table-action-btn compact-btn"
                                onClick={() => openEditModal(u)}
                                title="Edit account"
                              >
                                <FiEdit className="table-action-icon edit-action-icon" />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                className="table-action-btn compact-btn reset-btn"
                                onClick={() => openResetPasswordModal(u)}
                                title="Reset password"
                              >
                                <FiKey className="table-action-icon reset-action-icon" />
                                <span>Reset</span>
                              </button>

                              {canDelete && (
                                <button
                                  type="button"
                                  className="table-action-btn compact-btn delete-btn"
                                  onClick={() => openDeleteModal(u)}
                                  title="Delete account"
                                >
                                  <FiTrash2 className="table-action-icon delete-action-icon" />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </div>
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

      {showPermissionsModal && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowPermissionsModal(false);
            setSelectedUser(null);
            setSelectedPermissions([]);
          }}
        >
          <div
            className="modal-card permissions-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => {
                setShowPermissionsModal(false);
                setSelectedUser(null);
                setSelectedPermissions([]);
              }}
              aria-label="Close permissions modal"
            >
              ×
            </button>

            <div className="create-account-modal-header">
              <div className="create-account-badge">Access Control</div>
              <h2>Manage Permissions</h2>

              <p className="create-account-subtitle">
                {selectedUser ? (
                  <>
                    Review and update permissions for{" "}
                    <b>
                      {selectedUser.first_name} {selectedUser.last_name}
                    </b>.
                  </>
                ) : (
                  "Review and update account permissions."
                )}
              </p>
            </div>

            <div className="permissions-modal-body">
              <div className="permissions-user-meta">
                <div>
                  <span className="permissions-meta-label">User</span>
                  <div className="permissions-meta-value">
                    {selectedUser?.first_name} {selectedUser?.last_name}
                  </div>
                </div>

                <div>
                  <span className="permissions-meta-label">Role</span>
                  <div className="permissions-meta-value">
                    {selectedUser?.role || "—"}
                  </div>
                </div>

                <div>
                  <span className="permissions-meta-label">Selected</span>
                  <div className="permissions-meta-value">
                    {selectedPermissions.length} permission
                    {selectedPermissions.length !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>

              <div className="permissions-grid">
                {availablePerms.map((perm) => {
                  const checked = selectedPermissions.includes(perm);

                  return (
                    <label key={perm} className="permission-item">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePermission(perm)}
                      />
                      <span>{perm}</span>
                    </label>
                  );
                })}
              </div>

              {availablePerms.length === 0 && (
                <div className="empty">No permissions available.</div>
              )}

              <div className="modal-form-footer">
                <p className="manage-users-note">
                  Changes to account permissions should be reviewed carefully before
                  saving.
                </p>

                <div className="permissions-modal-actions">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={() => {
                      setShowPermissionsModal(false);
                      setSelectedUser(null);
                      setSelectedPermissions([]);
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn create-account-submit-btn"
                    onClick={savePermissions}
                  >
                    Save Permissions
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedEditUser && (
        <div className="modal-overlay" onClick={closeEditModal}>
          <div
            className="modal-card create-account-modal edit-user-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={closeEditModal}
              aria-label="Close edit modal"
            >
              ×
            </button>

            <div className="create-account-modal-header">
              <div className="create-account-badge">Account Management</div>
              <h2>Edit User Account</h2>
              <p className="create-account-subtitle">
                Review and update account information for{" "}
                <b>
                  {selectedEditUser.first_name} {selectedEditUser.last_name}
                </b>.
              </p>
            </div>

            <form onSubmit={updateUserInfo} className="manage-users-form modal-form">
              <div className="form-grid">
                <div className="form-field">
                  <label>First Name</label>
                  <input
                    value={editForm.first_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, first_name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Last Name</label>
                  <input
                    value={editForm.last_name}
                    onChange={(e) =>
                      setEditForm({ ...editForm, last_name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Official Email Address</label>
                  <input
                    value={editForm.email}
                    onChange={(e) =>
                      setEditForm({ ...editForm, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-field">
                  <label>System Username</label>
                  <input
                    value={editForm.username}
                    onChange={(e) =>
                      setEditForm({ ...editForm, username: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-field">
                  <label>Account Role</label>
                  <select
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm({ ...editForm, role: e.target.value })
                    }
                  >
                    {superAdmin && <option value="admin">Admin</option>}
                    <option value="staff">Staff</option>
                    <option value="prosecutor">Prosecutor</option>
                  </select>
                </div>
              </div>

              <div className="modal-form-footer">
                <p className="manage-users-note">
                  Update account information carefully before saving changes.
                </p>

                <button type="submit" className="btn create-account-submit-btn">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showResetPasswordModal && selectedResetUser && (
        <div className="modal-overlay" onClick={closeResetPasswordModal}>
          <div
            className="modal-card create-account-modal reset-password-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={closeResetPasswordModal}
              aria-label="Close reset password modal"
            >
              ×
            </button>

            <div className="create-account-modal-header">
              <div className="create-account-badge">Password Management</div>
              <h2>Reset User Password</h2>
              <p className="create-account-subtitle">
                Assign a new temporary password for{" "}
                <b>
                  {selectedResetUser.first_name} {selectedResetUser.last_name}
                </b>.
              </p>
            </div>

            <form
              onSubmit={submitPasswordResetFromModal}
              className="manage-users-form modal-form"
            >
              <div className="form-grid single-form-grid">
                <div className="form-field">
                  <label>New Temporary Password</label>
                  <input
                    type="password"
                    placeholder="Enter new temporary password"
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-form-footer">
                <p className="manage-users-note">
                  The user will be required to update their password on next sign-in.
                </p>

                <div className="permissions-modal-actions">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={closeResetPasswordModal}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="btn create-account-submit-btn">
                    Confirm Reset
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && selectedDeleteUser && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div
            className="modal-card create-account-modal delete-account-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={closeDeleteModal}
              aria-label="Close delete confirmation modal"
            >
              ×
            </button>

            <div className="create-account-modal-header">
              <div className="create-account-badge danger-badge">
                Account Deletion
              </div>

              <h2>Confirm Account Deletion</h2>

              <p className="create-account-subtitle">
                You are about to permanently remove the account of{" "}
                <b>
                  {selectedDeleteUser.first_name} {selectedDeleteUser.last_name}
                </b>.
              </p>
            </div>

            <div className="permissions-modal-body">
              <div className="form-note-box form-note-warning delete-warning-box">
                Please confirm that you want to proceed. This action will remove the
                selected user account from the system.
              </div>

              <div className="permissions-user-meta">
                <div>
                  <span className="permissions-meta-label">Full Name</span>
                  <div className="permissions-meta-value">
                    {selectedDeleteUser.first_name} {selectedDeleteUser.last_name}
                  </div>
                </div>

                <div>
                  <span className="permissions-meta-label">Username</span>
                  <div className="permissions-meta-value">
                    {selectedDeleteUser.username}
                  </div>
                </div>

                <div>
                  <span className="permissions-meta-label">Role</span>
                  <div className="permissions-meta-value">
                    {selectedDeleteUser.role}
                  </div>
                </div>
              </div>

              <div className="modal-form-footer">
                <p className="manage-users-note">
                  This action should only be performed when the account is no longer
                  required and has been reviewed by an authorized administrator.
                </p>

                <div className="permissions-modal-actions">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={closeDeleteModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="btn delete-confirm-btn"
                    onClick={deleteUser}
                  >
                    Confirm Deletion
                  </button>
                </div>
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
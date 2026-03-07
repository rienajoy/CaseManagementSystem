import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiShield, FiRefreshCw } from "react-icons/fi";

import api from "../../api";
import {
  getAdminUsers,
  getAdminPermissions,
  updateAdminUserPermissions,
} from "../../services/adminService";

import AdminLayout from "../../components/AdminLayout";
import "../../styles/dashboard.css";

import { isAdminLevel, isSuperAdmin } from "../../utils/roles";
import { getStoredUser, setStoredUser } from "../../utils/storage";

export default function AdminPermissions() {
  const navigate = useNavigate();

  const [user, setUser] = useState(getStoredUser());
  const [admins, setAdmins] = useState([]);
  const [availablePerms, setAvailablePerms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("");

  const [search, setSearch] = useState("");

  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);

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
  }, []);

  function showSuccess(message) {
    setMsg(message);
    setMsgType("success");
  }

  function showError(message) {
    setMsg(message);
    setMsgType("error");
  }

  async function loadAll() {
    setMsg("");
    setLoading(true);

    try {
      const [uRes, pRes] = await Promise.all([
        getAdminUsers(),
        getAdminPermissions(),
      ]);

      const onlyAdmins = (uRes.data || []).filter(
        (u) => u.role === "admin"
      );

      setAdmins(
        onlyAdmins.map((u) => ({
          ...u,
          permissions: Array.isArray(u.permissions) ? u.permissions : [],
        }))
      );

      setAvailablePerms(pRes.data || []);
    } catch (e) {
      showError(e?.response?.data?.message || "Failed to load admin permissions");
    } finally {
      setLoading(false);
    }
  }

  function openPermissionsModal(adminUser) {
    setSelectedAdmin(adminUser);
    setSelectedPermissions(adminUser?.permissions || []);
    setShowPermissionsModal(true);
  }

  function closePermissionsModal() {
    setShowPermissionsModal(false);
    setSelectedAdmin(null);
    setSelectedPermissions([]);
  }

  function togglePermission(permission) {
    setSelectedPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  }

  async function savePermissions() {
    if (!selectedAdmin) return;

    setMsg("");

    try {
      await updateAdminUserPermissions(selectedAdmin.user_id, {
        permissions: selectedPermissions,
      });

      showSuccess("Permissions updated successfully.");
      closePermissionsModal();
      await loadAll();
    } catch (e) {
      showError(e?.response?.data?.message || "Failed to update permissions");
    }
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

  if (!superAdmin) {
    return <div style={{ padding: 20 }}>Only super admin can access this page.</div>;
  }

  const filteredAdmins = admins.filter((u) => {
    const text = `${u.first_name} ${u.last_name} ${u.email} ${u.username}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const totalAdmins = admins.length;
  const adminsWithCustomPermissions = admins.filter(
    (u) => u.permissions && u.permissions.length > 0
  ).length;
  const adminsWithoutCustomPermissions = admins.filter(
    (u) => !u.permissions || u.permissions.length === 0
  ).length;

  return (
    <AdminLayout user={user}>
      <div className="welcome-block manage-users-top">
        <div className="manage-users-header">
          <div className="manage-users-title">
            <h1>Admin Permissions</h1>
            <p className="subtitle">
              Assign, review, and govern permissions for administrator accounts.
            </p>
          </div>

          <div className="manage-users-header-actions">
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
          <div className="admin-analytic-label">Total Admins</div>
          <div className="admin-analytic-value">{totalAdmins}</div>
        </div>

        <div className="admin-analytic-box">
          <div className="admin-analytic-label">With Custom Permissions</div>
          <div className="admin-analytic-value">{adminsWithCustomPermissions}</div>
        </div>

        <div className="admin-analytic-box">
          <div className="admin-analytic-label">Without Custom Permissions</div>
          <div className="admin-analytic-value">{adminsWithoutCustomPermissions}</div>
        </div>

        <div className="admin-analytic-box">
          <div className="admin-analytic-label">Available Permissions</div>
          <div className="admin-analytic-value">{availablePerms.length}</div>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msgType === "success" ? "alert-success" : "alert-error"}`}>
          {msg}
        </div>
      )}

      <div className="panel">
        <div className="panel-header user-list-header">
          <div>
            <h3>Administrator Permission Directory</h3>
            <p className="panel-subtitle">
              Review admin accounts and manage their assigned permissions.
            </p>
            <div className="user-count-text">
              Showing {filteredAdmins.length} {filteredAdmins.length === 1 ? "admin" : "admins"}
            </div>
          </div>

          <div className="user-filters">
            <input
              type="text"
              placeholder="Search admin name, email, or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="manage-users-table-wrap">
          <table className="manage-users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Administrator</th>
                <th>Username</th>
                <th>Permissions</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty-users-state">
                      <div className="empty-users-title">No admin accounts found</div>
                      <div className="empty-users-subtitle">
                        Try adjusting the search text.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((u) => (
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
                      {u.permissions?.length ? (
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
                        <span className="permissions-empty">No custom permissions</span>
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="table-action-btn compact-btn"
                        onClick={() => openPermissionsModal(u)}
                      >
                        <FiShield className="table-action-icon" />
                        <span>Manage</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPermissionsModal && selectedAdmin && (
        <div className="modal-overlay" onClick={closePermissionsModal}>
          <div
            className="modal-card permissions-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={closePermissionsModal}
              aria-label="Close permissions modal"
            >
              ×
            </button>

            <div className="create-account-modal-header">
              <div className="create-account-badge">Access Control</div>
              <h2>Manage Admin Permissions</h2>

              <p className="create-account-subtitle">
                Review and update permissions for{" "}
                <b>
                  {selectedAdmin.first_name} {selectedAdmin.last_name}
                </b>.
              </p>
            </div>

            <div className="permissions-modal-body">
              <div className="permissions-user-meta">
                <div>
                  <span className="permissions-meta-label">User</span>
                  <div className="permissions-meta-value">
                    {selectedAdmin.first_name} {selectedAdmin.last_name}
                  </div>
                </div>

                <div>
                  <span className="permissions-meta-label">Role</span>
                  <div className="permissions-meta-value">{selectedAdmin.role}</div>
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
                      <span>{formatPermissionLabel(perm)}</span>
                    </label>
                  );
                })}
              </div>

              {availablePerms.length === 0 && (
                <div className="empty">No permissions available.</div>
              )}

              <div className="modal-form-footer">
                <p className="manage-users-note">
                  Changes to account permissions should be reviewed carefully before saving.
                </p>

                <div className="permissions-modal-actions">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={closePermissionsModal}
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

      <div className="footer">
        <span>Case Management System • DOJ Prototype</span>
      </div>
    </AdminLayout>
  );
}
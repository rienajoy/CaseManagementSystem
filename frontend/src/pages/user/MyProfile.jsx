//src/pages/user/MyProfile.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getMyProfile,
  updateMyProfile,
  uploadMyProfilePicture,
} from "../../services/profileService.js";
import { getStoredUser, setStoredUser } from "../../utils/storage";
import UserLayout from "../../components/UserLayout";

import "../../styles/dashboard.css";

export default function MyProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(getStoredUser());
  const [profile, setProfile] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
  });

  const [showProfilePicModal, setShowProfilePicModal] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await getMyProfile();
      setProfile(res.data);

      setStoredUser(res.data);
      setUser(res.data);

      setForm({
        first_name: res.data.first_name || "",
        last_name: res.data.last_name || "",
        email: res.data.email || "",
        username: res.data.username || "",
      });
    } catch (e) {
      setErr("Failed to load profile");
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    try {
      await updateMyProfile(form);
      setMsg("Profile updated successfully.");
      await loadProfile();
    } catch (e) {
      setErr(e?.response?.data?.message || "Update failed");
    }
  }

  async function uploadProfilePic(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!file) {
      setErr("Please select an image first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      await uploadMyProfilePicture(formData);
      setMsg("Profile picture uploaded successfully.");
      await loadProfile();
      setPreview("");
      setFile(null);
      closeProfilePicModal();
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Upload failed");
    }
  }

  function getInitials() {
    return `${profile?.first_name?.[0] || ""}${profile?.last_name?.[0] || ""}`;
  }

  function openProfilePicModal() {
    setShowProfilePicModal(true);
  }

  function closeProfilePicModal() {
    setShowProfilePicModal(false);
    setPreview("");
    setFile(null);
  }

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  if (!profile) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <UserLayout user={user}>
      <div className="welcome-block manage-users-top">
        <div className="manage-users-header">
          <div className="manage-users-title">
            <h1>My Profile</h1>
            <p className="subtitle">
              Review and update your personal account information, profile
              picture, and account details.
            </p>
          </div>
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="manage-users-grid profile-page-grid">
        <div className="panel profile-overview-panel">
          <div className="profile-overview-card">
            <button
              type="button"
              className="profile-avatar-trigger"
              onClick={openProfilePicModal}
              title="Change profile picture"
            >
              <div className="profile-avatar-wrap">
                {profile?.profile_pic ? (
                  <img
                    src={`http://127.0.0.1:5000/${profile.profile_pic}?t=${Date.now()}`}
                    alt="Profile"
                    className="profile-avatar-large"
                  />
                ) : (
                  <div className="profile-avatar-fallback-large">
                    {getInitials()}
                  </div>
                )}
                <div className="profile-avatar-edit-badge">Change Photo</div>
              </div>
            </button>

            <div className="profile-overview-info">
              <div className="profile-role-badge">Account Profile</div>
              <h2>
                {profile.first_name} {profile.last_name}
              </h2>
              <p className="profile-overview-email">{profile.email}</p>

              <div className="profile-overview-meta">
                <div className="profile-meta-card">
                  <span className="profile-meta-label">Username</span>
                  <div className="profile-meta-value">{profile.username}</div>
                </div>

                <div className="profile-meta-card">
                  <span className="profile-meta-label">Role</span>
                  <div className="profile-meta-value">
                    {profile.role || "User"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel create-user-panel">
          <div className="panel-header">
            <div>
              <h3>Profile Information</h3>
              <p className="panel-subtitle">
                Review and update your official account details.
              </p>
            </div>
          </div>

          <form onSubmit={saveProfile} className="manage-users-form">
            <div className="form-grid">
              <div className="form-field">
                <label>Given Name</label>
                <input
                  placeholder="Enter your given name"
                  value={form.first_name}
                  onChange={(e) =>
                    setForm({ ...form, first_name: e.target.value })
                  }
                />
              </div>

              <div className="form-field">
                <label>Surname</label>
                <input
                  placeholder="Enter your surname"
                  value={form.last_name}
                  onChange={(e) =>
                    setForm({ ...form, last_name: e.target.value })
                  }
                />
              </div>

              <div className="form-field">
                <label>Official Email Address</label>
                <input
                  placeholder="Enter your official email address"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                />
              </div>

              <div className="form-field">
                <label>System Username</label>
                <input
                  placeholder="Enter your system username"
                  value={form.username}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="modal-form-footer">
              <p className="manage-users-note">
                Please ensure that all account information is accurate, current,
                and consistent with official records.
              </p>

              <button type="submit" className="btn create-account-submit-btn">
                Update Profile Information
              </button>
            </div>
          </form>
        </div>
      </div>

      {showProfilePicModal && (
        <div className="modal-overlay" onClick={closeProfilePicModal}>
          <div
            className="modal-card create-account-modal profile-picture-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close-btn"
              onClick={closeProfilePicModal}
              aria-label="Close profile picture modal"
            >
              ×
            </button>

            <div className="create-account-modal-header">
              <div className="create-account-badge">Profile Photo</div>
              <h2>Update Profile Picture</h2>
              <p className="create-account-subtitle">
                Upload a clear and professional image for your account profile.
              </p>
            </div>

            <form
              onSubmit={uploadProfilePic}
              className="manage-users-form modal-form"
            >
              <div className="profile-upload-modal-preview">
                {preview ? (
                  <img
                    src={preview}
                    alt="Preview"
                    className="profile-upload-preview"
                  />
                ) : profile?.profile_pic ? (
                  <img
                    src={`http://127.0.0.1:5000/${profile.profile_pic}?t=${Date.now()}`}
                    alt="Current profile"
                    className="profile-upload-preview"
                  />
                ) : (
                  <div className="profile-upload-empty">No image selected</div>
                )}
              </div>

              <div className="form-field">
                <label>Select Image File</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    setFile(selected || null);
                    if (selected) setPreview(URL.createObjectURL(selected));
                    else setPreview("");
                  }}
                />
              </div>

              <div className="form-note-box">
                Supported format: image files. Please upload a clear and professional
                profile photo for proper account identification.
              </div>

              <div className="modal-form-footer">
                <p className="manage-users-note">
                  Your profile image will be displayed across your account pages.
                </p>

                <div className="permissions-modal-actions">
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={closeProfilePicModal}
                  >
                    Cancel
                  </button>

                  <button type="submit" className="btn create-account-submit-btn">
                    Upload Picture
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="footer">
        <span>Case Management System • DOJ Prototype</span>
      </div>
    </UserLayout>
  );
}
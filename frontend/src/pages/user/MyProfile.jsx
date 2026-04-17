import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getMyProfile,
  updateMyProfile,
  uploadMyProfilePicture,
  changeMyPassword,
} from "../../services/profileService.js";

import { getStoredUser, setStoredUser } from "../../utils/storage";
import UserLayout from "../../components/UserLayout";
import "../../styles/user/my-profile.css";
import "../../styles/user/profile-password.css";

export default function MyProfile() {
  const navigate = useNavigate();
  const feedbackTimerRef = useRef(null);

  const [user, setUser] = useState(getStoredUser());
  const [profile, setProfile] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [showProfilePicModal, setShowProfilePicModal] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);

const [passwordForm, setPasswordForm] = useState({
  current_password: "",
  new_password: "",
  confirm_password: "",
});

const [showPassword, setShowPassword] = useState({
  current: false,
  next: false,
  confirm: false,
});

const [passwordLoading, setPasswordLoading] = useState(false);
  
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
  });

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, []);

  function showFeedback(message, type = "success") {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }

    setFeedbackModal({ message, type });

    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackModal(null);
      feedbackTimerRef.current = null;
    }, 5000);
  }

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
      showFeedback("Failed to load profile.", "error");
    }
  }

  async function saveProfile(e) {
    e.preventDefault();

    try {
      await updateMyProfile(form);
      await loadProfile();
      showFeedback("Profile updated successfully.", "success");
    } catch (e) {
      showFeedback(e?.response?.data?.message || "Update failed.", "error");
    }
  }

  async function uploadProfilePic(e) {
    e.preventDefault();

    if (!file) {
      showFeedback("Please select an image first.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      await uploadMyProfilePicture(formData);
      await loadProfile();
      setPreview("");
      setFile(null);
      closeProfilePicModal();
      showFeedback("Profile picture uploaded successfully.", "success");
    } catch (e) {
      showFeedback(e?.response?.data?.message || "Upload failed.", "error");
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

  const passwordRules = {
  hasUppercase: /[A-Z]/.test(passwordForm.new_password),
  hasNumber: /\d/.test(passwordForm.new_password),
  hasMinLength: passwordForm.new_password.length >= 8,
};

const passedCount = Object.values(passwordRules).filter(Boolean).length;

const passwordsMatch =
  passwordForm.confirm_password.length > 0 &&
  passwordForm.new_password === passwordForm.confirm_password;

function togglePassword(field) {
  setShowPassword((prev) => ({
    ...prev,
    [field]: !prev[field],
  }));
}

function handlePasswordChange(e) {
  const { name, value } = e.target;
  setPasswordForm((prev) => ({
    ...prev,
    [name]: value,
  }));
}

function clearPasswordForm() {
  setPasswordForm({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
}

function getStrengthLabel() {
  if (!passwordForm.new_password) {
    return "Create a strong password for better account security.";
  }
  if (passedCount === 1) {
    return "Weak password. Must contain:";
  }
  if (passedCount === 2) {
    return "Moderate password. Almost there:";
  }
  return "Strong password.";
}

async function handleChangePassword(e) {
  e.preventDefault();

  if (!passwordsMatch) {
    showFeedback("New password and confirmation do not match.", "error");
    return;
  }

  if (passedCount < 3) {
    showFeedback("Please complete the password requirements first.", "error");
    return;
  }

  setPasswordLoading(true);

  try {
    await changeMyPassword({
      old_password: passwordForm.current_password,
      new_password: passwordForm.new_password,
    });

    clearPasswordForm();
    setShowPasswordModal(false);
    showFeedback("Password updated successfully.", "success");
  } catch (e) {
    showFeedback(
      e?.response?.data?.message || "Failed to update password.",
      "error"
    );
  } finally {
    setPasswordLoading(false);
  }
}

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  if (!profile) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
      <UserLayout
        user={user}
        sectionBadge="INTAKE CASES"
        pageTitle="My Profile"
        pageSubtitle=" Review and update your personal account information, profile
              picture, and account details."
      >
      <div className="welcome-block manage-users-top">
        <div className="manage-users-header">

        </div>
      </div>

      <div className="manage-users-grid profile-page-grid">
        <div className="panel profile-overview-panel">
          <div className="profile-overview-card">
<div className="profile-left">
  <button
    type="button"
    className="profile-avatar-trigger"
    onClick={openProfilePicModal}
  >
    <div className="profile-avatar-wrap">
      {profile?.profile_pic ? (
        <img
          src={`http://127.0.0.1:5000/${profile.profile_pic}`}
          alt="Profile"
          className="profile-avatar-large"
        />
      ) : (
        <div className="profile-avatar-fallback-large">
          {getInitials()}
        </div>
      )}

      <div className="profile-avatar-edit-badge">
        Change Photo
      </div>
    </div>
  </button>

  {/* ✅ IBUTANG DIRI */}
  <div className="profile-avatar-role">
    {profile.role || "User"}
  </div>
</div>
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

        <div className="panel create-user-panel profile-info-panel">
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
                <label>Username</label>
                <input
                  placeholder="Enter your username"
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

  <div className="profile-action-row">
    <button
      type="button"
      className="profile-secondary-btn"
      onClick={() => setShowPasswordModal(true)}
    >
      Change Password
    </button>

    <button type="submit" className="btn create-account-submit-btn">
      Update Profile Information
    </button>
  </div>
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
                    src={`http://127.0.0.1:5000/${user.profile_pic}`}
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

                    if (selected) {
                      setPreview(URL.createObjectURL(selected));
                    } else {
                      setPreview("");
                    }
                  }}
                />
              </div>

              <div className="form-note-box">
                Supported format: image files. Please upload a clear and
                professional profile photo for proper account identification.
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

      {feedbackModal && (
        <div className="feedback-modal-overlay">
          <div className={`feedback-modal-card ${feedbackModal.type}`}>
            <button
              type="button"
              className="feedback-modal-close"
              onClick={() => setFeedbackModal(null)}
              aria-label="Close notification"
            >
              ×
            </button>

            <div className="feedback-modal-icon-wrap">
              <div className={`feedback-modal-icon ${feedbackModal.type}`}>
                {feedbackModal.type === "success" ? "✓" : "!"}
              </div>
            </div>

            <div className="feedback-modal-body">
              <h3 className="feedback-modal-title">
                {feedbackModal.type === "success" ? "Success" : "Error"}
              </h3>
              <p className="feedback-modal-message">
                {feedbackModal.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
  <div
    className="modal-overlay profile-password-modal-overlay"
    onClick={() => setShowPasswordModal(false)}
  >
    <div
      className="modal-card profile-password-modal-card"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="modal-close-btn"
        onClick={() => setShowPasswordModal(false)}
        aria-label="Close change password modal"
      >
        ×
      </button>

      <div className="profile-password-title-wrap">
        <div className="profile-password-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path
              d="M7 10V7a5 5 0 0 1 10 0v3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <rect
              x="4"
              y="10"
              width="16"
              height="10"
              rx="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div>
          <h3>Change Password</h3>
          <p className="panel-subtitle">
            Update your password for enhanced account security.
          </p>
        </div>
      </div>

      <form onSubmit={handleChangePassword} className="profile-password-form">
        <div className="profile-password-field">
          <label>
            Current Password<span>*</span>
          </label>
          <div className="profile-password-input-wrap">
            <input
              type={showPassword.current ? "text" : "password"}
              name="current_password"
              value={passwordForm.current_password}
              onChange={handlePasswordChange}
              placeholder="Enter current password"
              required
            />
            <button
              type="button"
              className="profile-password-toggle-btn"
              onClick={() => togglePassword("current")}
              aria-label="Toggle current password visibility"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path
                  d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>

        <div className="profile-password-field">
          <label>
            New Password<span>*</span>
          </label>
          <div className="profile-password-input-wrap">
            <input
              type={showPassword.next ? "text" : "password"}
              name="new_password"
              value={passwordForm.new_password}
              onChange={handlePasswordChange}
              placeholder="Enter new password"
              required
            />
            <button
              type="button"
              className="profile-password-toggle-btn"
              onClick={() => togglePassword("next")}
              aria-label="Toggle new password visibility"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path
                  d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </div>

        <div className="profile-password-field">
          <div className="profile-password-label-row">
            <label>
              Confirm New Password<span>*</span>
            </label>
            <button
              type="button"
              className="profile-password-clear-btn"
              onClick={clearPasswordForm}
            >
              Clear
            </button>
          </div>

          <div className="profile-password-input-wrap">
            <input
              type={showPassword.confirm ? "text" : "password"}
              name="confirm_password"
              value={passwordForm.confirm_password}
              onChange={handlePasswordChange}
              placeholder="Confirm new password"
              required
            />
            <button
              type="button"
              className="profile-password-toggle-btn"
              onClick={() => togglePassword("confirm")}
              aria-label="Toggle confirm password visibility"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path
                  d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>

          {passwordForm.confirm_password && !passwordsMatch && (
            <p className="profile-password-match-error">
              New password and confirmation do not match.
            </p>
          )}
        </div>

        <div className="profile-password-strength-wrap">
          <div className="profile-password-strength-bars">
            <span className={`profile-strength-bar ${passedCount >= 1 ? "active weak" : ""}`}></span>
            <span className={`profile-strength-bar ${passedCount >= 2 ? "active medium" : ""}`}></span>
            <span className={`profile-strength-bar ${passedCount >= 3 ? "active strong" : ""}`}></span>
          </div>

          <p className="profile-password-strength-text">{getStrengthLabel()}</p>

          <ul className="profile-password-rules">
            <li className={passwordRules.hasUppercase ? "valid" : ""}>
              At least 1 uppercase
            </li>
            <li className={passwordRules.hasNumber ? "valid" : ""}>
              At least 1 number
            </li>
            <li className={passwordRules.hasMinLength ? "valid" : ""}>
              At least 8 characters
            </li>
          </ul>
        </div>

        <div className="profile-password-actions">
          <button
            type="button"
            className="profile-password-discard-btn"
            onClick={() => {
              clearPasswordForm();
              setShowPasswordModal(false);
            }}
          >
            Discard
          </button>

          <button
            type="submit"
            className="profile-password-submit-btn"
            disabled={passwordLoading}
          >
            {passwordLoading ? "Applying..." : "Apply Changes"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
    </UserLayout>
  );
}
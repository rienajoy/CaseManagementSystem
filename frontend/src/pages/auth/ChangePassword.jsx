import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  changeMyPassword,
  getMyProfile,
} from "../../services/profileService.js";
import { setStoredUser } from "../../utils/storage";
import "../../styles/auth/change-password.css";

export default function ChangePassword() {
  const navigate = useNavigate();
  const feedbackTimerRef = useRef(null);

  const [old_password, setOldPassword] = useState("");
  const [new_password, setNewPassword] = useState("");
  const [confirm_password, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState(null);

  const [showPassword, setShowPassword] = useState({
    old: false,
    next: false,
    confirm: false,
  });

  const passwordRules = {
    hasUppercase: /[A-Z]/.test(new_password),
    hasNumber: /\d/.test(new_password),
    hasMinLength: new_password.length >= 8,
  };

  const passedCount = Object.values(passwordRules).filter(Boolean).length;
  const passwordsMatch =
    confirm_password.length > 0 && new_password === confirm_password;

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

  function togglePassword(field) {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  }

  function getStrengthLabel() {
    if (!new_password) return "Create a strong password for your account security.";
    if (passedCount === 1) return "Weak password. Must contain:";
    if (passedCount === 2) return "Moderate password. Almost complete:";
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

    setLoading(true);

    try {
      await changeMyPassword({ old_password, new_password });

      const prof = await getMyProfile();
      setStoredUser(prof.data);

      showFeedback("Password updated successfully.", "success");

      setTimeout(() => {
        navigate("/dashboard");
      }, 1200);
    } catch (e2) {
      showFeedback(
        e2?.response?.data?.message || "Failed to change password.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="first-login-password-page">
      <div className="first-login-password-card">
        <div className="first-login-password-header">
          <div className="first-login-password-icon">
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
            <h1>Change Password</h1>
            <p>
              For security purposes, you need to change your temporary password
              before continuing to your account.
            </p>
          </div>
        </div>

        <div className="first-login-password-divider" />

        <form
          onSubmit={handleChangePassword}
          className="first-login-password-form"
        >
          <div className="password-field">
            <label>
              Temporary Password<span>*</span>
            </label>
            <div className="password-input-wrap">
              <input
                type={showPassword.old ? "text" : "password"}
                placeholder="Enter temporary password"
                value={old_password}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => togglePassword("old")}
                aria-label="Toggle temporary password visibility"
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

          <div className="password-field">
            <label>
              New Password<span>*</span>
            </label>
            <div className="password-input-wrap">
              <input
                type={showPassword.next ? "text" : "password"}
                placeholder="Enter new password"
                value={new_password}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
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

          <div className="password-field">
            <label>
              Confirm New Password<span>*</span>
            </label>
            <div className="password-input-wrap">
              <input
                type={showPassword.confirm ? "text" : "password"}
                placeholder="Confirm new password"
                value={confirm_password}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
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

            {confirm_password && !passwordsMatch && (
              <p className="password-match-error">
                New password and confirmation do not match.
              </p>
            )}
          </div>

          <div className="password-strength-wrap">
            <div className="password-strength-bars">
              <span className={`strength-bar ${passedCount >= 1 ? "active weak" : ""}`}></span>
              <span className={`strength-bar ${passedCount >= 2 ? "active medium" : ""}`}></span>
              <span className={`strength-bar ${passedCount >= 3 ? "active strong" : ""}`}></span>
            </div>

            <p className="password-strength-text">{getStrengthLabel()}</p>

            <ul className="password-rules">
              <li className={passwordRules.hasUppercase ? "valid" : ""}>
                At least 1 uppercase letter
              </li>
              <li className={passwordRules.hasNumber ? "valid" : ""}>
                At least 1 number
              </li>
              <li className={passwordRules.hasMinLength ? "valid" : ""}>
                At least 8 characters
              </li>
            </ul>
          </div>

          <button type="submit" className="btn-apply-password" disabled={loading}>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>

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
              <p className="feedback-modal-message">{feedbackModal.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
//src/pages/user/Dashboard.jsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../api";

import UserLayout from "../../components/UserLayout";

import "../../styles/dashboard.css";
import { isAdminLevel, isProsecutor, isStaff } from "../../utils/roles";
import { getStoredUser, setStoredUser } from "../../utils/storage";
import { getAppSettings } from "../../utils/appSettings";

export default function Dashboard() {
  const navigate = useNavigate();

  const [user, setUser] = useState(getStoredUser());

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

        if (isAdminLevel(res.data)) {
          navigate("/admin/dashboard");
        }
        if (isStaff(res.data)) {
      navigate("/staff/dashboard");
      return;
    }
      } catch (err) {
        console.error("Failed to refresh user profile", err);
      }
    }

    init();
  }, []);

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting to login...</div>;
  }

  if (isAdminLevel(user)) {
    return <div style={{ padding: 20 }}>Redirecting to admin dashboard...</div>;
  }
  

  const quickActions = [
    { label: "My Profile", onClick: () => navigate("/my-profile") },
  ];

  const appSettings = getAppSettings();

  return (
    <UserLayout user={user}>
      <div className="welcome">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitle">
            Welcome, {user.first_name} {user.last_name}. Here&apos;s your system
            overview.
          </p>
        </div>

        <div className="quick-actions">
          {quickActions.map((a) => (
            <button key={a.label} className="btn" onClick={a.onClick}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid">
        {isProsecutor(user) && (
          <>
            <div className="panel">
              <div className="panel-header">
                <h3>Prosecutor Dashboard</h3>
              </div>
              <div className="empty">
                Coming next: Assigned cases, pending resolutions, and case
                activity.
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Work Overview</h3>
              </div>
              <div className="notes">
                <ul>
                  <li>View assigned cases</li>
                  <li>Track pending resolutions</li>
                  <li>Review uploaded case documents</li>
                </ul>
              </div>
            </div>
          </>
        )}

        {isStaff(user) && (
          <>
            <div className="panel">
              <div className="panel-header">
                <h3>Staff / Clerk Dashboard</h3>
              </div>
              <div className="empty">
                Coming next: Digitize old case workflow and document uploads.
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Work Overview</h3>
              </div>
              <div className="notes">
                <ul>
                  <li>Digitize legacy case folders</li>
                  <li>Upload affidavits, resolutions, and orders</li>
                  <li>Prepare documents for OCR and metadata extraction</li>
                </ul>
              </div>
            </div>
          </>
        )}

        <div className="panel">
          <div className="panel-header">
            <h3>System Notes</h3>
          </div>
          <div className="notes">
            <ul>
              <li>Authentication + role protection are active.</li>
              <li>Password reset forces change on next login.</li>
              <li>Profile picture upload is enabled.</li>
              <li>Next major module: Case Management workflow.</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="footer">
        <span>Case Management System • DOJ Prototype</span>
      </div>
    </UserLayout>
  );
}
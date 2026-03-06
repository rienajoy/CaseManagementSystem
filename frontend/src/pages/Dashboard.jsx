import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../auth";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";


import "../styles/dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
const [user, setUser] = useState(
  JSON.parse(localStorage.getItem("user") || "null")
);
  const isAdmin = user?.role === "admin";
  const isProsecutor = user?.role === "prosecutor";
  const isStaff = user?.role === "staff";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
      
    async function refreshUser() {
  try {
    const res = await fetch("http://127.0.0.1:5000/my-profile", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!res.ok) return;

    const data = await res.json();
    localStorage.setItem("user", JSON.stringify(data));
    setUser(data);
  } catch (err) {
    console.error("Failed to refresh user profile", err);
  }
  refreshUser();
}
    }

    // ✅ admins should use the dedicated admin dashboard
    if (isSuperAdmin) {
      navigate("/admin/dashboard");
    }
  }, [user, isAdmin, navigate]);

  function handleLogout() {
    logout();
    navigate("/");
  }
  function toggleSidebar() {
  setSidebarOpen(!sidebarOpen);
}

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting to login...</div>;
  }

  if (isAdmin) {
    return <div style={{ padding: 20 }}>Redirecting to admin dashboard...</div>;
  }

  const quickActions = [
    { label: "My Profile", onClick: () => navigate("/my-profile") },
  ];

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
          <div className="welcome">
            <div>
              <h1>Dashboard</h1>
              <p className="subtitle">
                Welcome, {user.first_name} {user.last_name}. Here’s your system overview.
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
            {isProsecutor && (
              <>
                <div className="panel">
                  <div className="panel-header">
                    <h3>Prosecutor Dashboard</h3>
                  </div>
                  <div className="empty">
                    Coming next: Assigned cases, pending resolutions, and case activity.
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

            {isStaff && (
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
        </div>
      </div>
    </div>
  );
}
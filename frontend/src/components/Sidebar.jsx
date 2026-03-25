// src/components/Sidebar.jsx

import { useNavigate, useLocation } from "react-router-dom";
import {
  FaTachometerAlt,
  FaFolderOpen,
  FaBalanceScale,
  FaUser,
} from "react-icons/fa";
import { FaAnglesLeft } from "react-icons/fa6";

import "../styles/layout/sidebar.css";

export default function Sidebar({
  user,
  isOpen,
  mobileOpen,
  onToggle,
  onCloseMobile,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role;

  const itemsByRole = {
    admin: [
      { label: "Dashboard", path: "/admin/dashboard", icon: <FaTachometerAlt /> },
      { label: "Manage Users", path: "/admin/users", icon: <FaFolderOpen /> },
      { label: "User Monitor", path: "/admin/user-status", icon: <FaFolderOpen /> },
      { label: "My Profile", path: "/my-profile", icon: <FaUser /> },
    ],
    prosecutor: [
      { label: "Dashboard", path: "/dashboard", icon: <FaTachometerAlt /> },
      { label: "My Profile", path: "/my-profile", icon: <FaUser /> },
    ],
    staff: [
      { label: "Dashboard", path: "/staff/dashboard", icon: <FaTachometerAlt /> },
      { label: "Intake Cases", path: "/staff/intake-cases", icon: <FaFolderOpen /> },
      { label: "Official Cases", path: "/staff/cases", icon: <FaBalanceScale /> },
      { label: "My Profile", path: "/my-profile", icon: <FaUser /> },
    ],
  };

  const items = itemsByRole[role] || [
    { label: "Dashboard", path: "/dashboard", icon: <FaTachometerAlt /> },
    { label: "My Profile", path: "/my-profile", icon: <FaUser /> },
  ];

  function isActive(path) {
    return location.pathname === path;
  }

  function handleNavigate(path) {
    navigate(path);
    if (window.innerWidth <= 1000 && onCloseMobile) {
      onCloseMobile();
    }
  }

  return (
    <aside
      className={`sidebar ${
        isOpen ? "sidebar-expanded" : "sidebar-hidden-desktop"
      } ${mobileOpen ? "sidebar-mobile-open" : ""}`}
    >
      <div className="sidebar-top-row">
        <div className="sidebar-office-header">
          <div className="sidebar-doj-logo-wrap">
            <img src="/doj-seal.jpg" alt="DOJ Logo" className="sidebar-doj-logo" />
          </div>

          <div className="sidebar-office-text">
            <div className="sidebar-office-main">
              DEPARTMENT OF JUSTICE
            </div>
            <div className="sidebar-office-sub">
              PROSECUTOR’S OFFICE
            </div>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={onToggle}
          aria-label="Close sidebar"
          title="Close sidebar"
        >
          <FaAnglesLeft />
        </button>
      </div>

      <div className="sidebar-header-card">
        <div className="sidebar-header-avatar">
          {user?.profile_pic ? (
            <img
              src={`http://127.0.0.1:5000/${user.profile_pic}?t=${Date.now()}`}
              alt="Profile"
              className="sidebar-profile-img"
            />
          ) : (
            <span>{user?.first_name?.[0] || "U"}</span>
          )}
        </div>

        <div className="sidebar-header-name">
          {user?.first_name} {user?.last_name}
        </div>

        <div className="sidebar-header-subtext">
          {user?.email || user?.role}
        </div>
      </div>

      <nav className="nav">
        {items.map((it) => (
          <button
            key={it.path}
            className={`nav-item ${isActive(it.path) ? "nav-item-active" : ""}`}
            onClick={() => handleNavigate(it.path)}
          >
            
            <span className="nav-label">{it.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="small-muted">© {new Date().getFullYear()}</div>
      </div>
    </aside>
  );
}
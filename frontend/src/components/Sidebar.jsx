import { useNavigate, useLocation } from "react-router-dom";
import {
  FaHome,
  FaFolderOpen,
  FaBalanceScale,
  FaUser,
  FaSignOutAlt,
  FaArchive,
} from "react-icons/fa";
import { FaAnglesLeft, FaAnglesRight } from "react-icons/fa6";

import "../styles/layout/sidebar.css";

export default function Sidebar({
  user,
  isOpen,
  mobileOpen,
  onToggle,
  onCloseMobile,
  onLogout,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role;

  const itemsByRole = {
    admin: [
      { label: "Home", path: "/admin/dashboard", icon: <FaHome /> },
      { label: "Manage Users", path: "/admin/users", icon: <FaFolderOpen /> },
      { label: "User Monitor", path: "/admin/user-status", icon: <FaFolderOpen /> },
      { label: "Legacy Cases", path: "/admin/legacy-cases", icon: <FaArchive /> },
      { label: "My Profile", path: "/my-profile", icon: <FaUser /> },
    ],
    prosecutor: [
      { label: "Home", path: "/dashboard", icon: <FaHome /> },
      { label: "Legacy Cases", path: "/legacy-cases", icon: <FaArchive /> },
      { label: "My Profile", path: "/my-profile", icon: <FaUser /> },
    ],
    staff: [
      { label: "Dashboard", path: "/staff/dashboard", icon: <FaHome /> },
      { label: "Intake Cases", path: "/staff/intake-cases", icon: <FaFolderOpen /> },
      { label: "Official Cases", path: "/staff/cases", icon: <FaBalanceScale /> },
      { label: "Legacy Cases", path: "/staff/legacy-cases", icon: <FaArchive /> },
      { label: "My Profile", path: "/my-profile", icon: <FaUser /> },
    ],
  };

  const items = itemsByRole[role] || [
    { label: "Home", path: "/dashboard", icon: <FaHome /> },
    { label: "Legacy Cases", path: "/legacy-cases", icon: <FaArchive /> },
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

  function handleLogoutClick() {
    if (onLogout) onLogout();
  }

  const userInitial =
    user?.first_name?.[0]?.toUpperCase() ||
    user?.last_name?.[0]?.toUpperCase() ||
    "U";

  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim() ||
    "User";

  const roleLabel =
    typeof user?.role === "string" && user.role.trim()
      ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
      : "Account";

  return (
    <aside
      className={`sidebar ${isOpen ? "sidebar-expanded" : "sidebar-collapsed"} ${
        mobileOpen ? "sidebar-mobile-open" : ""
      }`}
    >
      {!isOpen && (
        <button
          type="button"
          className="sidebar-expand-floating-btn"
          onClick={onToggle}
          aria-label="Expand sidebar"
          title="Expand sidebar"
        >
          <FaAnglesRight />
        </button>
      )}

      
        <div className="sidebar-top">
          <div className="sidebar-top-row">
            <div className="sidebar-brand">
              <div className="sidebar-office-header">
                <img
                  src="/doj-seal.jpg"
                  alt="DOJ Logo"
                  className="sidebar-doj-logo"
                />
              </div>

              {isOpen && (
                <div className="sidebar-office-text">
                  <div className="sidebar-office-main">DEPARTMENT OF JUSTICE</div>
                  <div className="sidebar-office-sub">PROSECUTOR’S OFFICE</div>
                </div>
              )}
            </div>

            {isOpen && (
              <button
                type="button"
                className="sidebar-collapse-btn"
                onClick={onToggle}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
              >
                <FaAnglesLeft />
              </button>
            )}
          </div>
                <div className="sidebar-header-card">
        <div className="sidebar-header-avatar">
          {user?.profile_pic ? (
            <img
              src={`http://127.0.0.1:5000/${user.profile_pic}`}
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


        </div>

        <nav className="nav">

          {items.map((it) => (
            <button
              key={it.path}
              type="button"
              className={`nav-item ${isActive(it.path) ? "nav-item-active" : ""}`}
              onClick={() => handleNavigate(it.path)}
              title={!isOpen ? it.label : ""}
            >
              <span className="nav-icon">{it.icon}</span>
              {isOpen && <span className="nav-label">{it.label}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          {isOpen && (
            <div className="sidebar-footer-meta">
              Secure staff workspace
            </div>
          )}

          <button
            type="button"
            className="sidebar-footer-btn sidebar-footer-btn-logout"
            onClick={handleLogoutClick}
            title="Log Out"
          >
            <span className="sidebar-footer-icon">
              <FaSignOutAlt />
            </span>
            {isOpen && <span>Log Out</span>}
          </button>
        </div>
      
    </aside>
  );
}
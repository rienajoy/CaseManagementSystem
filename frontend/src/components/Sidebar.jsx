import { useNavigate, useLocation } from "react-router-dom";
import "../styles/dashboard.css";

import { FaTachometerAlt, FaUsers, FaUser } from "react-icons/fa";
import { MdMonitor } from "react-icons/md";
import { FaBalanceScale } from "react-icons/fa";    

export default function Sidebar({ user, open, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role;

  const itemsByRole = {
    admin: [
    { label: "Dashboard", path: "/admin/dashboard", icon: <FaTachometerAlt /> },
    { label: "Manage Users", path: "/admin/users", icon: <FaUsers /> },
    { label: "User Monitor", path: "/admin/user-status", icon: <MdMonitor /> },
    { label: "My Profile", path: "/my-profile", icon: <FaUser /> },
    ],
        prosecutor: [
      { label: "Dashboard", path: "/dashboard", icon: <FaTachometerAlt /> },
      { label: "My Profile", path: "/my-profile", icon: <FaUser /> },
    ],
    staff: [
      { label: "Dashboard", path: "/dashboard", icon: <FaTachometerAlt /> },
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

  return (
<aside className={`sidebar ${open ? "sidebar-open" : "sidebar-hidden"}`}>  
   <div className="sidebar-header-card">
  <div className="sidebar-office-title">
  <span className="sidebar-office-icon">
    <FaBalanceScale />
  </span>
  <span>PROVINCIAL PROSECUTOR'S OFFICE</span>
</div>

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
      onClick={() => {
        navigate(it.path);
        if (onClose) onClose();
      }}
    >
      <span className="nav-icon">{it.icon}</span>
      <span>{it.label}</span>
    </button>
  ))}
</nav>

      <div className="sidebar-footer">
        <div className="small-muted">© {new Date().getFullYear()}</div>
      </div>
    </aside>
  );
}
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

export default function Topbar({ user, onLogout, onToggleSidebar }) {
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  const profilePic = user?.profile_pic
    ? `http://127.0.0.1:5000/${user.profile_pic}?t=${Date.now()}`
    : null;

  useEffect(() => {
    function handleClickOutside(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="sidebar-toggle" onClick={onToggleSidebar}>
          ☰
        </button>

        <img className="topbar-seal" src="/doj-seal.jpg" alt="DOJ Seal" />

        <div className="topbar-brand">
          <div className="topbar-title">DOJ Case Management System</div>
          <div className="topbar-subtitle">Authorized Personnel Portal</div>
        </div>
      </div>

      <div className="topbar-right" ref={menuRef}>
        <button className="user-chip" onClick={() => setOpen((s) => !s)}>
          {profilePic ? (
            <img className="user-pic" src={profilePic} alt="Profile" />
          ) : (
            <div className="user-pic-fallback">
              {user?.first_name?.[0] || "U"}
            </div>
          )}

          <div className="user-meta">
            <div className="user-name">
              {user?.first_name} {user?.last_name}
            </div>
            <div className="user-role">{user?.role}</div>
          </div>

          <div className="user-caret">▾</div>
        </button>

        {open && (
          <div className="dropdown">
            <button
              className="dropdown-item"
              onClick={() => navigate("/my-profile")}
            >
              My Profile
            </button>

            <button className="dropdown-item danger" onClick={onLogout}>
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
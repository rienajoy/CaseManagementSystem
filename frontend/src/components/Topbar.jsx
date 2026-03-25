import { useEffect, useRef, useState } from "react";
import { FaChevronDown, FaRegBell } from "react-icons/fa";
import { IoNotificationsOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import "../styles/layout/topbar.css";

export default function Topbar({ user, onLogout, onToggleSidebar }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const firstName = user?.first_name || "User";
  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
  const emailLabel = user?.email || "No email";

  function toggleDropdown() {
    setOpen((prev) => !prev);
  }

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!dropdownRef.current) return;
      if (!dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  return (

    
    <header className="topbar topbar-modern">
      <div className="topbar-left-wrap">

        <div className="topbar-left">
            
            <div className="staff-dashboard-hero-left">
              <div className="page-badge">STAFF DASHBOARD</div>
            </div>



          <div className="topbar-greeting-block">
            <div className="topbar-greeting-title">Welcome, {firstName}!</div>
            <div className="topbar-greeting-subtitle">
              Ready to manage case records today?
            </div>
          </div>
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-actions">
         <button
          type="button"
          className="topbar-circle-btn"
          aria-label="Notifications"
          title="Notifications"
        >
          <IoNotificationsOutline />
        </button>
        </div>

        <div className="topbar-user-area" ref={dropdownRef}>
          <button type="button" className="user-chip" onClick={toggleDropdown}>
            {user?.profile_pic ? (
              <img
                className="user-pic"
                src={`http://127.0.0.1:5000/${user.profile_pic}`}
                alt={fullName || "User"}
              />
            ) : (
              <div className="user-pic-fallback">
                {user?.first_name?.[0] || "U"}
              </div>
            )}

            <div className="user-meta">
              <span className="user-name">{fullName || "User"}</span>
              <span className="user-email">{emailLabel}</span>
            </div>

            <span className="user-caret">
              <FaChevronDown />
            </span>
          </button>

          {open && (
            <div className="dropdown">
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setOpen(false);
                  navigate("/my-profile");
                }}
              >
                My Profile
              </button>

              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setOpen(false);
                  navigate("/settings");
                }}
              >
                Settings
              </button>

              <button
                type="button"
                className="dropdown-item danger"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
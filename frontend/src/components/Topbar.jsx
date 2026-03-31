import { useEffect, useRef, useState } from "react";
import { FaChevronDown } from "react-icons/fa";
import { IoNotificationsOutline, IoSearchOutline } from "react-icons/io5";
import { SlidersHorizontal, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/layout/topbar.css";

export default function Topbar({
  user,
  onLogout,
  onToggleSidebar,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterContent,
  sectionBadge = "STAFF DASHBOARD",
  pageTitle,
  pageSubtitle,
}) {
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const dropdownRef = useRef(null);
  const filterRef = useRef(null);
  const navigate = useNavigate();

  const firstName = user?.first_name || "User";
  const fullName = `${user?.first_name || ""} ${user?.last_name || ""}`.trim();
  const emailLabel = user?.email || "No email";

  const displayTitle = pageTitle || `Welcome, ${firstName}!`;
  const displaySubtitle =
    pageSubtitle || "Ready to manage case records today?";

  function toggleDropdown() {
    setOpen((prev) => !prev);
  }

  function toggleFilter() {
    setFilterOpen((prev) => !prev);
  }

  useEffect(() => {
    function handleOutsideClick(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }

      if (filterRef.current && !filterRef.current.contains(event.target)) {
        const clickedFilterBtn = event.target.closest(".topbar-filter-btn");
        if (!clickedFilterBtn) {
          setFilterOpen(false);
        }
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  return (
    <>
      <header className="topbar topbar-modern">
        <div className="topbar-left-wrap">
          <div className="topbar-left">
            <div className="topbar-greeting-block">


              <div className="topbar-greeting-title">{displayTitle}</div>
              <div className="topbar-greeting-subtitle">{displaySubtitle}</div>
            </div>
          </div>
        </div>

        <div className="topbar-right">

          {filterContent ? (
            <button
              type="button"
              className={`topbar-circle-btn topbar-filter-btn ${
                filterOpen ? "is-active" : ""
              }`}
              aria-label="Filter"
              title="Filter"
              onClick={toggleFilter}
            >
              {filterOpen ? <X size={18} /> : <SlidersHorizontal size={18} />}
            </button>
          ) : null}

        <div className="topbar-actions">
  <button
    type="button"
    className="topbar-circle-btn premium-notif-btn"
    aria-label="Notifications"
    title="Notifications"
  >
    <IoNotificationsOutline className="notif-icon" />
    <span className="notif-badge"></span>
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

      {filterOpen && filterContent ? (
        <div className="topbar-filter-drawer-wrap" ref={filterRef}>
          <div className="topbar-filter-drawer">
            <div className="topbar-filter-notch" />
            {filterContent}
          </div>
        </div>
      ) : null}
    </>
  );
}
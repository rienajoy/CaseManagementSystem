// src/components/UserLayout.jsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { logout } from "../auth";

import "../styles/layout/app-shell.css";

export default function UserLayout({ user, children }) {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1000);

  function handleLogout() {
    logout();
    navigate("/");
  }

  function toggleSidebar() {
    if (window.innerWidth <= 1000) {
      setMobileSidebarOpen((prev) => !prev);
      return;
    }

    setSidebarOpen((prev) => !prev);
  }

  function closeMobileSidebar() {
    setMobileSidebarOpen(false);
  }

  useEffect(() => {
    function handleResize() {
      const desktop = window.innerWidth > 1000;
      setIsDesktop(desktop);

      if (!desktop) {
        setSidebarOpen(true);
      } else {
        setMobileSidebarOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="app-shell">
      {mobileSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeMobileSidebar} />
      )}

      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        mobileOpen={mobileSidebarOpen}
        onToggle={toggleSidebar}
        onCloseMobile={closeMobileSidebar}
      />

      {!sidebarOpen && isDesktop && (
        <button
          type="button"
          className="sidebar-docked-open-btn"
          onClick={toggleSidebar}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          »
        </button>
      )}

      <div className={`main ${!sidebarOpen && isDesktop ? "main-sidebar-closed" : ""}`}>
        <Topbar user={user} onLogout={handleLogout} />
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
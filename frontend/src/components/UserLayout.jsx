import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { logout } from "../auth";

import "../styles/layout/app-shell.css";

export default function UserLayout({
  user,
  children,
  sectionBadge,
  pageTitle,
  pageSubtitle,
  onGlobalSearchChange,
  globalSearchPlaceholder,
  topbarFilterContent,
}) {
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
        setMobileSidebarOpen(false);
      }
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      className={`app-shell ${
        isDesktop
          ? sidebarOpen
            ? "app-shell-sidebar-open"
            : "app-shell-sidebar-closed"
          : "app-shell-mobile"
      }`}
    >
      {mobileSidebarOpen && (
        <div className="sidebar-overlay" onClick={closeMobileSidebar} />
      )}

      <Sidebar
        user={user}
        isOpen={sidebarOpen}
        mobileOpen={mobileSidebarOpen}
        onToggle={toggleSidebar}
        onCloseMobile={closeMobileSidebar}
        onLogout={handleLogout}
      />

      {!mobileSidebarOpen && !isDesktop && (
        <button
          type="button"
          className="sidebar-mobile-open-btn"
          onClick={toggleSidebar}
          aria-label="Open sidebar"
          title="Open sidebar"
        >
          »
        </button>
      )}

      <div className="main">
        <Topbar
          user={user}
          onLogout={handleLogout}
          onToggleSidebar={toggleSidebar}
          sectionBadge={sectionBadge}
          pageTitle={pageTitle}
          pageSubtitle={pageSubtitle}
          onSearchChange={onGlobalSearchChange}
          searchPlaceholder={globalSearchPlaceholder}
          filterContent={topbarFilterContent}
        />

        <main className="content">{children}</main>
         <footer className="app-footer">
    Case Management System • DOJ Prototype
  </footer>
      </div>
    </div>
  );
}
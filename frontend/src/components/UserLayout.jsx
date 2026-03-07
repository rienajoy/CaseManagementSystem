// src/components/UserLayout.jsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { logout } from "../auth";
import { getAppSettings } from "../utils/appSettings";

export default function UserLayout({ user, children }) {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/");
  }

  function toggleSidebar() {
    setSidebarOpen((prev) => !prev);
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  useEffect(() => {
    function syncSettings() {
      const settings = getAppSettings();
      const isMobile = window.innerWidth <= 1000;

      if (isMobile) {
        setSidebarOpen(settings.sidebarDefault === "expanded");
      } else {
        setSidebarOpen(false);
      }
    }

    syncSettings();

    window.addEventListener("resize", syncSettings);
    window.addEventListener("app-settings-changed", syncSettings);

    return () => {
      window.removeEventListener("resize", syncSettings);
      window.removeEventListener("app-settings-changed", syncSettings);
    };
  }, []);

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      <Sidebar user={user} open={sidebarOpen} onClose={closeSidebar} />

      <div className="main">
        <Topbar
          user={user}
          onLogout={handleLogout}
          onToggleSidebar={toggleSidebar}
        />

        <div className="content">{children}</div>
      </div>
    </div>
  );
}
// src/pages/user/Settings.jsx

import { useState } from "react";
import UserLayout from "../../components/UserLayout";
import { getStoredUser } from "../../utils/storage";
import {
  getAppSettings,
  saveAppSettings,
  getDefaultAppSettings,
} from "../../utils/appSettings";

import "../../styles/dashboard.css";

export default function Settings() {
  const user = getStoredUser();

  const [settings, setSettings] = useState(getAppSettings());
  const [msg, setMsg] = useState("");
  const [showProfilePicModal, setShowProfilePicModal] = useState(false);


  function openProfilePicModal() {
  setShowProfilePicModal(true);
}

function closeProfilePicModal() {
  setShowProfilePicModal(false);
  setPreview("");
  setFile(null);
}

  function handleChange(key, value) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleCheckboxChange(key) {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

function handleSave(e) {
  e.preventDefault();
  saveAppSettings(settings);
  setMsg("Settings saved successfully.");
}

function handleReset() {
  const defaults = getDefaultAppSettings();
  setSettings(defaults);
  saveAppSettings(defaults);
  setMsg("Settings reset to defaults.");
}

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  return (
    <UserLayout user={user}>
      <div className="welcome-block">
        <div className="page-badge">Preferences</div>
        <h1>Settings</h1>
        <p className="subtitle">
          Manage your application preferences and basic display options.
        </p>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      <div className="manage-users-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Appearance</h3>
              <p className="panel-subtitle">
                Choose how the application should look.
              </p>
            </div>
          </div>

          <form className="manage-users-form" onSubmit={handleSave}>
            <div className="form-field">
              <label>Theme</label>
              <select
                value={settings.theme}
                onChange={(e) => handleChange("theme", e.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System Default</option>
              </select>
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Navigation</h3>
              <p className="panel-subtitle">
                Adjust how the sidebar behaves when you open the app.
              </p>
            </div>
          </div>

          <div className="manage-users-form">
            <div className="form-field">
              <label>Sidebar Default State</label>
              <select
                value={settings.sidebarDefault}
                onChange={(e) =>
                  handleChange("sidebarDefault", e.target.value)
                }
              >
                <option value="expanded">Expanded</option>
                <option value="collapsed">Collapsed</option>
              </select>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Dashboard</h3>
              <p className="panel-subtitle">
                Control simple dashboard visibility preferences.
              </p>
            </div>
          </div>

          <div className="manage-users-form">
            <label className="settings-check-row">
              <input
                type="checkbox"
                checked={settings.showDashboardHints}
                onChange={() => handleCheckboxChange("showDashboardHints")}
              />
              <span>Show dashboard helper notes</span>
            </label>

            <label className="settings-check-row">
              <input
                type="checkbox"
                checked={settings.showActivityPanels}
                onChange={() => handleCheckboxChange("showActivityPanels")}
              />
              <span>Show activity panels</span>
            </label>
          </div>
        </div>
      </div>

      <div className="manage-users-form-actions" style={{ marginTop: 18 }}>
        <button className="btn" onClick={handleSave}>
          Save Settings
        </button>

        <button
          type="button"
          className="btn btn-light"
          onClick={handleReset}
        >
          Reset to Default
        </button>
      </div>

      <div className="footer">
        <span>Case Management System • DOJ Prototype</span>
      </div>
    </UserLayout>
  );
}
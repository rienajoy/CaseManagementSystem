import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../api";
import { logout } from "../auth";

import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

import "../styles/dashboard.css";

export default function MyProfile() {
  const navigate = useNavigate();

  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("user") || "null")
  );

  const [profile, setProfile] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: "",
  });

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const res = await api.get("/my-profile");
      setProfile(res.data);

      localStorage.setItem("user", JSON.stringify(res.data));
      setUser(res.data);

      setForm({
        first_name: res.data.first_name || "",
        last_name: res.data.last_name || "",
        email: res.data.email || "",
        username: res.data.username || "",
      });
    } catch (e) {
      setErr("Failed to load profile");
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    try {
      await api.put("/update-profile", form);
      setMsg("Profile updated ✅");
      await loadProfile();
    } catch (e) {
      setErr(e?.response?.data?.message || "Update failed");
    }
  }

  async function uploadProfilePic(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!file) {
      setErr("Please select an image first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      await api.post("/upload-profile-pic", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMsg("Profile picture uploaded ✅");
      await loadProfile();
      setPreview("");
      setFile(null);
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Upload failed");
    }
  }

  function handleLogout() {
    logout();
    navigate("/");
  }

  function toggleSidebar() {
    setSidebarOpen(!sidebarOpen);
  }

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  if (!profile) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        user={user}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main">
        <Topbar
          user={user}
          onLogout={handleLogout}
          onToggleSidebar={toggleSidebar}
        />

        <div className="content">
          <div className="welcome-block">
            <div className="page-badge">Account</div>
            <h1>My Profile</h1>
            <p className="subtitle">
              Update your personal account information and profile picture.
            </p>
          </div>

          {msg && (
  <div className="alert alert-success">
    {msg}
  </div>
)}

{err && (
  <div className="alert alert-error">
    {err}
  </div>
)}

          <div className="manage-users-grid">
            <div className="panel create-user-panel">
              <div className="panel-header">
                <div>
                  <h3>Profile Information</h3>
                  <p className="panel-subtitle">
                    Review and update your personal account details.
                  </p>
                </div>
              </div>

              <div style={{ marginTop: 12, marginBottom: 18 }}>
                {profile?.profile_pic ? (
                  <img
                    src={`http://127.0.0.1:5000/${profile.profile_pic}?t=${Date.now()}`}
                    alt="Profile"
                    width="120"
                    height="120"
                    style={{
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "3px solid #f4d27a",
                      boxShadow: "0 0 0 4px rgba(244, 210, 122, 0.18)",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "#eef2ff",
                      color: "#3730a3",
                      fontWeight: 800,
                      fontSize: 32,
                      border: "3px solid #f4d27a",
                    }}
                  >
                    {profile.first_name?.[0]}
                    {profile.last_name?.[0]}
                  </div>
                )}
              </div>

              <form onSubmit={saveProfile} className="manage-users-form">
                <div className="form-grid">
                  <div className="form-field">
                    <label>First Name</label>
                    <input
                      placeholder="Enter first name"
                      value={form.first_name}
                      onChange={(e) =>
                        setForm({ ...form, first_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>Last Name</label>
                    <input
                      placeholder="Enter last name"
                      value={form.last_name}
                      onChange={(e) =>
                        setForm({ ...form, last_name: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>Email Address</label>
                    <input
                      placeholder="Enter email address"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-field">
                    <label>Username</label>
                    <input
                      placeholder="Enter username"
                      value={form.username}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="manage-users-form-actions">
                  <button type="submit" className="btn">
                    Save Profile
                  </button>
                </div>
              </form>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <h3>Profile Picture</h3>
                  <p className="panel-subtitle">
                    Upload a profile image for your account.
                  </p>
                </div>
              </div>

              <form
                onSubmit={uploadProfilePic}
                className="manage-users-form"
                style={{ marginTop: 12 }}
              >
                <div className="form-field">
                  <label>Select Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const selected = e.target.files?.[0];
                      setFile(selected || null);

                      if (selected) {
                        setPreview(URL.createObjectURL(selected));
                      } else {
                        setPreview("");
                      }
                    }}
                  />
                </div>

                {preview && (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={preview}
                      alt="Preview"
                      width="120"
                      height="120"
                      style={{
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "2px solid #ddd",
                      }}
                    />
                  </div>
                )}

                <div className="manage-users-form-actions">
                  <button type="submit" className="btn">
                    Upload Picture
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="footer">
            <span>Case Management System • DOJ Prototype</span>
          </div>
        </div>
      </div>
    </div>
  );
}
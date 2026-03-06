import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function ChangePassword() {
  const navigate = useNavigate();

  const [old_password, setOldPassword] = useState("");
  const [new_password, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    setLoading(true);

    try {
      // call backend
      await api.post("/change-password", { old_password, new_password });

      // refresh profile from backend so must_change_password becomes false
      const prof = await api.get("/my-profile");

      // NOTE: backend /my-profile returns user_id not id
      // We'll store it in localStorage as-is
      localStorage.setItem("user", JSON.stringify(prof.data));

      setMsg("Password updated ✅");

      // go to dashboard
      navigate("/dashboard");
    } catch (e2) {
      setErr(e2?.response?.data?.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", fontFamily: "Arial" }}>
      <h2>Change Password</h2>
      <p style={{ color: "#555" }}>
        You must change your password before continuing.
      </p>

      <form onSubmit={handleChangePassword} style={{ display: "grid", gap: 12 }}>
        <input
          type="password"
          placeholder="Old password"
          value={old_password}
          onChange={(e) => setOldPassword(e.target.value)}
          required
          style={{ padding: 10 }}
        />

        <input
          type="password"
          placeholder="New password"
          value={new_password}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          style={{ padding: 10 }}
        />

        <button type="submit" disabled={loading} style={{ padding: 10 }}>
          {loading ? "Updating..." : "Update Password"}
        </button>

        {msg && <div style={{ color: "green" }}>{msg}</div>}
        {err && <div style={{ color: "red" }}>{err}</div>}
      </form>
    </div>
  );
}
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { changeMyPassword, getMyProfile } from "../../services/profileService.js";
import { setStoredUser } from "../../utils/storage";


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
        await changeMyPassword({ old_password, new_password });

        const prof = await getMyProfile();
        setStoredUser(prof.data);

      setMsg("Password updated ✅");
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
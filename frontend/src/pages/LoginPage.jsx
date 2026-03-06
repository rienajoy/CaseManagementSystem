import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "../styles/login.css";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ Load remembered email
  useEffect(() => {
    const savedEmail = localStorage.getItem("remember_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/login", { email, password });

      // remember email if checked
      if (rememberMe) {
        localStorage.setItem("remember_email", email);
      } else {
        localStorage.removeItem("remember_email");
      }

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      if (res.data.user.must_change_password) {
        navigate("/change-password");
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-overlay"></div>

      <div className="login-card">
        {/* ✅ DOJ Seal */}
        <img className="login-logo" src="/doj-seal.jpg" alt="DOJ Seal" />

        <div className="login-title">Provincial Prosecutor's Office Case Management System</div>
        <div className="login-subtitle">Department of Justice</div>

        <form onSubmit={handleLogin}>
          <input
            className="login-input"
            type="email"
            placeholder="Email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {/* ✅ Password with toggle */}
         <div className="password-row">
  <input
    className="login-input"
    type={showPw ? "text" : "password"}
    placeholder="Password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
  />

  <span
    className="password-toggle"
    onClick={() => setShowPw(!showPw)}
  >
    {showPw ? <FaEyeSlash /> : <FaEye />}
  </span>
</div>

          {/* ✅ remember me */}
          <div className="remember-row">
            <label>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
          </div>

          {/* ✅ loading spinner */}
          <button className="login-button" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span>
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>

          {error && <div className="login-error">{error}</div>}
        </form>

        <div className="login-footer">
  Authorized Personnel Only • Department of Justice
</div>
      </div>
    </div>
  );
}
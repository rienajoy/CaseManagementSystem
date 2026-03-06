import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, roles }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!token || !user) return <Navigate to="/" replace />;

  // ✅ must change password enforcement
  if (user.must_change_password && window.location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  // ✅ role enforcement (optional)
  if (roles && Array.isArray(roles) && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
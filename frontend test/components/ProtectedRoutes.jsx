// src/components/ProtectedRoute.jsx

import { Navigate } from "react-router-dom";

export default function ProtectedRoute({
  children,
  requireAuth = true,
  allowedRoles = [],
}) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (requireAuth && (!token || !user)) {
    return <Navigate to="/" replace />;
  }

  if (
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user?.role)
  ) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
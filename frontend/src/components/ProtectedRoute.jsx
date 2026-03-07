// src/components/ProtectedRoute.jsx

import { Navigate } from "react-router-dom";
import { getStoredToken, getStoredUser } from "../utils/storage";

export default function ProtectedRoute({
  children,
  requireAuth = true,
  allowedRoles = [],
}) {
  const token = getStoredToken();
  const user = getStoredUser();

  const isAuthenticated = Boolean(token && user);
  const hasRoleAccess =
    allowedRoles.length === 0 || allowedRoles.includes(user?.role);

  if (requireAuth && !isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requireAuth && !hasRoleAccess) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
// src/routes/AppRoutes.jsx

import { BrowserRouter, Routes, Route } from "react-router-dom";

import ProtectedRoute from "../components/ProtectedRoute";

import LoginPage from "../pages/auth/LoginPage";
import ChangePassword from "../pages/auth/ChangePassword";

import Dashboard from "../pages/user/Dashboard";
import MyProfile from "../pages/user/MyProfile";

import AdminDashboard from "../pages/admin/AdminDashboard";
import AdminUsers from "../pages/admin/AdminUsers";
import AdminPermissions from "../pages/admin/AdminPermissions";
import UserStatus from "../pages/admin/UserStatus";

import Unauthorized from "../pages/system/Unauthorized";

import { ADMIN_ROLES } from "../utils/roles";

import NotFound from "../pages/system/NotFound";
import Settings from "../pages/user/Settings";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="*" element={<NotFound />} />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-profile"
          element={
            <ProtectedRoute>
              <MyProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/permissions"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <AdminPermissions />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/user-status"
          element={
            <ProtectedRoute allowedRoles={ADMIN_ROLES}>
              <UserStatus />
            </ProtectedRoute>
          }
        />

        <Route path="/unauthorized" element={<Unauthorized />} />
      </Routes>
    </BrowserRouter>
  );
}
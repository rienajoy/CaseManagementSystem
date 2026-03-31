  // src/routes/AppRoutes.js

  import { BrowserRouter, Routes, Route } from "react-router-dom";

  import ProtectedRoute from "../components/ProtectedRoute";

  import LoginPage from "../pages/auth/LoginPage";
  import ChangePassword from "../pages/auth/ChangePassword";

  import Dashboard from "../pages/user/Dashboard";
  import MyProfile from "../pages/user/MyProfile";
  import Settings from "../pages/user/Settings";

  import AdminDashboard from "../pages/admin/AdminDashboard";
  import AdminUsers from "../pages/admin/AdminUsers";
  import AdminPermissions from "../pages/admin/AdminPermissions";
  import UserStatus from "../pages/admin/UserStatus";

  import StaffDashboard from "../pages/staff/StaffDashboard.jsx";

  import IntakeCaseDetails from "../pages/staff/IntakeCaseDetails.jsx";
  import OfficialCases from "../pages/staff/OfficialCases.jsx";
  import OfficialCaseDetails from "../pages/staff/OfficialCaseDetails.jsx";
  import IntakeCasesPage from "../pages/staff/IntakeCasesPage";

  /* temporary placeholders for next pages
  * create these files next if they do not exist yet
  */
  import LegacyCases from "../pages/staff/LegacyCases.jsx";
  import LegacyCaseDetails from "../pages/staff/LegacyCaseDetails.jsx";
  import StaffAuditLogs from "../pages/staff/StaffAuditLogs.jsx";

  import ProsecutorDashboard from "../pages/prosecutor/ProsecutorDashboard";

  import Unauthorized from "../pages/system/Unauthorized";
  import NotFound from "../pages/system/NotFound";

  import { ADMIN_ROLES } from "../utils/roles";

  export default function AppRoutes() {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route
            path="/change-password"
            element={
              <ProtectedRoute>
                <ChangePassword />
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
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
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

          <Route
            path="/staff/dashboard"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <StaffDashboard />
              </ProtectedRoute>
            }
          />

          <Route
    path="/staff/intake-cases"
    element={
      <ProtectedRoute allowedRoles={["staff"]}>
        <IntakeCasesPage />
      </ProtectedRoute>
    }
  />

          <Route
            path="/staff/intake-cases/:intakeCaseId"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <IntakeCaseDetails />
              </ProtectedRoute>
            }
          />

          <Route
            path="/staff/cases"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <OfficialCases />
              </ProtectedRoute>
            }
          />

          <Route
            path="/staff/cases/:caseId"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <OfficialCaseDetails />
              </ProtectedRoute>
            }
          />

          <Route
            path="/staff/legacy-cases"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <LegacyCases />
              </ProtectedRoute>
            }
          />

          <Route
            path="/staff/legacy-cases/:caseId"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <LegacyCaseDetails />
              </ProtectedRoute>
            }
          />

          <Route
            path="/staff/audit-logs"
            element={
              <ProtectedRoute allowedRoles={["staff"]}>
                <StaffAuditLogs />
              </ProtectedRoute>
            }
          />

          <Route
            path="/prosecutor/dashboard"
            element={
              <ProtectedRoute allowedRoles={["prosecutor"]}>
                <ProsecutorDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    );
  }
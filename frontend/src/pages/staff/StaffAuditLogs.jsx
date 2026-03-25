import UserLayout from "../../components/UserLayout";
import { getStoredUser } from "../../utils/storage";

export default function StaffAuditLogs() {
  const user = getStoredUser();

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  return (
    <UserLayout user={user}>
      <div className="welcome-block">
        <div className="page-badge">Staff Module</div>
        <h1>Audit Logs</h1>
        <p className="subtitle">Audit logs page is being prepared.</p>
      </div>
    </UserLayout>
  );
}
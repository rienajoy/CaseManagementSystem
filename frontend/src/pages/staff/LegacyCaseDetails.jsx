import UserLayout from "../../components/UserLayout";
import { getStoredUser } from "../../utils/storage";

export default function LegacyCaseDetails() {
  const user = getStoredUser();

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  return (
    <UserLayout user={user}>
      <div className="welcome-block">
        <div className="page-badge">Staff Module</div>
        <h1>Legacy Case Details</h1>
        <p className="subtitle">Legacy case details page is being prepared.</p>
      </div>
    </UserLayout>
  );
}
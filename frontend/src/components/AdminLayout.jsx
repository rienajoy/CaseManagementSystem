import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import "../styles/dashboard.css";

export default function AdminLayout({ user, onLogout, title, children }) {
  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <div className="main">
        <Topbar user={user} onLogout={onLogout} />
        <div className="content">
          <div className="page-header">
            <h1>{title}</h1>
            <p className="subtitle">Administrator controls and monitoring</p>
          </div>
          {children}
          <div className="footer">
            <span>Case Management System • DOJ Prototype</span>
          </div>
        </div>
      </div>
    </div>
  );
}
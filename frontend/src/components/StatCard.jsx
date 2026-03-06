import "../styles/dashboard.css";

export default function StatCard({ title, value, icon }) {
  function getCardClass(title) {
    if (title === "Total Users") return "stat-card stat-blue";
    if (title === "Online Now") return "stat-card stat-green";
    if (title === "Locked Accounts") return "stat-card stat-red";
    if (title === "Prosecutors") return "stat-card stat-gold";
    return "stat-card";
  }

  return (
    <div className={getCardClass(title)}>
      <div className="stat-top">
        <span className="stat-icon">{icon}</span>
        <span className="stat-title">{title}</span>
      </div>

      <div className="stat-value">{value}</div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import api from "../../api";
import UserLayout from "../../components/UserLayout";
import { getStoredUser, setStoredUser } from "../../utils/storage";
import { isAdminLevel, isStaff } from "../../utils/roles";
import { getStaffDashboardSummary } from "../../services/staffService";

import "../../styles/staff/staff-dashboard.css";

export default function StaffDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser());
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    init();
  }, []);

  async function init() {
    if (!user) {
      navigate("/");
      return;
    }

    try {
      setLoading(true);
      setErr("");

      const profileRes = await api.get("/my-profile");
      const freshUser = profileRes.data;

      setStoredUser(freshUser);
      setUser(freshUser);

      if (isAdminLevel(freshUser)) {
        navigate("/admin/dashboard");
        return;
      }

      if (!isStaff(freshUser)) {
        navigate("/dashboard");
        return;
      }

      

const summaryRes = await getStaffDashboardSummary();
const dashboardSummary = summaryRes?.data?.data || {};

console.log("dashboardSummary:", dashboardSummary);
console.log("dashboardSummary.offenses:", dashboardSummary?.offenses);

setSummary(dashboardSummary);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load staff dashboard.");
    } finally {
      setLoading(false);
    }
  }

  const systemSummaryChartData = [
    {
      name: "Intake Cases",
      value: Number(summary?.intake?.total || 0),
    },
    {
      name: "Official Cases",
      value: Number(summary?.official_cases?.total || 0),
    },
    {
      name: "Legacy Cases",
      value: Number(summary?.legacy_cases?.total || 0),
    },
  ];

const totalSystemCases = systemSummaryChartData.reduce(
  (sum, item) => sum + item.value,
  0
);

const SYSTEM_SUMMARY_COLORS = ["#8F1029", "#C26A57", "#D9B38C"];

const hasSystemSummaryData = totalSystemCases > 0;

const systemSummaryPieData = hasSystemSummaryData
  ? systemSummaryChartData
  : [{ name: "No Data", value: 1 }];

const topCaseItem = [...systemSummaryChartData].sort(
  (a, b) => b.value - a.value
)[0];

const topCasePercent =
  totalSystemCases > 0
    ? Math.round((topCaseItem.value / totalSystemCases) * 100)
    : 0;

  // Temporary sample data for offenses/violations.
  // Replace this with backend data when available.
const offenseChartData = Array.isArray(summary?.offenses)
  ? summary.offenses
      .slice(0, 5)
      .map((item) => ({
        name: item.name || "Unknown",
        total: Number(item.total || 0),
      }))
  : [];
console.log("summary state:", summary);
console.log("offenseChartData:", offenseChartData);

  const recentIntakeCases = summary?.recent_intake_cases || [
  {
    intake_id: "INT-2026-001",
    case_type: "Criminal",
    case_title: "People vs. Dela Cruz",
    intake_status: "For Review",
  },
  {
    intake_id: "INT-2026-002",
    case_type: "Civil",
    case_title: "Property Dispute",
    intake_status: "For Confirmation",
  },
  {
    intake_id: "INT-2026-003",
    case_type: "Administrative",
    case_title: "Workplace Complaint",
    intake_status: "Ready for Conversion",
  },
];

const recentOfficialCases = summary?.recent_official_cases || [
  {
    case_number: "OC-2026-014",
    case_title: "State vs. Ramos",
    case_type: "Criminal",
    case_status: "Active",
  },
  {
    case_number: "OC-2026-015",
    case_title: "Land Ownership Petition",
    case_type: "Civil",
    case_status: "Pending",
  },
  {
    case_number: "OC-2026-016",
    case_title: "Internal Misconduct Case",
    case_type: "Administrative",
    case_status: "Under Review",
  },
];

const dueTodayCompliance = summary?.due_today_compliance || [
  {
    title: "Submit Incident Report",
    type: "Report",
    responsible_party: "Juan Dela Cruz",
    due_date: "Today",
  },
  {
    title: "File Supporting Affidavit",
    type: "Document",
    responsible_party: "Maria Santos",
    due_date: "Today",
  },
];

const overdueCompliance = summary?.overdue_compliance || [
  {
    title: "Compliance Follow-up",
    type: "Notice",
    responsible_party: "Pedro Reyes",
    due_date: "Mar 20, 2026",
  },
  {
    title: "Submit Evidence Packet",
    type: "Document",
    responsible_party: "Ana Lopez",
    due_date: "Mar 18, 2026",
  },
];

function getStatusClass(status = "") {
  const normalized = status.toLowerCase();

  if (
    normalized.includes("active") ||
    normalized.includes("completed") ||
    normalized.includes("ready")
  ) {
    return "success";
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("review") ||
    normalized.includes("confirmation")
  ) {
    return "warning";
  }

  if (
    normalized.includes("overdue") ||
    normalized.includes("cancelled") ||
    normalized.includes("rejected")
  ) {
    return "danger";
  }

  return "neutral";
}

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  return (
    <UserLayout user={user}>
      <div className="staff-dashboard-page">
        {loading ? (
          <div className="panel">
            <div className="empty">Loading staff dashboard...</div>
          </div>
        ) : (
          <>
            {err ? (
              <div className="panel">
                <div className="empty">{err}</div>
              </div>
            ) : null}
<div className="staff-dashboard-grid charts-split-layout">
  <div className="offenses-panel-modern chart-card">
    <div className="chart-card-header">
      <div>
        <h3>Offenses / Violations</h3>
        <p className="panel-subtitle">Most recorded offenses overview</p>
      </div>
    </div>

    <div className="offenses-chart-wrap horizontal-chart">
      {offenseChartData.length > 0 ? (
<ResponsiveContainer width="100%" height={320}>
  <BarChart
    data={offenseChartData}
    layout="vertical"
    margin={{ top: 10, right: 18, left: -30, bottom: 10 }}
  >
    <CartesianGrid
      strokeDasharray="3 3"
      horizontal={false}
      stroke="#ece7e4"
    />
    <XAxis
      type="number"
      allowDecimals={false}
      axisLine={false}
      tickLine={false}
      tick={{ fontSize: 12, fill: "#8b8b8b" }}
    />
<YAxis
  type="category"
  dataKey="name"
  width={92}
  axisLine={false}
  tickLine={false}
  tick={{ fontSize: 10, fill: "#444" }}
  tickFormatter={(value) =>
    value.length > 16 ? `${value.slice(0, 16)}...` : value
  }
/>  
    <Tooltip />
    <Bar
      dataKey="total"
      radius={[0, 10, 10, 0]}
      fill="#841428"
      barSize={24}
    />
  </BarChart>
</ResponsiveContainer>
      ) : (
        <div className="empty">No offense/violation data available.</div>
      )}
    </div>
  </div>

  <div className="system-summary-panel-modern chart-card budget-style-card">
    <div className="chart-card-header budget-style-header">
      <div>
        <h3>Case Distribution</h3>
        <p className="panel-subtitle">Case distribution overview</p>
      </div>
    </div>

    <div className="budget-style-layout">
      <div className="budget-style-legend">
        {systemSummaryChartData.map((item, index) => (
          <div key={item.name} className="budget-style-legend-item">
            <div className="budget-style-legend-left">
              <span
                className="budget-style-dot"
                style={{
                  backgroundColor: SYSTEM_SUMMARY_COLORS[index],
                }}
              />
              <span className="budget-style-label">{item.name}</span>
            </div>

            <span className="budget-style-legend-value">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="budget-style-chart-side">
        <div className="budget-style-floating-chip">
          <span className="budget-style-chip-percent">{topCasePercent}%</span>
          <span className="budget-style-chip-value">
            {topCaseItem?.value || 0}
          </span>
        </div>

        <div className="budget-style-chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={systemSummaryPieData}
                dataKey="value"
                nameKey="name"
                innerRadius={46}
                outerRadius={66}
                paddingAngle={hasSystemSummaryData ? 8 : 0}
                cornerRadius={hasSystemSummaryData ? 10 : 999}
                startAngle={90}
                endAngle={-270}
                stroke="none"
              >
                {hasSystemSummaryData ? (
                  systemSummaryChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={
                        SYSTEM_SUMMARY_COLORS[
                          index % SYSTEM_SUMMARY_COLORS.length
                        ]
                      }
                    />
                  ))
                ) : (
                  <Cell fill="#ece8e4" />
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          <div className="budget-style-center-label">
            <div className="budget-style-center-subtitle">Total cases</div>
            <div className="budget-style-center-value">{totalSystemCases}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<div className="staff-summary-cards">
  <div className="summary-card">
    <div className="summary-card-label">Intake for Review</div>
    <div className="summary-card-value">
      {summary?.intake?.needs_review ?? 0}
    </div>
  </div>

  <div className="summary-card">
    <div className="summary-card-label">For Confirmation</div>
    <div className="summary-card-value">
      {summary?.intake?.for_confirmation ?? 0}
    </div>
  </div>

  <div className="summary-card">
    <div className="summary-card-label">Ready for Conversion</div>
    <div className="summary-card-value">
      {summary?.intake?.ready_for_conversion ?? 0}
    </div>
  </div>

  <div className="summary-card">
    <div className="summary-card-label">Official Overdue Compliance</div>
    <div className="summary-card-value">
      {summary?.compliance?.official?.timeline?.overdue ?? 0}
    </div>
  </div>
</div>

<div className="staff-dashboard-tables">
  <div className="dashboard-table-grid">
    <div className="dashboard-table-card dashboard-table-card-wide">
      <div className="dashboard-table-header">
        <div>
          <h3>Recent Intake Cases</h3>
          <p className="panel-subtitle">Latest intake case entries</p>
        </div>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Intake ID</th>
              <th>Case Type</th>
              <th>Case Title</th>
              <th>Intake Status</th>
            </tr>
          </thead>
          <tbody>
            {recentIntakeCases.length > 0 ? (
              recentIntakeCases.map((item, index) => (
                <tr key={`${item.intake_id}-${index}`}>
                  <td>{item.intake_id}</td>
                  <td>{item.case_type}</td>
                  <td>{item.case_title}</td>
                  <td>
                    <span className={`table-status ${getStatusClass(item.intake_status)}`}>
                      {item.intake_status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="table-empty-cell">
                  No recent intake cases found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div className="dashboard-table-card dashboard-table-card-side">
      <div className="dashboard-table-header">
        <div>
          <h3>Due Today Compliance</h3>
          <p className="panel-subtitle">Items that need action today</p>
        </div>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Responsible Party</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {dueTodayCompliance.length > 0 ? (
              dueTodayCompliance.map((item, index) => (
                <tr key={`${item.title}-${index}`}>
                  <td>{item.title}</td>
                  <td>{item.type}</td>
                  <td>{item.responsible_party}</td>
                  <td>{item.due_date}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="table-empty-cell">
                  No compliance items due today.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div className="dashboard-table-grid">
    <div className="dashboard-table-card dashboard-table-card-wide">
      <div className="dashboard-table-header">
        <div>
          <h3>Recent Official Cases</h3>
          <p className="panel-subtitle">Latest official case records</p>
        </div>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Case Number</th>
              <th>Case Title</th>
              <th>Case Type</th>
              <th>Case Status</th>
            </tr>
          </thead>
          <tbody>
            {recentOfficialCases.length > 0 ? (
              recentOfficialCases.map((item, index) => (
                <tr key={`${item.case_number}-${index}`}>
                  <td>{item.case_number}</td>
                  <td>{item.case_title}</td>
                  <td>{item.case_type}</td>
                  <td>
                    <span className={`table-status ${getStatusClass(item.case_status)}`}>
                      {item.case_status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="table-empty-cell">
                  No recent official cases found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>

    <div className="dashboard-table-card dashboard-table-card-side">
      <div className="dashboard-table-header">
        <div>
          <h3>Overdue Compliance</h3>
          <p className="panel-subtitle">Compliance items past due date</p>
        </div>
      </div>

      <div className="dashboard-table-wrap">
        <table className="dashboard-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Type</th>
              <th>Responsible Party</th>
              <th>Due Date</th>
            </tr>
          </thead>
          <tbody>
            {overdueCompliance.length > 0 ? (
              overdueCompliance.map((item, index) => (
                <tr key={`${item.title}-${index}`}>
                  <td>{item.title}</td>
                  <td>{item.type}</td>
                  <td>{item.responsible_party}</td>
                  <td>{item.due_date}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="table-empty-cell">
                  No overdue compliance items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</div>
            <div className="footer">
              <span>Case Management System • DOJ Prototype</span>
            </div>
          </>
        )}
      </div>
    </UserLayout>
  );
}
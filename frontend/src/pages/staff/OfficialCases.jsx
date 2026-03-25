//src/pages/staff/OfficialCases.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import UserLayout from "../../components/UserLayout";
import { getStoredUser } from "../../utils/storage";
import { getOfficialCases } from "../../services/staffService";

import "../../styles/dashboard.css";

export default function OfficialCases() {
  const user = getStoredUser();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    loadCases();
  }, []);

  async function loadCases() {
    try {
      setLoading(true);
      setErr("");
      const res = await getOfficialCases();
      setItems(res?.data?.data?.cases || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load official cases.");
    } finally {
      setLoading(false);
    }
  }

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  return (
    <UserLayout user={user}>
      <div className="welcome-block">
        <div className="page-badge">Staff Module</div>
        <h1>Official Cases</h1>
        <p className="subtitle">
          View and manage official cases converted from intake records.
        </p>
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Official Case List</h3>
            <p className="panel-subtitle">
              Open a case to view parties, documents, and case details.
            </p>
          </div>

          <button className="btn btn-light" onClick={loadCases}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="empty">Loading official cases...</div>
        ) : items.length === 0 ? (
          <div className="empty">No official cases found.</div>
        ) : (
          <div className="manage-users-table-wrap">
            <table className="manage-users-table">
              <thead>
                <tr>
                  <th>Case Number</th>
                  <th>Docket Number</th>
                  <th>Case Title</th>
                  <th>Case Type</th>
                  <th>Case Status</th>
                  <th>Prosecution Result</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.case_number || "-"}</td>
                    <td>{item.docket_number || "-"}</td>
                    <td>{item.case_title || "-"}</td>
                    <td>{item.case_type || "-"}</td>
                    <td>{item.case_status || "-"}</td>
                    <td>{item.prosecution_result || "-"}</td>
                    <td>
                      <div className="manage-users-actions">
                        <button
                          onClick={() => navigate(`/staff/cases/${item.id}`)}
                        >
                          View Details
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="footer">
        <span>Case Management System • DOJ Prototype</span>
      </div>
    </UserLayout>
  );
}
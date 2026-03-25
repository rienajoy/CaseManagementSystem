//src/pages/staff/OfficialCaseDetails.jsx

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import UserLayout from "../../components/UserLayout";
import { getStoredUser } from "../../utils/storage";
import { getOfficialCaseById } from "../../services/staffService";

import "../../styles/dashboard.css";

export default function OfficialCaseDetails() {
  const { caseId } = useParams();
  const user = getStoredUser();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    loadCase();
  }, [caseId]);

  async function loadCase() {
    try {
      setLoading(true);
      setErr("");
      const res = await getOfficialCaseById(caseId);
      setItem(res?.data?.data?.case || null);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load official case details.");
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
        <div className="page-badge">Official Case</div>
        <h1>Official Case Details</h1>
        <p className="subtitle">
          Review the converted official case record and its related documents.
        </p>
      </div>

      {err && <div className="alert alert-error">{err}</div>}

      {loading ? (
        <div className="panel">
          <div className="empty">Loading official case details...</div>
        </div>
      ) : !item ? (
        <div className="panel">
          <div className="empty">Official case not found.</div>
        </div>
      ) : (
        <>
          <div className="cards" style={{ marginBottom: 18 }}>
            <div className="stat-card stat-blue">
              <div className="stat-title">Case Number</div>
              <div className="stat-value">{item.case_number || "-"}</div>
            </div>

            <div className="stat-card stat-green">
              <div className="stat-title">Docket Number</div>
              <div className="stat-value">{item.docket_number || "-"}</div>
            </div>

            <div className="stat-card stat-gold">
              <div className="stat-title">Case Type</div>
              <div className="stat-value">{item.case_type || "-"}</div>
            </div>

            <div className="stat-card stat-red">
              <div className="stat-title">Case Status</div>
              <div className="stat-value">{item.case_status || "-"}</div>
            </div>
          </div>

          <div className="grid">
            <div className="panel">
              <div className="panel-header">
                <h3>Case Summary</h3>
              </div>

              <div className="notes" style={{ marginTop: 12 }}>
                <p><strong>Case Title:</strong> {item.case_title || "-"}</p>
                <p><strong>Offense / Violation:</strong> {item.offense_or_violation || "-"}</p>
                <p><strong>Filing Date:</strong> {item.filing_date || "-"}</p>
                <p><strong>Intake Status:</strong> {item.intake_status || "-"}</p>
                <p><strong>Prosecution Result:</strong> {item.prosecution_result || "-"}</p>
                <p><strong>Court Result:</strong> {item.court_result || "-"}</p>
                <p><strong>Court Branch:</strong> {item.court_branch || "-"}</p>
                <p><strong>Resolution Date:</strong> {item.resolution_date || "-"}</p>
                <p><strong>Filed in Court Date:</strong> {item.filed_in_court_date || "-"}</p>
                <p><strong>Case Origin:</strong> {item.case_origin || "-"}</p>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Parties</h3>
              </div>

              <div className="notes" style={{ marginTop: 12 }}>
                <p>
                  <strong>Complainants:</strong>{" "}
                  {(item.complainants || []).length
                    ? item.complainants.map((p) => p.full_name).join(", ")
                    : "-"}
                </p>
                <p>
                  <strong>Respondents:</strong>{" "}
                  {(item.respondents || []).length
                    ? item.respondents.map((p) => p.full_name).join(", ")
                    : "-"}
                </p>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Official Case Documents</h3>
              </div>

              {!(item.documents || []).length ? (
                <div className="empty">No case documents found.</div>
              ) : (
                <div className="manage-users-table-wrap">
                  <table className="manage-users-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>File Name</th>
                        <th>Status</th>
                        <th>Reviewed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.documents.map((doc) => (
                        <tr key={doc.id}>
                          <td>{doc.document_type || "-"}</td>
                          <td>{doc.uploaded_file_name || "-"}</td>
                          <td>{doc.document_status || "-"}</td>
                          <td>{doc.is_reviewed ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="footer">
            <span>Case Management System • DOJ Prototype</span>
          </div>
        </>
      )}
    </UserLayout>
  );
}
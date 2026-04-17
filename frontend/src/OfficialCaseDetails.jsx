// src/pages/staff/OfficialCaseDetails.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import UserLayout from "../../components/UserLayout";
import { getStoredUser } from "../../utils/storage";
import { getOfficialCaseById } from "../../services/staffService";
import "../../styles/staff/intake-case-details-page.css";

export default function OfficialCaseDetails() {
  const { caseId } = useParams();
  const user = getStoredUser();

  const [activeTopTab, setActiveTopTab] = useState("case-details");
  const [record, setRecord] = useState(null);
  const [latestDocuments, setLatestDocuments] = useState([]);
  const [documentHistory, setDocumentHistory] = useState([]);
  const [courtEvents, setCourtEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function loadDetails() {
    try {
      setLoading(true);
      setErr("");

      const res = await getOfficialCaseById(caseId);
      const data = res?.data?.data || {};

      setRecord(data.case || null);
      setLatestDocuments(Array.isArray(data.latest_documents) ? data.latest_documents : []);
      setDocumentHistory(Array.isArray(data.document_history) ? data.document_history : []);
      setCourtEvents(Array.isArray(data.court_events) ? data.court_events : []);
    } catch (error) {
      console.error("Failed to load official case details:", error);
      setErr(error?.response?.data?.message || "Failed to load official case.");
    } finally {
      setLoading(false);
    }
  }

  function toDisplayValue(value, fallback = "—") {
    if (value === null || value === undefined || value === "") return fallback;
    if (Array.isArray(value)) return value.join(", ") || fallback;
    return String(value);
  }

  function formatDateOnly(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  }

  const summaryData = useMemo(() => ({
    caseNumber: record?.case_number,
    docketNumber: record?.docket_number,
    caseTitle: record?.case_title,
    offenseOrViolation: record?.offense_or_violation,
    assignedProsecutor:
      record?.assigned_prosecutor_name ||
      record?.assigned_prosecutor_label ||
      record?.assigned_prosecutor,
    caseStatus: record?.case_status_label || record?.case_status,
    prosecutionResult: record?.prosecution_result,
    courtResult: record?.court_result,
    filingDate: record?.filing_date,
    filedInCourtDate: record?.filed_in_court_date,
    resolutionDate: record?.resolution_date,
    courtBranch: record?.court_branch,
    complainants: Array.isArray(record?.complainants)
      ? record.complainants.join(", ")
      : record?.complainants,
    respondents: Array.isArray(record?.respondents)
      ? record.respondents.join(", ")
      : record?.respondents,
    caseOrigin: record?.case_origin,
    sourceIntakeCaseId: record?.source_intake_case_id,
  }), [record]);

  if (!user) return <div style={{ padding: 20 }}>Redirecting...</div>;

  return (
    <UserLayout
      user={user}
      sectionBadge="OFFICIAL CASE DETAILS"
      pageTitle="Official Case Details"
      pageSubtitle="Review case summary, documents, and court events."
    >
      <div className="intake-details-page">
        {err && <div className="intake-details-alert error">{err}</div>}

        {loading ? (
          <div className="intake-details-empty">Loading official case details...</div>
        ) : !record ? (
          <div className="intake-details-empty">Official case not found.</div>
        ) : (
          <div className="intake-details-wide-layout">
            <div className="intake-top-row">
              <div className="intake-hero-stack">
                <div className="intake-top-tabs-shell">
                  <div className="intake-top-tabs">
                    <button
                      type="button"
                      className={`intake-top-tab ${activeTopTab === "case-details" ? "active" : ""}`}
                      onClick={() => setActiveTopTab("case-details")}
                    >
                      <span>Case Details</span>
                    </button>

                    <button
                      type="button"
                      className={`intake-top-tab ${activeTopTab === "documents" ? "active" : ""}`}
                      onClick={() => setActiveTopTab("documents")}
                    >
                      <span>Documents ({latestDocuments.length})</span>
                    </button>

                    <button
                      type="button"
                      className={`intake-top-tab ${activeTopTab === "court-events" ? "active" : ""}`}
                      onClick={() => setActiveTopTab("court-events")}
                    >
                      <span>Court Events ({courtEvents.length})</span>
                    </button>
                  </div>
                </div>

                {activeTopTab === "case-details" && (
                  <div className="intake-case-hero-card">
                    <div className="intake-case-hero-topbar">
                      <div className="intake-case-dockets-inline">
                        <span className="intake-case-docket-pill">
                          <span className="intake-case-docket-pill-label">DOCKET NO.:</span>
                          {toDisplayValue(summaryData.docketNumber)}
                        </span>

                        <span className="intake-case-docket-pill">
                          <span className="intake-case-docket-pill-label">CASE NO.:</span>
                          {toDisplayValue(summaryData.caseNumber)}
                        </span>
                      </div>
                    </div>

                    <div className="intake-case-top-grid">
                      <div className="case-title-card">
                        <strong>{toDisplayValue(summaryData.caseTitle)}</strong>
                      </div>

                      <div className="case-top-right-grid">
                        <div className="summary-box">
                          <span>OFFENSE/VIOLATION</span>
                          <strong>{toDisplayValue(summaryData.offenseOrViolation)}</strong>
                        </div>
                        <div className="summary-box">
                          <span>CASE STATUS</span>
                          <strong>{toDisplayValue(summaryData.caseStatus)}</strong>
                        </div>
                        <div className="summary-box">
                          <span>ASSIGNED PROSECUTOR</span>
                          <strong>{toDisplayValue(summaryData.assignedProsecutor)}</strong>
                        </div>
                        <div className="summary-box">
                          <span>FILING DATE</span>
                          <strong>{formatDateOnly(summaryData.filingDate)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="intake-case-lower-grid">
                      <div className="summary-box">
                        <span>RESOLUTION DATE</span>
                        <strong>{formatDateOnly(summaryData.resolutionDate)}</strong>
                      </div>
                      <div className="summary-box">
                        <span>PROSECUTION RESULT</span>
                        <strong>{toDisplayValue(summaryData.prosecutionResult)}</strong>
                      </div>
                      <div className="summary-box">
                        <span>INFORMATION DATE FILED</span>
                        <strong>{formatDateOnly(summaryData.filedInCourtDate)}</strong>
                      </div>
                    </div>

                    <div className="intake-case-last-row">
                      <div className="summary-box">
                        <span>RESPONDENTS</span>
                        <strong>{toDisplayValue(summaryData.respondents)}</strong>
                      </div>
                      <div className="summary-box">
                        <span>COMPLAINANTS</span>
                        <strong>{toDisplayValue(summaryData.complainants)}</strong>
                      </div>
                    </div>

                    <div className="intake-case-last-row">
                      <div className="summary-box">
                        <span>COURT BRANCH</span>
                        <strong>{toDisplayValue(summaryData.courtBranch)}</strong>
                      </div>
                      <div className="summary-box">
                        <span>CASE ORIGIN</span>
                        <strong>
                          {toDisplayValue(summaryData.caseOrigin)}
                          {summaryData.sourceIntakeCaseId
                            ? ` • Intake #${summaryData.sourceIntakeCaseId}`
                            : ""}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}

                {activeTopTab === "documents" && (
                  <div className="intake-details-panel tab-panel">
                    <div className="intake-details-panel-header">
                      <h3>Latest Documents</h3>
                    </div>

                    {latestDocuments.length === 0 ? (
                      <div className="intake-details-empty">No documents found.</div>
                    ) : (
                      <div className="intake-details-table-wrap">
                        <table className="intake-details-table">
                          <thead>
                            <tr>
                              <th>Document Type</th>
                              <th>File Name</th>
                              <th>Status</th>
                              <th>Uploaded At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {latestDocuments.map((doc) => (
                              <tr key={doc.id}>
                                <td>{toDisplayValue(doc.document_type_label || doc.document_type)}</td>
                                <td>{toDisplayValue(doc.uploaded_file_name)}</td>
                                <td>{toDisplayValue(doc.document_status_label || doc.document_status)}</td>
                                <td>{formatDateOnly(doc.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="intake-details-panel-header" style={{ marginTop: 16 }}>
                      <h3>Document History</h3>
                    </div>

                    {documentHistory.length === 0 ? (
                      <div className="intake-details-empty">No document history found.</div>
                    ) : (
                      <div className="intake-details-table-wrap">
                        <table className="intake-details-table">
                          <thead>
                            <tr>
                              <th>Document Type</th>
                              <th>Version</th>
                              <th>Status</th>
                              <th>Uploaded At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {documentHistory.map((doc) => (
                              <tr key={doc.id}>
                                <td>{toDisplayValue(doc.document_type_label || doc.document_type)}</td>
                                <td>{toDisplayValue(doc.version_no)}</td>
                                <td>{toDisplayValue(doc.version_status || doc.document_status)}</td>
                                <td>{formatDateOnly(doc.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {activeTopTab === "court-events" && (
                  <div className="intake-details-panel tab-panel">
                    <div className="intake-details-panel-header">
                      <h3>Court Events</h3>
                    </div>

                    {courtEvents.length === 0 ? (
                      <div className="intake-details-empty">No court events found.</div>
                    ) : (
                      <div className="intake-details-table-wrap">
                        <table className="intake-details-table">
                          <thead>
                            <tr>
                              <th>Event Type</th>
                              <th>Event Date</th>
                              <th>Remarks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {courtEvents.map((event) => (
                              <tr key={event.id}>
                                <td>{toDisplayValue(event.event_type_label || event.event_type)}</td>
                                <td>{formatDateOnly(event.event_date)}</td>
                                <td>{toDisplayValue(event.remarks || event.notes)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
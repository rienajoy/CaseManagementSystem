//src/pages/staff/IntakeCaseDetails.jsx

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import UserLayout from "../../components/UserLayout";
import { getStoredUser } from "../../utils/storage";
import {
  getIntakeCaseById,
  uploadIntakeCaseDocument,
  confirmIntakeCase,
  convertIntakeCase,
  getIntakeCaseDocument,
  reviewIntakeCaseDocument,
} from "../../services/staffService";

import "../../styles/dashboard.css";

export default function IntakeCaseDetails() {
  const { intakeCaseId } = useParams();
  const navigate = useNavigate();
  const user = getStoredUser();

  const [record, setRecord] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [complianceItems, setComplianceItems] = useState([]);

  const [documentType, setDocumentType] = useState("complaint_affidavit");
  const [dateReceived, setDateReceived] = useState("");
  const [file, setFile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");


    const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const [reviewForm, setReviewForm] = useState({
    document_type: "",
    case_title: "",
    docket_number: "",
    case_number: "",
    date_filed: "",
    offense_or_violation: "",
    assigned_prosecutor: "",
    case_status: "",
    prosecution_result: "",
    court_result: "",
    complainants: "",
    respondents: "",
    review_flags: "",
    review_notes: "",
  });

  useEffect(() => {
    loadDetails();
  }, [intakeCaseId]);

  async function loadDetails() {
    try {
      setLoading(true);
      setErr("");

      const res = await getIntakeCaseById(intakeCaseId);
      const data = res?.data?.data || {};

      setRecord(data.intake_case || null);
      setDocuments(data.documents || []);
      setChecklist(data.checklist || []);
      setTrackers(data.document_trackers || []);
      setComplianceItems(data.compliance_items || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load intake case details.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    if (!file) {
      setErr("Please select a document first.");
      return;
    }

    try {
      setActionLoading(true);

      const formData = new FormData();
      formData.append("document", file);
      formData.append("document_type", documentType);

      if (dateReceived) {
        formData.append("date_received", dateReceived);
      }

      await uploadIntakeCaseDocument(intakeCaseId, formData);

      setMsg("Document uploaded successfully.");
      setFile(null);
      setDateReceived("");
      await loadDetails();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to upload document.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirm() {
    setMsg("");
    setErr("");

    try {
      setActionLoading(true);
      await confirmIntakeCase(intakeCaseId, {});
      setMsg("Intake case confirmed successfully.");
      await loadDetails();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to confirm intake case.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConvert() {
    setMsg("");
    setErr("");

    try {
      setActionLoading(true);
      const res = await convertIntakeCase(intakeCaseId);

      const newCaseId = res?.data?.data?.case?.id;
      setMsg("Intake case converted successfully.");

      if (newCaseId) {
        navigate(`/staff/cases/${newCaseId}`);
        return;
      }

      await loadDetails();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to convert intake case.");
    } finally {
      setActionLoading(false);
    }
  }

    function normalizeListForInput(value) {
    if (!value) return "";
    if (Array.isArray(value)) return value.join(", ");
    return String(value);
  }

  function buildReviewFormFromDocument(doc) {
    const reviewed = doc?.reviewed_data || {};
    const extractedMeta = doc?.extracted_data?.metadata || {};
    const base = Object.keys(reviewed).length ? reviewed : extractedMeta;

    return {
      document_type: doc?.document_type || "",
      case_title: base.case_title || "",
      docket_number: base.docket_number || "",
      case_number: base.case_number || "",
      date_filed: base.date_filed || "",
      offense_or_violation: base.offense_or_violation || "",
      assigned_prosecutor: base.assigned_prosecutor || "",
      case_status: base.case_status || "",
      prosecution_result: base.prosecution_result || "",
      court_result: base.court_result || "",
      complainants: normalizeListForInput(base.complainants),
      respondents: normalizeListForInput(base.respondents),
      review_flags: normalizeListForInput(base.review_flags),
      review_notes: doc?.review_notes || "",
    };
  }

  async function handleOpenReview(documentId) {
    try {
      setErr("");
      setReviewLoading(true);

      const res = await getIntakeCaseDocument(documentId);
      const doc = res?.data?.data?.document;

      setSelectedDocument(doc);
      setReviewForm(buildReviewFormFromDocument(doc));
      setReviewModalOpen(true);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load document for review.");
    } finally {
      setReviewLoading(false);
    }
  }

  function handleReviewFieldChange(key, value) {
    setReviewForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function handleSaveReview(e) {
    e.preventDefault();

    if (!selectedDocument?.id) return;

    try {
      setErr("");
      setMsg("");
      setReviewLoading(true);

      const payload = {
        reviewed_data: {
          document_type: reviewForm.document_type,
          case_title: reviewForm.case_title,
          docket_number: reviewForm.docket_number,
          case_number: reviewForm.case_number,
          date_filed: reviewForm.date_filed,
          offense_or_violation: reviewForm.offense_or_violation,
          assigned_prosecutor: reviewForm.assigned_prosecutor,
          case_status: reviewForm.case_status,
          prosecution_result: reviewForm.prosecution_result,
          court_result: reviewForm.court_result,
          complainants: reviewForm.complainants
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          respondents: reviewForm.respondents
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          review_flags: reviewForm.review_flags
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
        },
        review_notes: reviewForm.review_notes,
      };

      await reviewIntakeCaseDocument(selectedDocument.id, payload);

      setMsg("Document reviewed and updated successfully.");
      setReviewModalOpen(false);
      setSelectedDocument(null);
      await loadDetails();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to save review.");
    } finally {
      setReviewLoading(false);
    }
  }

  function renderList(items) {
    if (!items || items.length === 0) {
      return <div className="empty">No records found.</div>;
    }

    return (
      <div className="notes">
        <ul>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  return (
    <UserLayout user={user}>
      <div className="welcome-block">
        <div className="page-badge">Staff Intake</div>
        <h1>Intake Case Details</h1>
        <p className="subtitle">
          Review case summary, upload documents, and prepare this record for conversion.
        </p>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      {loading ? (
        <div className="panel">
          <div className="empty">Loading intake case details...</div>
        </div>
      ) : !record ? (
        <div className="panel">
          <div className="empty">Intake case not found.</div>
        </div>
      ) : (
        <>
          <div className="cards" style={{ marginBottom: 18 }}>
            <div className="stat-card stat-blue">
              <div className="stat-title">Intake ID</div>
              <div className="stat-value">{record.intake_case_id}</div>
            </div>

            <div className="stat-card stat-green">
              <div className="stat-title">Case Type</div>
              <div className="stat-value">{record.case_type || "-"}</div>
            </div>

            <div className="stat-card stat-gold">
              <div className="stat-title">Intake Status</div>
              <div className="stat-value">{record.intake_status || "-"}</div>
            </div>

            <div className="stat-card stat-red">
              <div className="stat-title">Document Status</div>
              <div className="stat-value">{record.intake_document_status || "-"}</div>
            </div>
          </div>

          <div className="grid">
            <div className="panel">
              <div className="panel-header">
                <h3>Case Summary</h3>
              </div>

              <div className="notes" style={{ marginTop: 12 }}>
                <p><strong>Case Title:</strong> {record.case_title || "-"}</p>
                <p><strong>Docket Number:</strong> {record.docket_number || "-"}</p>
                <p><strong>Case Number:</strong> {record.case_number || "-"}</p>
                <p><strong>Date Filed:</strong> {record.date_filed || "-"}</p>
                <p><strong>Offense / Violation:</strong> {record.offense_or_violation || "-"}</p>
                <p><strong>Assigned Prosecutor:</strong> {record.assigned_prosecutor || "-"}</p>
                <p><strong>Case Status:</strong> {record.case_status || "-"}</p>
                <p><strong>Prosecution Result:</strong> {record.prosecution_result || "-"}</p>
                <p><strong>Court Result:</strong> {record.court_result || "-"}</p>
                <p>
                  <strong>Complainants:</strong>{" "}
                  {(record.complainants || []).length
                    ? record.complainants.join(", ")
                    : "-"}
                </p>
                <p>
                  <strong>Respondents:</strong>{" "}
                  {(record.respondents || []).length
                    ? record.respondents.join(", ")
                    : "-"}
                </p>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Upload Intake Document</h3>
              </div>

              <form onSubmit={handleUpload} className="manage-users-form">
                <div className="form-grid">
                  <div className="form-field">
                    <label>Document Type</label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                    >
                      <option value="complaint_affidavit">complaint_affidavit</option>
                      <option value="police_report">police_report</option>
                      <option value="arrest_report">arrest_report</option>
                      <option value="subpoena">subpoena</option>
                      <option value="counter_affidavit">counter_affidavit</option>
                      <option value="resolution">resolution</option>
                      <option value="information">information</option>
                      <option value="reply_affidavit">reply_affidavit</option>
                      <option value="rejoinder">rejoinder</option>
                      <option value="other_supporting_document">other_supporting_document</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Date Received</label>
                    <input
                      type="date"
                      value={dateReceived}
                      onChange={(e) => setDateReceived(e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label>Document File</label>
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </div>
                </div>

                <div className="manage-users-form-actions">
                  <button type="submit" className="btn" disabled={actionLoading}>
                    {actionLoading ? "Processing..." : "Upload Document"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={handleConfirm}
                    disabled={actionLoading}
                  >
                    Confirm Intake
                  </button>

                  <button
                    type="button"
                    className="btn"
                    onClick={handleConvert}
                    disabled={actionLoading}
                  >
                    Convert to Official Case
                  </button>
                </div>
              </form>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Uploaded Documents</h3>
              </div>

              {documents.length === 0 ? (
                <div className="empty">No uploaded documents yet.</div>
              ) : (
                <div className="manage-users-table-wrap">
                  <table className="manage-users-table">
                    <thead>
                    <tr>
                        <th>Type</th>
                        <th>File Name</th>
                        <th>Status</th>
                        <th>Priority</th>
                        <th>Reviewed</th>
                        <th>Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                      {documents.map((doc) => (
                        <tr key={doc.id}>
                            <td>{doc.document_type}</td>
                            <td>{doc.uploaded_file_name}</td>
                            <td>{doc.document_status || "-"}</td>
                            <td>{doc.review_priority || "-"}</td>
                            <td>{doc.is_reviewed ? "Yes" : "No"}</td>
                            <td>
                                <div className="manage-users-actions">
                                <button
                                    type="button"
                                    onClick={() => handleOpenReview(doc.id)}
                                    disabled={reviewLoading}
                                >
                                    {doc.is_reviewed ? "Edit Review" : "Review"}
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

            <div className="panel">
              <div className="panel-header">
                <h3>Checklist</h3>
              </div>

              {checklist.length === 0 ? (
                <div className="empty">No checklist items found.</div>
              ) : (
                <div className="manage-users-table-wrap">
                  <table className="manage-users-table">
                    <thead>
                      <tr>
                        <th>Document Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checklist.map((item, index) => (
                        <tr key={`${item.document_type}-${index}`}>
                          <td>{item.document_type}</td>
                          <td>{item.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Document Trackers</h3>
              </div>

              {trackers.length === 0 ? (
                <div className="empty">No document trackers found.</div>
              ) : (
                <div className="manage-users-table-wrap">
                  <table className="manage-users-table">
                    <thead>
                      <tr>
                        <th>Document Type</th>
                        <th>Tracking Type</th>
                        <th>Status</th>
                        <th>Responsible Party</th>
                        <th>Office</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trackers.map((item) => (
                        <tr key={item.id}>
                          <td>{item.document_type}</td>
                          <td>{item.tracking_type || "-"}</td>
                          <td>{item.status || "-"}</td>
                          <td>{item.responsible_party || "-"}</td>
                          <td>{item.office_department || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Compliance Items</h3>
              </div>

              {complianceItems.length === 0 ? (
                <div className="empty">No compliance items found.</div>
              ) : (
                <div className="manage-users-table-wrap">
                  <table className="manage-users-table">
                    <thead>
                      <tr>
                        <th>Title</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Due Date</th>
                        <th>Responsible Party</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complianceItems.map((item) => (
                        <tr key={item.id}>
                          <td>{item.title}</td>
                          <td>{item.compliance_type}</td>
                          <td>{item.compliance_status || "-"}</td>
                          <td>{item.due_date || "-"}</td>
                          <td>{item.responsible_party || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-header">
                <h3>Warnings / Review Flags</h3>
              </div>

              {(!record.warnings || record.warnings.length === 0) &&
              (!record.review_flags || record.review_flags.length === 0) ? (
                <div className="empty">No warnings or review flags.</div>
              ) : (
                <>
                  <div style={{ marginTop: 12 }}>
                    <strong>Warnings</strong>
                    {renderList(record.warnings || [])}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <strong>Review Flags</strong>
                    {renderList(record.review_flags || [])}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="footer">
            <span>Case Management System • DOJ Prototype</span>
          </div>
        </>
      )}

            {reviewModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card create-account-modal">
            <button
              type="button"
              className="modal-close-btn"
              onClick={() => {
                setReviewModalOpen(false);
                setSelectedDocument(null);
              }}
            >
              ×
            </button>

            <div className="create-account-modal-header">
              <div className="create-account-badge">Document Review</div>
              <h2>Review and Edit Extracted Data</h2>
              <p className="create-account-subtitle">
                Update the extracted fields before confirming the intake case.
              </p>
            </div>

            <form onSubmit={handleSaveReview} className="manage-users-form">
              <div className="form-grid">
                <div className="form-field">
                  <label>Document Type</label>
                  <input
                    value={reviewForm.document_type}
                    onChange={(e) =>
                      handleReviewFieldChange("document_type", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Case Title</label>
                  <input
                    value={reviewForm.case_title}
                    onChange={(e) =>
                      handleReviewFieldChange("case_title", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Docket Number</label>
                  <input
                    value={reviewForm.docket_number}
                    onChange={(e) =>
                      handleReviewFieldChange("docket_number", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Case Number</label>
                  <input
                    value={reviewForm.case_number}
                    onChange={(e) =>
                      handleReviewFieldChange("case_number", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Date Filed</label>
                  <input
                    type="date"
                    value={reviewForm.date_filed}
                    onChange={(e) =>
                      handleReviewFieldChange("date_filed", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Offense / Violation</label>
                  <input
                    value={reviewForm.offense_or_violation}
                    onChange={(e) =>
                      handleReviewFieldChange("offense_or_violation", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Assigned Prosecutor</label>
                  <input
                    value={reviewForm.assigned_prosecutor}
                    onChange={(e) =>
                      handleReviewFieldChange("assigned_prosecutor", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Case Status</label>
                  <input
                    value={reviewForm.case_status}
                    onChange={(e) =>
                      handleReviewFieldChange("case_status", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Prosecution Result</label>
                  <input
                    value={reviewForm.prosecution_result}
                    onChange={(e) =>
                      handleReviewFieldChange("prosecution_result", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Court Result</label>
                  <input
                    value={reviewForm.court_result}
                    onChange={(e) =>
                      handleReviewFieldChange("court_result", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Complainants</label>
                  <input
                    placeholder="Separate with commas"
                    value={reviewForm.complainants}
                    onChange={(e) =>
                      handleReviewFieldChange("complainants", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Respondents</label>
                  <input
                    placeholder="Separate with commas"
                    value={reviewForm.respondents}
                    onChange={(e) =>
                      handleReviewFieldChange("respondents", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Review Flags</label>
                  <input
                    placeholder="Separate with commas"
                    value={reviewForm.review_flags}
                    onChange={(e) =>
                      handleReviewFieldChange("review_flags", e.target.value)
                    }
                  />
                </div>

                <div className="form-field">
                  <label>Review Notes</label>
                  <input
                    value={reviewForm.review_notes}
                    onChange={(e) =>
                      handleReviewFieldChange("review_notes", e.target.value)
                    }
                  />
                </div>
              </div>

              <div className="manage-users-form-actions" style={{ marginTop: 18 }}>
                <button type="submit" className="btn" disabled={reviewLoading}>
                  {reviewLoading ? "Saving..." : "Save Review"}
                </button>

                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => {
                    setReviewModalOpen(false);
                    setSelectedDocument(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </UserLayout>
  );
}
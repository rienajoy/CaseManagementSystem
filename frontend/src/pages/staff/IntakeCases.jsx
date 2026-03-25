// src/pages/staff/IntakeCases.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import UserLayout from "../../components/UserLayout";
import { getStoredUser } from "../../utils/storage";
import {
  createIntakeCase,
  getIntakeCases,
  getStaffProsecutors,
} from "../../services/staffService";

import "../../styles/dashboard.css";

const DEFAULT_FILTERS = {
  search: "",
  case_type: "",
  intake_status: "",
  intake_document_status: "",
  prosecution_result: "",
  assigned_prosecutor_id: "",
  include_drafts: false,
  sort_by: "created_at",
  sort_dir: "desc",
  page: 1,
  per_page: 10,
};

export default function IntakeCases() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [counts, setCounts] = useState(null);
  const [prosecutors, setProsecutors] = useState([]);

  const [caseType, setCaseType] = useState("INV");
  const [reviewNotes, setReviewNotes] = useState("");

  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadCases();
  }, [filters]);

  async function loadInitialData() {
    try {
      const res = await getStaffProsecutors();
      setProsecutors(res?.data?.data?.prosecutors || []);
    } catch (e) {
      console.error("Failed to load prosecutors", e);
    }
  }

  async function loadCases() {
    try {
      setLoading(true);
      setErr("");

      const params = {
        search: filters.search || undefined,
        case_type: filters.case_type || undefined,
        intake_status: filters.intake_status || undefined,
        intake_document_status: filters.intake_document_status || undefined,
        prosecution_result: filters.prosecution_result || undefined,
        assigned_prosecutor_id: filters.assigned_prosecutor_id || undefined,
        include_drafts: filters.include_drafts ? "true" : undefined,
        sort_by: filters.sort_by,
        sort_dir: filters.sort_dir,
        page: filters.page,
        per_page: filters.per_page,
      };

      const res = await getIntakeCases(params);
      const data = res?.data?.data || {};

      setItems(data.intake_cases || []);
      setPagination(data.pagination || null);
      setCounts(data.counts || null);
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load intake cases.");
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(key, value) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === "page" ? value : 1,
    }));
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setMsg("");
    setErr("");

    try {
      setCreating(true);

      await createIntakeCase({
        case_type: caseType,
        review_notes: reviewNotes,
      });

      setMsg("Intake case created successfully.");
      setReviewNotes("");
      setCaseType("INV");
      await loadCases();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to create intake case.");
    } finally {
      setCreating(false);
    }
  }

  const intakeStatusOptions = useMemo(
    () => [
      { value: "", label: "All" },
      { value: "draft", label: "Draft" },
      { value: "needs_review", label: "Needs Review" },
      { value: "for_confirmation", label: "For Confirmation" },
      { value: "active", label: "Active" },
      { value: "awaiting_compliance", label: "Awaiting Compliance" },
      { value: "under_prosecutor_review", label: "Under Prosecutor Review" },
      { value: "resolved_dismissed", label: "Resolved - Dismissed" },
      { value: "resolved_for_filing", label: "Resolved - For Filing" },
      { value: "information_filed", label: "Information Filed" },
      { value: "ready_for_conversion", label: "Ready for Conversion" },
      { value: "converted", label: "Converted" },
    ],
    []
  );

  const intakeDocumentStatusOptions = useMemo(
    () => [
      { value: "", label: "All" },
      { value: "missing_initiating_document", label: "Missing Initiating Document" },
      { value: "documents_need_review", label: "Documents Need Review" },
      { value: "initiating_document_complete", label: "Initiating Document Complete" },
      { value: "pending_subsequent_documents", label: "Pending Subsequent Documents" },
      { value: "awaiting_compliance", label: "Awaiting Compliance" },
      { value: "completed", label: "Completed" },
      { value: "dismissed", label: "Dismissed" },
      { value: "ready_for_conversion", label: "Ready for Conversion" },
    ],
    []
  );

  const prosecutionResultOptions = useMemo(
    () => [
      { value: "", label: "All" },
      { value: "with_probable_cause", label: "With Probable Cause" },
      { value: "no_probable_cause", label: "No Probable Cause" },
    ],
    []
  );

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  return (
    <UserLayout user={user}>
      <div className="welcome-block">
        <div className="page-badge">Staff Module</div>
        <h1>Intake Cases</h1>
        <p className="subtitle">
          Create, filter, review, and manage intake case records.
        </p>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <div className="manage-users-grid">
        <div className="panel create-user-panel">
          <div className="panel-header">
            <div>
              <h3>Create Intake Case</h3>
              <p className="panel-subtitle">
                Start a new intake workflow for INV or INQ.
              </p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="manage-users-form">
            <div className="form-grid">
              <div className="form-field">
                <label>Case Type</label>
                <select
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value)}
                >
                  <option value="INV">INV</option>
                  <option value="INQ">INQ</option>
                </select>
              </div>

              <div className="form-field">
                <label>Review Notes</label>
                <input
                  placeholder="Optional notes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="manage-users-form-actions">
              <button type="submit" className="btn" disabled={creating}>
                {creating ? "Creating..." : "Create Intake Case"}
              </button>
            </div>
          </form>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Intake Case List</h3>
              <p className="panel-subtitle">
                Search, filter, sort, and open intake case records.
              </p>
            </div>

            <div className="manage-users-actions">
              <button className="btn btn-light" onClick={resetFilters}>
                Reset Filters
              </button>
              <button className="btn btn-light" onClick={loadCases}>
                Refresh
              </button>
            </div>
          </div>

          <div className="manage-users-form" style={{ marginBottom: 16 }}>
            <div className="form-grid">
              <div className="form-field">
                <label>Search</label>
                <input
                  placeholder="Search by title, docket no, case no..."
                  value={filters.search}
                  onChange={(e) => updateFilter("search", e.target.value)}
                />
              </div>

              <div className="form-field">
                <label>Case Type</label>
                <select
                  value={filters.case_type}
                  onChange={(e) => updateFilter("case_type", e.target.value)}
                >
                  <option value="">All</option>
                  <option value="INV">INV</option>
                  <option value="INQ">INQ</option>
                </select>
              </div>

              <div className="form-field">
                <label>Intake Status</label>
                <select
                  value={filters.intake_status}
                  onChange={(e) => updateFilter("intake_status", e.target.value)}
                >
                  {intakeStatusOptions.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Document Status</label>
                <select
                  value={filters.intake_document_status}
                  onChange={(e) =>
                    updateFilter("intake_document_status", e.target.value)
                  }
                >
                  {intakeDocumentStatusOptions.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Prosecution Result</label>
                <select
                  value={filters.prosecution_result}
                  onChange={(e) =>
                    updateFilter("prosecution_result", e.target.value)
                  }
                >
                  {prosecutionResultOptions.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Assigned Prosecutor</label>
                <select
                  value={filters.assigned_prosecutor_id}
                  onChange={(e) =>
                    updateFilter("assigned_prosecutor_id", e.target.value)
                  }
                >
                  <option value="">All</option>
                  {prosecutors.map((prosecutor) => (
                    <option
                      key={prosecutor.user_id}
                      value={prosecutor.user_id}
                    >
                      {prosecutor.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-field">
                <label>Sort By</label>
                <select
                  value={filters.sort_by}
                  onChange={(e) => updateFilter("sort_by", e.target.value)}
                >
                  <option value="created_at">Created At</option>
                  <option value="updated_at">Updated At</option>
                  <option value="intake_case_id">Intake Case ID</option>
                  <option value="case_type">Case Type</option>
                  <option value="date_filed">Date Filed</option>
                  <option value="docket_number">Docket Number</option>
                  <option value="case_number">Case Number</option>
                  <option value="case_title">Case Title</option>
                  <option value="assigned_prosecutor">Assigned Prosecutor</option>
                  <option value="intake_status">Intake Status</option>
                  <option value="intake_document_status">Document Status</option>
                  <option value="prosecution_result">Prosecution Result</option>
                  <option value="filed_in_court_date">Filed In Court Date</option>
                  <option value="resolution_date">Resolution Date</option>
                </select>
              </div>

              <div className="form-field">
                <label>Sort Direction</label>
                <select
                  value={filters.sort_dir}
                  onChange={(e) => updateFilter("sort_dir", e.target.value)}
                >
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>

              <div className="form-field">
                <label>Per Page</label>
                <select
                  value={filters.per_page}
                  onChange={(e) => updateFilter("per_page", Number(e.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div
                className="form-field"
                style={{ display: "flex", alignItems: "center", gap: 8 }}
              >
                <input
                  id="include-drafts"
                  type="checkbox"
                  checked={filters.include_drafts}
                  onChange={(e) =>
                    updateFilter("include_drafts", e.target.checked)
                  }
                />
                <label htmlFor="include-drafts" style={{ margin: 0 }}>
                  Include Drafts
                </label>
              </div>
            </div>
          </div>

          {counts && (
            <div className="notes" style={{ marginBottom: 16 }}>
              <ul>
                <li>Filtered Total: {counts.all_filtered ?? 0}</li>
                <li>INV: {counts.inv ?? 0}</li>
                <li>INQ: {counts.inq ?? 0}</li>
                <li>Dismissed: {counts.dismissed ?? 0}</li>
                <li>Drafts: {counts.drafts ?? 0}</li>
              </ul>
            </div>
          )}

          {loading ? (
            <div className="empty">Loading intake cases...</div>
          ) : items.length === 0 ? (
            <div className="empty">No intake cases found.</div>
          ) : (
            <div className="manage-users-table-wrap">
              <table className="manage-users-table">
                <thead>
                  <tr>
                    <th>Intake ID</th>
                    <th>Case Type</th>
                    <th>Case Title</th>
                    <th>Docket Number</th>
                    <th>Case Number</th>
                    <th>Assigned Prosecutor</th>
                    <th>Intake Status</th>
                    <th>Document Status</th>
                    <th>Prosecution Result</th>
                    <th>Updated At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.intake_case_id || "-"}</td>
                      <td>{item.case_type || "-"}</td>
                      <td>{item.case_title || "-"}</td>
                      <td>{item.docket_number || "-"}</td>
                      <td>{item.case_number || "-"}</td>
                      <td>{item.assigned_prosecutor || "-"}</td>
                      <td>{item.intake_status_label || item.intake_status || "-"}</td>
                      <td>
                        {item.intake_document_status_label ||
                          item.intake_document_status ||
                          "-"}
                      </td>
                      <td>{item.prosecution_result || "-"}</td>
                      <td>{item.updated_at || "-"}</td>
                      <td>
                        <div className="manage-users-actions">
                          <button
                            onClick={() =>
                              navigate(`/staff/intake-cases/${item.id}`)
                            }
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

          {pagination && (
            <div
              className="manage-users-actions"
              style={{ marginTop: 16, justifyContent: "space-between" }}
            >
              <div>
                Page {pagination.page} of {pagination.total_pages} • Total{" "}
                {pagination.total}
              </div>

              <div className="manage-users-actions">
                <button
                  className="btn btn-light"
                  disabled={!pagination.has_prev}
                  onClick={() => updateFilter("page", pagination.page - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn btn-light"
                  disabled={!pagination.has_next}
                  onClick={() => updateFilter("page", pagination.page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="footer">
        <span>Case Management System • DOJ Prototype</span>
      </div>
    </UserLayout>
  );
}
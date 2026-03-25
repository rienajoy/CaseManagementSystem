import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RotateCcw, RefreshCw } from "lucide-react";

import api from "../../api";
import UserLayout from "../../components/UserLayout";
import { getStoredUser, setStoredUser } from "../../utils/storage";
import { isAdminLevel, isStaff } from "../../utils/roles";

import "../../styles/staff/intake-cases-page.css";

export default function IntakeCasesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [caseType, setCaseType] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load intake cases page.");
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setCaseType("");
    setReviewNotes("");
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    if (submitting) return;
    setShowCreateModal(false);
  }

  async function handleCreateIntakeCase(e) {
    e.preventDefault();

    if (!caseType) {
      alert("Please select a case type.");
      return;
    }

    try {
      setSubmitting(true);

      // Temporary only:
      // Replace this with your actual backend endpoint later.
      console.log("Create Intake Case payload:", {
        case_type: caseType,
        review_notes: reviewNotes,
      });

      setShowCreateModal(false);

      alert(
        `Intake case creation started.\nCase Type: ${caseType}}`
      );

      // Example future flow:
      // const res = await api.post("/staff/intake-cases", {
      //   case_type: caseType,
      //   review_notes: reviewNotes,
      // });
      //
      // const intakeCaseId = res?.data?.data?.id;
      // navigate(`/staff/intake-cases/${intakeCaseId}`);
    } catch (error) {
      alert(
        error?.response?.data?.message || "Failed to create intake case."
      );
    } finally {
      setSubmitting(false);
    }
  }

    const [filters, setFilters] = useState({
    search: "",
    caseType: "",
    intakeStatus: "",
    intakeDocumentStatus: "",
    prosecutionResult: "",
    assignedProsecutor: "",
    sortBy: "",
    sortDirection: "desc",
    perPage: "10",
    includeDrafts: false,
  });

    function handleFilterChange(e) {
    const { name, value, type, checked } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function handleResetFilters() {
    setFilters({
      search: "",
      caseType: "",
      intakeStatus: "",
      intakeDocumentStatus: "",
      prosecutionResult: "",
      assignedProsecutor: "",
      sortBy: "",
      sortDirection: "desc",
      perPage: "10",
      includeDrafts: false,
    });
  }

  function handleRefreshFilters() {
    // later pwede ni nimo ilisan ug actual refetch logic
    console.log("Refresh filter panel / refetch list");
  }
  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  return (
    <UserLayout user={user}>
      <div className="intake-cases-page">
        <div className="intake-cases-hero">
          <div className="intake-cases-hero-inner">
            <div className="intake-cases-hero-left">
              <div className="intake-cases-page-badge">INTAKE CASES</div>
              <h1 className="intake-cases-title">Intake Cases</h1>
              <p className="intake-cases-subtitle">
                Create, filter, review, and manage intake case records.
              </p>
            </div>

            <div className="intake-cases-hero-actions">
              <button
                className="intake-cases-hero-btn primary"
                onClick={openCreateModal}
              >
                + Add New Intake Case
              </button>

              <button
                className="intake-cases-hero-btn ghost"
                onClick={() => navigate("/staff/dashboard")}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="intake-panel">
            <div className="intake-cases-empty">Loading intake cases...</div>
          </div>
        ) : err ? (
          <div className="intake-panel">
            <div className="intake-cases-empty">{err}</div>
          </div>
        ) : (
          <>
            <div className="intake-panel">
              <div className="intake-panel-header">
                <div>
                  <h3>Intake Cases List</h3>
                  <p className="intake-cases-panel-subtitle">
                    Main entry for new intake and intake monitoring.
                  </p>
                </div>
              </div>

              <div className="intake-filters-layout">
  <div className="intake-filters-card">
    <div className="intake-filters-card-header">
      <div>
        <h4>Filter Panel</h4>
        <p className="intake-cases-panel-subtitle">
          Narrow down intake case records.
        </p>
      </div>

      <div className="intake-filter-icon-actions">
        <button
          type="button"
          className="intake-icon-btn"
          onClick={handleResetFilters}
          title="Reset Filters"
          aria-label="Reset Filters"
        >
          <RotateCcw size={16} />
        </button>

        <button
          type="button"
          className="intake-icon-btn"
          onClick={handleRefreshFilters}
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </div>
    </div>

    <div className="intake-filters-grid">
      <div className="intake-form-group">
        <label htmlFor="search">Search</label>
        <input
          id="search"
          name="search"
          type="text"
          className="intake-form-control"
          placeholder="Search intake ID, title, complainant..."
          value={filters.search}
          onChange={handleFilterChange}
        />
      </div>

      <div className="intake-form-group">
        <label htmlFor="caseType">Case Type</label>
        <select
          id="caseType"
          name="caseType"
          className="intake-form-control"
          value={filters.caseType}
          onChange={handleFilterChange}
        >
          <option value="">All case types</option>
          <option value="INV">Preliminary Investigation (INV)</option>
          <option value="INQ">Inquest Proceedings (INQ)</option>
        </select>
      </div>

      <div className="intake-form-group">
        <label htmlFor="intakeStatus">Intake Status</label>
        <select
          id="intakeStatus"
          name="intakeStatus"
          className="intake-form-control"
          value={filters.intakeStatus}
          onChange={handleFilterChange}
        >
          <option value="">All intake statuses</option>
          <option value="for_review">For Review</option>
          <option value="for_confirmation">For Confirmation</option>
          <option value="ready_for_conversion">Ready for Conversion</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      <div className="intake-form-group">
        <label htmlFor="intakeDocumentStatus">Intake Document Status</label>
        <select
          id="intakeDocumentStatus"
          name="intakeDocumentStatus"
          className="intake-form-control"
          value={filters.intakeDocumentStatus}
          onChange={handleFilterChange}
        >
          <option value="">All document statuses</option>
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
          <option value="pending">Pending Review</option>
        </select>
      </div>

      <div className="intake-form-group">
        <label htmlFor="prosecutionResult">Prosecution Result</label>
        <select
          id="prosecutionResult"
          name="prosecutionResult"
          className="intake-form-control"
          value={filters.prosecutionResult}
          onChange={handleFilterChange}
        >
          <option value="">All prosecution results</option>
          <option value="with_probable_cause">With Probable Cause</option>
          <option value="without_probable_cause">Without Probable Cause</option>
          <option value="dismissed">Dismissed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      <div className="intake-form-group">
        <label htmlFor="assignedProsecutor">Assigned Prosecutor</label>
        <select
          id="assignedProsecutor"
          name="assignedProsecutor"
          className="intake-form-control"
          value={filters.assignedProsecutor}
          onChange={handleFilterChange}
        >
          <option value="">All prosecutors</option>
          <option value="prosecutor_1">Prosecutor 1</option>
          <option value="prosecutor_2">Prosecutor 2</option>
          <option value="prosecutor_3">Prosecutor 3</option>
        </select>
      </div>

      <div className="intake-form-group">
        <label htmlFor="sortBy">Sort By</label>
        <select
          id="sortBy"
          name="sortBy"
          className="intake-form-control"
          value={filters.sortBy}
          onChange={handleFilterChange}
        >
          <option value="">Default sorting</option>
          <option value="created_at">Created Date</option>
          <option value="updated_at">Updated Date</option>
          <option value="case_type">Case Type</option>
          <option value="intake_status">Intake Status</option>
        </select>
      </div>

      <div className="intake-form-group">
        <label htmlFor="sortDirection">Sort Direction</label>
        <select
          id="sortDirection"
          name="sortDirection"
          className="intake-form-control"
          value={filters.sortDirection}
          onChange={handleFilterChange}
        >
          <option value="desc">Descending</option>
          <option value="asc">Ascending</option>
        </select>
      </div>

      <div className="intake-form-group">
        <label htmlFor="perPage">Per Page</label>
        <select
          id="perPage"
          name="perPage"
          className="intake-form-control"
          value={filters.perPage}
          onChange={handleFilterChange}
        >
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>
    </div>

    <label className="intake-checkbox-row">
      <input
        type="checkbox"
        name="includeDrafts"
        checked={filters.includeDrafts}
        onChange={handleFilterChange}
      />
      <span>Include Drafts</span>
    </label>
  </div>
</div>
            </div>

            <div className="intake-cases-footer">
              <span>Case Management System • DOJ Prototype</span>
            </div>
          </>
        )}

        {showCreateModal && (
          <div
            className="intake-modal-backdrop"
            onClick={closeCreateModal}
          >
            <div
              className="intake-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="intake-modal-header">
                <div>
                  <h3>Create Intake Case</h3>
                </div>

                <button
                  type="button"
                  className="intake-modal-close"
                  onClick={closeCreateModal}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateIntakeCase}>
                <div className="intake-modal-body">
                  <div className="intake-form-group">
                    <label htmlFor="caseType">Case Type</label>
                    <select
                      id="caseType"
                      className="intake-form-control"
                      value={caseType}
                      onChange={(e) => setCaseType(e.target.value)}
                    >
                      <option value="">Select case type</option>
                      <option value="INV">
                        Preliminary Investigation (INV)
                      </option>     
                      <option value="INQ">
                        Inquest Proceedings (INQ)
                      </option>
                    </select>
                  </div>
                </div>

                <div className="intake-modal-footer">
                  <button
                    type="button"
                    className="intake-modal-btn secondary"
                    onClick={closeCreateModal}
                    disabled={submitting}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="intake-modal-btn primary"
                    disabled={submitting}
                  >
                    {submitting ? "Creating..." : "Create Intake Case"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
}
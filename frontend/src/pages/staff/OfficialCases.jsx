// src/pages/staff/OfficialCases.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import UserLayout from "../../components/UserLayout";
import SearchBar from "../../components/staff/SearchBar";
import { getStoredUser } from "../../utils/storage";
import {
  getOfficialCases,
  getStaffCaseOptions,
} from "../../services/staffService";
import "../../styles/staff/intake-cases-page.css";

export default function OfficialCases() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const [options, setOptions] = useState({
    case_types: [],
    official_case_statuses: [],
    court_result_values: [],
  });

  const [searchInput, setSearchInput] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [filters, setFilters] = useState({
    search: "",
    case_type: "",
    case_status: "",
    prosecution_result: "",
    court_result: "",
    case_origin: "",
    assigned_prosecutor_id: "",
    sort_by: "created_at",
    sort_dir: "desc",
    per_page: 10,
  });

  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    total_pages: 1,
  });

  useEffect(() => {
    loadOptions();
  }, []);

  useEffect(() => {
    loadCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pagination.page,
    filters.per_page,
    filters.search,
    filters.case_type,
    filters.case_status,
    filters.prosecution_result,
    filters.court_result,
    filters.case_origin,
    filters.assigned_prosecutor_id,
    filters.sort_by,
    filters.sort_dir,
  ]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === searchInput) return prev;
        return {
          ...prev,
          search: searchInput,
        };
      });

      setPagination((prev) => {
        if (prev.page === 1) return prev;
        return {
          ...prev,
          page: 1,
        };
      });
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  async function loadOptions() {
    try {
      const res = await getStaffCaseOptions();
      const data = res?.data?.data || {};

      setOptions({
        case_types: data.case_types || [],
        official_case_statuses: data.official_case_statuses || [],
        court_result_values: data.court_result_values || [],
      });
    } catch (error) {
      console.error("Failed to load case options:", error);
    }
  }

async function loadCases() {
  try {
    if (!rows.length) {
      setPageLoading(true);
    } else {
      setIsRefreshing(true);
    }

    setErr("");

    const res = await getOfficialCases({
      page: pagination.page,
      per_page: filters.per_page,
      search: filters.search,
      case_type: filters.case_type,
      case_status: filters.case_status,
      prosecution_result: filters.prosecution_result,
      court_result: filters.court_result,
      case_origin: filters.case_origin,
      assigned_prosecutor_id: filters.assigned_prosecutor_id,
      sort_by: filters.sort_by,
      sort_dir: filters.sort_dir,
    });

    const data = res?.data?.data || {};
    setRows(Array.isArray(data.cases) ? data.cases : []);

    const meta = data.pagination || {};
    setPagination((prev) => {
      const nextPage = Number(meta.page || 1);
      const nextPerPage = Number(meta.per_page || filters.per_page || 10);
      const nextTotal = Number(meta.total || 0);
      const nextTotalPages = Number(meta.total_pages || 1);

      if (
        prev.page === nextPage &&
        prev.per_page === nextPerPage &&
        prev.total === nextTotal &&
        prev.total_pages === nextTotalPages
      ) {
        return prev;
      }

      return {
        ...prev,
        page: nextPage,
        per_page: nextPerPage,
        total: nextTotal,
        total_pages: nextTotalPages,
      };
    });
  } catch (error) {
    console.error("Failed to load official cases:", error);
    setErr(error?.response?.data?.message || "Failed to load official cases.");
  } finally {
    setPageLoading(false);
    setIsRefreshing(false);
  }
}

  function handleFilterChange(e) {
    const { name, value } = e.target;

    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));

    setPagination((prev) => {
      if (prev.page === 1) return prev;
      return { ...prev, page: 1 };
    });
  }

  function formatDateOnly(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString();
  }

  function toDisplayValue(value, fallback = "—") {
    if (value === null || value === undefined || value === "") return fallback;
    if (Array.isArray(value)) return value.join(", ") || fallback;
    return String(value);
  }

  function openCaseDetails(item) {
    if (!item?.id) return;
    navigate(`/staff/cases/${item.id}`);
  }

  if (!user) return <div style={{ padding: 20 }}>Redirecting...</div>;

  return (
    <UserLayout
      user={user}
      sectionBadge="OFFICIAL CASES"
      pageTitle="Official Cases"
      pageSubtitle="Manage official cases, filings, and court activity."
    >
      <div className="intake-page-shell">
        <div className="intake-actions-row">
          <div className="intake-actions-left">
            <SearchBar
              value={searchInput}
              onSearch={setSearchInput}
              placeholder="Search case no., docket no., title, offense..."
              className="intake-page-search"
              debounceMs={350}
            />
          </div>
        </div>

        <div className="intake-filters-layout">
          <div className="intake-filters-shell">
            <div className="intake-filter-section-grid">
              <div className="intake-form-group">
                <label>Case Type</label>
                <select
                  name="case_type"
                  className="intake-form-control"
                  value={filters.case_type}
                  onChange={handleFilterChange}
                >
                  <option value="">All</option>
                  {options.case_types.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="intake-form-group">
                <label>Case Status</label>
                <select
                  name="case_status"
                  className="intake-form-control"
                  value={filters.case_status}
                  onChange={handleFilterChange}
                >
                  <option value="">All</option>
                  {options.official_case_statuses.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="intake-form-group">
                <label>Prosecution Result</label>
                <input
                  name="prosecution_result"
                  className="intake-form-control"
                  value={filters.prosecution_result}
                  onChange={handleFilterChange}
                  placeholder="e.g. with_probable_cause"
                />
              </div>

              <div className="intake-form-group">
                <label>Court Result</label>
                <select
                  name="court_result"
                  className="intake-form-control"
                  value={filters.court_result}
                  onChange={handleFilterChange}
                >
                  <option value="">All</option>
                  {options.court_result_values.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="intake-form-group">
                <label>Case Origin</label>
                <select
                  name="case_origin"
                  className="intake-form-control"
                  value={filters.case_origin}
                  onChange={handleFilterChange}
                >
                  <option value="">All</option>
                  <option value="intake_case">Converted Intake Case</option>
                  <option value="legacy_encoding">Legacy Encoding</option>
                </select>
              </div>

              <div className="intake-form-group">
                <label>Sort By</label>
                <select
                  name="sort_by"
                  className="intake-form-control"
                  value={filters.sort_by}
                  onChange={handleFilterChange}
                >
                  <option value="created_at">Created At</option>
                  <option value="case_number">Case Number</option>
                  <option value="docket_number">Docket Number</option>
                  <option value="case_title">Case Title</option>
                  <option value="filed_in_court_date">Filed in Court Date</option>
                  <option value="resolution_date">Resolution Date</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="intake-panel intake-workspace-panel">
          {pageLoading ? (
            <div className="intake-cases-empty">Loading official cases...</div>
          ) : err && !rows.length ? (
            <div className="intake-cases-empty">{err}</div>
          ) : (
            <div className="intake-table-shell">
              {isRefreshing ? (
                <div className="small-spinner">Refreshing...</div>
              ) : null}

              <table className="intake-table">
                <thead>
                  <tr>
                    <th>Case No.</th>
                    <th>Docket No.</th>
                    <th>Case Title</th>
                    <th>Assigned Prosecutor</th>
                    <th>Case Status</th>
                    <th>Prosecution Result</th>
                    <th>Court Result</th>
                    <th>Filed in Court</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length > 0 ? (
                    rows.map((item) => (
                      <tr key={item.id}>
                        <td>{toDisplayValue(item.case_number)}</td>
                        <td>{toDisplayValue(item.docket_number)}</td>
                        <td>{toDisplayValue(item.case_title)}</td>
                        <td>
                          {toDisplayValue(
                            item.assigned_prosecutor_name ||
                              item.assigned_prosecutor_label
                          )}
                        </td>
                        <td>
                          {toDisplayValue(
                            item.case_status_label || item.case_status
                          )}
                        </td>
                        <td>{toDisplayValue(item.prosecution_result)}</td>
                        <td>{toDisplayValue(item.court_result)}</td>
                        <td>{formatDateOnly(item.filed_in_court_date)}</td>
                        <td>
                          <button
                            type="button"
                            className="intake-inline-action-btn"
                            onClick={() => openCaseDetails(item)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="intake-table-empty-cell">
                        No official cases found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="intake-pagination">
                <button
                  type="button"
                  className="intake-pagination-btn"
                  disabled={pagination.page <= 1}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                  }
                >
                  Previous
                </button>

                <div className="intake-pagination-meta">
                  <span className="intake-pagination-page">
                    Page {pagination.page} of {pagination.total_pages}
                  </span>
                  <span className="intake-pagination-total">
                    Total {pagination.total}
                  </span>
                </div>

                <button
                  type="button"
                  className="intake-pagination-btn"
                  disabled={pagination.page >= pagination.total_pages}
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </UserLayout>
  );
}
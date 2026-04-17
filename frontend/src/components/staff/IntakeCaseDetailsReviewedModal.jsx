import { useEffect, useMemo, useState } from "react";
import {
  getIntakeCaseDocument,
  reviewIntakeCaseDocument,
} from "../../services/staffService";
import "../../styles/staff/document-review-modal.css";
import "../../styles/staff/ReviewedDataModal.css";

const REVIEW_FORM_DEFAULTS = {
  document_type: "",
  case_title: "",
  docket_number: "",
  case_number: "",
  date_filed: "",
  offense_or_violation: "",
  assigned_prosecutor: "",
  assigned_prosecutor_id: "",
  case_status: "",
  prosecution_result: "",
  court_result: "",
  resolution_date: "",
  filed_in_court_date: "",
  court_branch: "",
  complainants: "",
  respondents: "",
  review_flags: "",
  review_notes: "",
};

const FIELD_SECTIONS = [
  {
    key: "case_info",
    title: "Case Identification",
    columns: 3,
    fields: [
      { key: "document_type", label: "Document Type" },
      { key: "case_title", label: "Case Title", span: 2 },
      { key: "docket_number", label: "Docket Number", required: true },
      { key: "case_number", label: "Case Number" },
      { key: "date_filed", label: "Date Filed", type: "date" },
      { key: "offense_or_violation", label: "Offense / Violation", span: 2 },
    ],
  },
  {
    key: "assignment",
    title: "Assignment & Status",
    columns: 4,
    fields: [
      {
        key: "assigned_prosecutor_id",
        label: "Assigned Prosecutor",
        type: "prosecutor-select",
      },
      { key: "case_status", label: "Case Status" },
      { key: "prosecution_result", label: "Prosecution Result" },
      { key: "court_result", label: "Court Result" },
      { key: "resolution_date", label: "Resolution Date", type: "date" },
      { key: "filed_in_court_date", label: "Filed in Court Date", type: "date" },
      { key: "court_branch", label: "Court Branch", span: 2 },
    ],
  },
  {
    key: "parties",
    title: "Parties & Review Notes",
    columns: 3,
    fields: [
      {
        key: "complainants",
        label: "Complainants",
        placeholder: "Separate with commas",
      },
      {
        key: "respondents",
        label: "Respondents",
        placeholder: "Separate with commas",
      },
      {
        key: "review_flags",
        label: "Review Flags",
        placeholder: "Separate with commas",
      },
      {
        key: "review_notes",
        label: "Review Notes",
        type: "textarea",
        fullWidth: true,
      },
    ],
  },
];

function normalizeListForInput(value) {
  if (!value) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function normalizeDateForInput(value) {
  if (!value) return "";
  const str = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildReviewFormFromDocument(doc, reviewContext = {}) {
  const reviewed = doc?.reviewed_data || {};
  const editableDefaults = reviewContext?.editable_review_defaults || {};
  const extractedMeta =
    reviewContext?.current_extracted_data ||
    doc?.extracted_data?.metadata ||
    {};

  const detectedDocumentType =
    reviewContext?.detected_document_type ||
    extractedMeta?.document_type ||
    doc?.detected_document_type ||
    doc?.document_type ||
    "";

  const base =
    Object.keys(reviewed).length > 0
      ? reviewed
      : Object.keys(editableDefaults).length > 0
      ? editableDefaults
      : extractedMeta;

  return {
    ...REVIEW_FORM_DEFAULTS,
    document_type: detectedDocumentType,
    case_title: base.case_title || "",
    docket_number: base.docket_number || "",
    case_number: base.case_number || "",
    date_filed: normalizeDateForInput(base.date_filed),
    offense_or_violation: base.offense_or_violation || "",
    assigned_prosecutor: base.assigned_prosecutor || "",
    assigned_prosecutor_id: base.assigned_prosecutor_id
      ? String(base.assigned_prosecutor_id)
      : "",
    case_status: base.case_status || "",
    prosecution_result: base.prosecution_result || "",
    court_result: base.court_result || "",
    resolution_date: normalizeDateForInput(base.resolution_date),
    filed_in_court_date: normalizeDateForInput(base.filed_in_court_date),
    court_branch: base.court_branch || "",
    complainants: normalizeListForInput(base.complainants),
    respondents: normalizeListForInput(base.respondents),
    review_flags: normalizeListForInput(base.review_flags),
    review_notes: doc?.review_notes || "",
  };
}

export default function IntakeCaseDetailsReviewedModal({
  isOpen,
  documentId,
  intakeCaseId,
  prosecutorOptions = [],
  onClose,
  onSaved,
}) {
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [reviewForm, setReviewForm] = useState(REVIEW_FORM_DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [err, setErr] = useState("");
  const [showDocketRequiredModal, setShowDocketRequiredModal] = useState(false);

  useEffect(() => {
    if (!isOpen || !documentId) return;
    loadDocument();
  }, [isOpen, documentId]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedDocument(null);
      setReviewForm(REVIEW_FORM_DEFAULTS);
      setLoading(false);
      setSaving(false);
      setEditMode(false);
      setErr("");
      setShowDocketRequiredModal(false);
    }
  }, [isOpen]);

  const selectedProsecutorName = useMemo(() => {
    if (!reviewForm.assigned_prosecutor_id) {
      return reviewForm.assigned_prosecutor || "";
    }

    const match = prosecutorOptions.find(
      (item) => String(item.id) === String(reviewForm.assigned_prosecutor_id)
    );

    return match?.name || reviewForm.assigned_prosecutor || "";
  }, [
    prosecutorOptions,
    reviewForm.assigned_prosecutor,
    reviewForm.assigned_prosecutor_id,
  ]);

  const complainantsText = useMemo(() => {
    if (!reviewForm.complainants) return "—";
    return reviewForm.complainants;
  }, [reviewForm.complainants]);

  const respondentsText = useMemo(() => {
    if (!reviewForm.respondents) return "—";
    return reviewForm.respondents;
  }, [reviewForm.respondents]);


  
async function loadDocument() {
  try {
    setLoading(true);
    setErr("");

    const res = await getIntakeCaseDocument(documentId);
    const payload = res?.data?.data || {};
    const doc = payload?.document || null;
    const reviewContext = payload?.review_context || {};

    setSelectedDocument(doc);
    setReviewForm(buildReviewFormFromDocument(doc, reviewContext));
    setEditMode(false);
  } catch (e) {
    setErr(e?.response?.data?.message || "Failed to load reviewed document.");
  } finally {
    setLoading(false);
  }
}

  function handleFieldChange(key, value) {
    setReviewForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function handleAssignedProsecutorChange(value) {
    const selected = prosecutorOptions.find(
      (item) => String(item.id) === String(value)
    );

    setReviewForm((prev) => ({
      ...prev,
      assigned_prosecutor_id: value,
      assigned_prosecutor: selected?.name || "",
    }));
  }

  function buildPayload() {
    const docketNumber = String(reviewForm.docket_number || "").trim();

    return {
      reviewed_data: {
        document_type: reviewForm.document_type,
        case_title: reviewForm.case_title,
        docket_number: docketNumber,
        case_number: reviewForm.case_number,
        date_filed: reviewForm.date_filed,
        offense_or_violation: reviewForm.offense_or_violation,
        assigned_prosecutor: selectedProsecutorName,
        assigned_prosecutor_id: reviewForm.assigned_prosecutor_id
          ? Number(reviewForm.assigned_prosecutor_id)
          : null,
        case_status: reviewForm.case_status,
        prosecution_result: reviewForm.prosecution_result,
        court_result: reviewForm.court_result,
        resolution_date: reviewForm.resolution_date,
        filed_in_court_date: reviewForm.filed_in_court_date,
        court_branch: reviewForm.court_branch,
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
  }

  async function handleSave() {
    if (!selectedDocument?.id) return;

    const docketNumber = String(reviewForm.docket_number || "").trim();
    if (!docketNumber) {
      setShowDocketRequiredModal(true);
      return;
    }

    try {
      setSaving(true);
      setErr("");

      const payload = buildPayload();
      await reviewIntakeCaseDocument(selectedDocument.id, payload);

      const nextPayload = {
        document: {
          ...selectedDocument,
          reviewed_data: payload.reviewed_data,
          review_notes: payload.review_notes,
        },
        reviewedData: payload.reviewed_data,
        reviewNotes: payload.review_notes,
        intakeCaseId:
          selectedDocument?.intake_case_id ||
          selectedDocument?.intakeCaseId ||
          selectedDocument?.intake_case?.id ||
          null,
      };

      setSelectedDocument((prev) =>
        prev
          ? {
              ...prev,
              reviewed_data: payload.reviewed_data,
              review_notes: payload.review_notes,
            }
          : prev
      );

      setEditMode(false);
      onSaved?.(nextPayload);
    } catch (e) {
      setErr(
        e?.response?.data?.message ||
          e?.response?.data?.errors?.[0] ||
          "Failed to save reviewed data."
      );
    } finally {
      setSaving(false);
    }
  }

  function renderField(field) {
    const commonProps = {
      id: field.key,
      name: field.key,
      value: reviewForm[field.key] || "",
      onChange: (e) => handleFieldChange(field.key, e.target.value),
      placeholder: field.placeholder || "",
      className: "intake-review-control",
      disabled: !editMode,
      readOnly: !editMode,
    };

    if (field.key === "document_type") {
      return (
        <input
          {...commonProps}
          type="text"
          disabled
          readOnly
          className="intake-review-control intake-review-control-readonly"
        />
      );
    }

    if (field.type === "textarea") {
      return <textarea {...commonProps} rows={3} />;
    }

    if (field.type === "date") {
      return <input type="date" {...commonProps} />;
    }

    if (field.type === "prosecutor-select") {
      return (
        <select
          id={field.key}
          name="assigned_prosecutor_id"
          className="intake-review-control"
          value={reviewForm.assigned_prosecutor_id || ""}
          onChange={(e) => handleAssignedProsecutorChange(e.target.value)}
          disabled={!editMode || prosecutorOptions.length === 0}
        >
          <option value="">
            {prosecutorOptions.length === 0
              ? "No prosecutors available"
              : "Select prosecutor"}
          </option>
          {prosecutorOptions.map((item, index) => (
            <option key={item.id ?? index} value={item.id ?? ""}>
              {item.name}
            </option>
          ))}
        </select>
      );
    }

    return <input {...commonProps} type="text" />;
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="reviewed-modal-backdrop" onClick={onClose}>
        <div className="reviewed-modal" onClick={(e) => e.stopPropagation()}>
          <div className="intake-details-modal-header reviewed-data-header-premium">
            <div className="reviewed-data-header-shell">
              <div className="reviewed-data-header-top">
                <div className="reviewed-data-heading-block">
                  <div className="intake-details-eyebrow">Reviewed Data</div>
                  <p className="reviewed-data-subtitle reviewed-data-subtitle-compact">
                    {editMode
                      ? "Edit the saved reviewed data for this intake case document."
                      : "View the last saved reviewed data for this intake case document."}
                  </p>
                </div>

                <div className="reviewed-data-right-stack">
                  <div className="reviewed-data-right-top">
                    <div className="reviewed-data-intake-ref">
                      <span className="reviewed-data-intake-ref-label">
                        Intake No.
                      </span>
                      <strong className="reviewed-data-intake-ref-badge">
                        {intakeCaseId || "—"}
                      </strong>
                    </div>

                    <button
                      type="button"
                      className="reviewed-modal-close"
                      onClick={onClose}
                    >
                      ×
                    </button>
                  </div>

                  <h3 className="reviewed-data-title reviewed-data-title-compact">
                    {reviewForm.case_title || "Reviewed Intake Data"}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          <div className="reviewed-modal-body">
            {loading ? (
              <div className="intake-review-loading">
                Loading reviewed document data...
              </div>
            ) : (
              <>
                {err ? <div className="intake-review-error">{err}</div> : null}

                {!editMode ? (
                  <>
                    <div className="intake-details-grid">
                      <div className="intake-details-card">
                        <h4>Case Identification</h4>
                        <div className="intake-details-list">
                          <div className="intake-details-item">
                            <span>Document Type</span>
                            <strong>{reviewForm.document_type || "—"}</strong>
                          </div>
                          <div className="intake-details-item">
                            <span>Docket Number</span>
                            <strong>{reviewForm.docket_number || "—"}</strong>
                          </div>
                          <div className="intake-details-item">
                            <span>Case Number</span>
                            <strong>{reviewForm.case_number || "—"}</strong>
                          </div>
                          <div className="intake-details-item">
                            <span>Date Filed</span>
                            <strong>{reviewForm.date_filed || "—"}</strong>
                          </div>
                        </div>
                      </div>

                      <div className="intake-details-card">
                        <h4>Assignment & Status</h4>
                        <div className="intake-details-list">
                          <div className="intake-details-item">
                            <span>Assigned Prosecutor</span>
                            <strong>{selectedProsecutorName || "—"}</strong>
                          </div>
                          <div className="intake-details-item">
                            <span>Case Status</span>
                            <strong>{reviewForm.case_status || "—"}</strong>
                          </div>
                          <div className="intake-details-item">
                            <span>Prosecution Result</span>
                            <strong>{reviewForm.prosecution_result || "—"}</strong>
                          </div>
                          <div className="intake-details-item">
                            <span>Court Result</span>
                            <strong>{reviewForm.court_result || "—"}</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="intake-details-card intake-details-card-full">
                      <h4>Case Summary</h4>
                      <div className="intake-details-list">
                        <div className="intake-details-item">
                          <span>Case Title</span>
                          <strong>{reviewForm.case_title || "—"}</strong>
                        </div>
                        <div className="intake-details-item">
                          <span>Offense / Violation</span>
                          <strong>{reviewForm.offense_or_violation || "—"}</strong>
                        </div>
                        <div className="intake-details-item">
                          <span>Complainants</span>
                          <strong>{complainantsText}</strong>
                        </div>
                        <div className="intake-details-item">
                          <span>Respondents</span>
                          <strong>{respondentsText}</strong>
                        </div>
                        <div className="intake-details-item">
                          <span>Resolution Date</span>
                          <strong>{reviewForm.resolution_date || "—"}</strong>
                        </div>
                        <div className="intake-details-item">
                          <span>Filed in Court Date</span>
                          <strong>{reviewForm.filed_in_court_date || "—"}</strong>
                        </div>
                        <div className="intake-details-item">
                          <span>Court Branch</span>
                          <strong>{reviewForm.court_branch || "—"}</strong>
                        </div>
                        <div className="intake-details-item">
                          <span>Review Notes</span>
                          <strong>{reviewForm.review_notes || "—"}</strong>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="intake-review-form-shell">
                    <div className="intake-review-form-body">
                      {FIELD_SECTIONS.map((section) => (
                        <section key={section.key} className="intake-review-section">
                          <div className="intake-review-section-header">
                            <h4>{section.title}</h4>
                          </div>

                          <div
                            className={`intake-review-grid intake-review-grid-${
                              section.columns || 3
                            }`}
                          >
                            {section.fields.map((field) => (
                              <div
                                key={field.key}
                                className={[
                                  "intake-review-field",
                                  field.fullWidth ? "intake-review-field-full" : "",
                                  field.span
                                    ? `intake-review-field-span-${field.span}`
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              >
                                <label htmlFor={field.key}>
                                  {field.label}
                                  {field.required ? " *" : ""}
                                </label>
                                {renderField(field)}
                              </div>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="reviewed-modal-footer">
            {!editMode ? (
              <>
                <button
                  type="button"
                  className="reviewed-modal-btn secondary"
                  onClick={onClose}
                >
                  Done
                </button>

              </>
            ) : (
              <>
                <button
                  type="button"
                  className="reviewed-modal-btn secondary"
                  onClick={() => {
                    if (selectedDocument) {
                      setReviewForm(buildReviewFormFromDocument(selectedDocument));
                    }
                    setEditMode(false);
                    setErr("");
                  }}
                  disabled={saving}
                >
                  Cancel Edit
                </button>

                <button
                  type="button"
                  className="reviewed-modal-btn primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showDocketRequiredModal ? (
        <div className="intake-submodal-backdrop">
          <div className="intake-submodal" role="dialog" aria-modal="true">
            <div className="intake-submodal-header">
              <h4>Docket Number Required</h4>
            </div>

            <div className="intake-submodal-body">
              <p>
                Please enter the assigned docket number before saving the reviewed
                data.
              </p>
            </div>

            <div className="intake-submodal-footer">
              <button
                type="button"
                className="intake-review-btn primary"
                onClick={() => setShowDocketRequiredModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
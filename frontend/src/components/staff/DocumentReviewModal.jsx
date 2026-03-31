import { useEffect, useMemo, useState } from "react";
import {
  getIntakeCaseDocument,
  reviewIntakeCaseDocument,
} from "../../services/staffService";
import "../../styles/staff/document-review-modal.css";

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
    title: "Case Information",
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

export default function DocumentReviewModal({
  isOpen,
  documentId,
  prosecutorOptions = [],
  onClose,
  onSaved,
}) {
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [errors, setErrors] = useState({});
  const [reviewForm, setReviewForm] = useState(REVIEW_FORM_DEFAULTS);

  const [reviewContext, setReviewContext] = useState({
  latest_saved_reviewed_data: {},
  current_extracted_data: {},
  merged_review_defaults: {},
  field_sources: {},
  case_summary: {},
});

  const [showDocketRequiredModal, setShowDocketRequiredModal] = useState(false);

  useEffect(() => {
    if (!isOpen || !documentId) return;
    loadDocument();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, documentId]);

useEffect(() => {
  if (!isOpen) {
    setSelectedDocument(null);
    setReviewForm(REVIEW_FORM_DEFAULTS);
    setErrors({});
    setSaving(false);
    setLoading(false);

    setReviewContext({
      latest_saved_reviewed_data: {},
      current_extracted_data: {},
      merged_review_defaults: {},
      field_sources: {},
      case_summary: {},
    });
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

  function buildReviewFormFromDocument(doc) {
    const reviewed = doc?.reviewed_data || {};
    const extractedMeta = doc?.extracted_data?.metadata || {};
    const base = Object.keys(reviewed).length ? reviewed : extractedMeta;

    return {
      ...REVIEW_FORM_DEFAULTS,
      document_type: doc?.document_type || "",
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

  async function loadDocument() {
    try {
      setLoading(true);
      setErr("");

const res = await getIntakeCaseDocument(documentId);
const payload = res?.data?.data || {};

const doc = payload?.document || null;
const nextReviewContext = payload?.review_context || {
  latest_saved_reviewed_data: {},
  current_extracted_data: {},
  merged_review_defaults: {},
  field_sources: {},
  case_summary: {},
};

setSelectedDocument(doc);
setReviewContext(nextReviewContext);
setReviewForm(buildReviewFormFromDocument(doc, nextReviewContext));

    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load document for review.");
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

  function handleAttemptClose() {
    onClose?.();
  }

  async function handleSaveReview(e) {
    e.preventDefault();

    if (!selectedDocument?.id) return;

    const docketNumber = String(reviewForm.docket_number || "").trim();

    if (!docketNumber) {
      setErr("");
      setShowDocketRequiredModal(true);
      return;
    }

    try {
      setSaving(true);
      setErr("");

      const payload = buildPayload();

      await reviewIntakeCaseDocument(selectedDocument.id, payload);

      onSaved?.({
        document: selectedDocument,
        reviewedData: payload.reviewed_data,
        reviewNotes: payload.review_notes,
        intakeCaseId:
          selectedDocument?.intake_case_id ||
          selectedDocument?.intakeCaseId ||
          selectedDocument?.intake_case?.id ||
          null,
      });
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
      id: field.id || field.key,
      name: field.key,
      value: reviewForm[field.key] || "",
      onChange: (e) => handleFieldChange(field.key, e.target.value),
      placeholder: field.placeholder || "",
      className: "intake-review-control",
    };

    if (field.key === "document_type") {
      return (
        <input
          {...commonProps}
          type="text"
          readOnly
          disabled
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
          id={field.id || field.key}
          name="assigned_prosecutor_id"
          className="intake-review-control"
          value={reviewForm.assigned_prosecutor_id || ""}
          onChange={(e) => handleAssignedProsecutorChange(e.target.value)}
          disabled={prosecutorOptions.length === 0}
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

    return <input {...commonProps} />;
  }

  if (!isOpen) return null;
function getFieldSourceMeta(fieldKey) {
  const source = reviewContext?.field_sources?.[fieldKey] || "empty";

  if (source === "current_reviewed") {
    return { label: "Already saved on this document", className: "is-current-reviewed" };
  }

  if (source === "previous_review") {
    return { label: "Pre-filled from last review", className: "is-previous-review" };
  }

  if (source === "current_extracted") {
    return { label: "Detected in this document", className: "is-current-extracted" };
  }

  return { label: "No value detected", className: "is-empty" };
}

  return (
    <>
      <div className="intake-review-modal-backdrop">
        <div
          className="intake-review-modal intake-review-modal-wide"
          role="dialog"
          aria-modal="true"
          aria-labelledby="intake-review-title"
        >
          <div className="intake-review-modal-header">
            <div>
              <div className="intake-review-eyebrow">Document Review</div>
              <h3 id="intake-review-title">Review Extracted Data</h3>
              <p>Edit the extracted values before confirming the intake case.</p>
            </div>

            <button
              type="button"
              className="intake-review-close-btn"
              onClick={handleAttemptClose}
              aria-label="Close review modal"
            >
              ×
            </button>
          </div>

          {loading ? (
            <div className="intake-review-loading">
              Loading document review data...
            </div>
          ) : (
            <form onSubmit={handleSaveReview} className="intake-review-form-shell">
              <div className="intake-review-form-body">
                {err ? <div className="intake-review-error">{err}</div> : null}

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

{(() => {
  const sourceMeta = getFieldSourceMeta(field.key);
  return (
    <div className={`intake-review-field-source ${sourceMeta.className}`}>
      {sourceMeta.label}
    </div>
  );
})()}
                          {renderField({ ...field, id: field.key })}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              <div className="intake-review-footer">
                <button
                  type="button"
                  className="intake-review-btn secondary"
                  onClick={handleAttemptClose}
                >
                  Close
                </button>

                <button
                  type="submit"
                  className="intake-review-btn primary"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Review"}
                </button>
              </div>
            </form>
          )}
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
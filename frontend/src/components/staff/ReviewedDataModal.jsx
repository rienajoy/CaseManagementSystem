import { useMemo } from "react";

import "../../styles/staff/ReviewedDataModal.css";
export default function ReviewedDataModal({
  isOpen,
  payload,
  intakeCaseId,
  confirming,
  onClose,
  onConfirm,
}) {
  const reviewedData = payload?.reviewedData || {};

 const intakeDisplayId =
  payload?.intakeCase?.intake_case_id ||
  intakeCaseId ||
  "—";

  const complainantsText = useMemo(() => {
    return Array.isArray(reviewedData?.complainants) &&
      reviewedData.complainants.length > 0
      ? reviewedData.complainants.join(", ")
      : "—";
  }, [reviewedData?.complainants]);

  const respondentsText = useMemo(() => {
    return Array.isArray(reviewedData?.respondents) &&
      reviewedData.respondents.length > 0
      ? reviewedData.respondents.join(", ")
      : "—";
  }, [reviewedData?.respondents]);

  if (!isOpen || !payload) return null;

  return (
    <div className="reviewed-modal-backdrop" onClick={onClose}>
  <div
    className="reviewed-modal"
        onClick={(e) => e.stopPropagation()}
      >
<div className="intake-details-modal-header reviewed-data-header-premium">
  <div className="reviewed-data-header-shell">
    <div className="reviewed-data-header-top">
      <div className="reviewed-data-heading-block">
        <div className="intake-details-eyebrow">Reviewed Data</div>
        <p className="reviewed-data-subtitle reviewed-data-subtitle-compact">
          Review complete intake case information before confirming this intake case.
        </p>
      </div>

      <div className="reviewed-data-right-stack">
        <div className="reviewed-data-right-top">
          <div className="reviewed-data-intake-ref">
            <span className="reviewed-data-intake-ref-label">Intake No.</span>
            <strong className="reviewed-data-intake-ref-badge">
              {intakeDisplayId}
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
          {reviewedData?.case_title || "Reviewed Intake Data"}
        </h3>
      </div>
    </div>
  </div>
</div>

        <div className="reviewed-modal-body">
          <div className="intake-details-grid">
            <div className="intake-details-card">
              <h4>Case Identification</h4>
              <div className="intake-details-list">
                <div className="intake-details-item">
                  <span>Document Type</span>
                  <strong>{reviewedData?.document_type || "—"}</strong>
                </div>

                <div className="intake-details-item">
                  <span>Docket Number</span>
                  <strong>{reviewedData?.docket_number || "—"}</strong>
                </div>

                <div className="intake-details-item">
                  <span>Case Number</span>
                  <strong>{reviewedData?.case_number || "—"}</strong>
                </div>

                <div className="intake-details-item">
                  <span>Date Filed</span>
                  <strong>{reviewedData?.date_filed || "—"}</strong>
                </div>
              </div>
            </div>

            <div className="intake-details-card">
              <h4>Assignment & Status</h4>
              <div className="intake-details-list">
                <div className="intake-details-item">
                  <span>Assigned Prosecutor</span>
                  <strong>{reviewedData?.assigned_prosecutor || "—"}</strong>
                </div>

                <div className="intake-details-item">
                  <span>Case Status</span>
                  <strong>{reviewedData?.case_status || "—"}</strong>
                </div>

                <div className="intake-details-item">
                  <span>Prosecution Result</span>
                  <strong>{reviewedData?.prosecution_result || "—"}</strong>
                </div>

                <div className="intake-details-item">
                  <span>Court Result</span>
                  <strong>{reviewedData?.court_result || "—"}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="intake-details-card intake-details-card-full">
            <h4>Case Summary</h4>
            <div className="intake-details-list">
              <div className="intake-details-item">
                <span>Case Title</span>
                <strong>{reviewedData?.case_title || "—"}</strong>
              </div>

              <div className="intake-details-item">
                <span>Offense / Violation</span>
                <strong>{reviewedData?.offense_or_violation || "—"}</strong>
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
                <strong>{reviewedData?.resolution_date || "—"}</strong>
              </div>

              <div className="intake-details-item">
                <span>Filed in Court Date</span>
                <strong>{reviewedData?.filed_in_court_date || "—"}</strong>
              </div>

              <div className="intake-details-item">
                <span>Court Branch</span>
                <strong>{reviewedData?.court_branch || "—"}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="reviewed-modal-footer">
          <button
            type="button"
            className="reviewed-modal-btn secondary"
            onClick={onClose}
          >
            Back
          </button>

          <button
            type="button"
            className="reviewed-modal-btn primary"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? "Confirming..." : "Confirm Intake Case"}
          </button>
        </div>
      </div>
    </div>
  );
}
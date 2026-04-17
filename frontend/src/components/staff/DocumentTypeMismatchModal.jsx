// src/components/staff/DocumentTypeMismatchModal.jsx

export default function DocumentTypeMismatchModal({
  isOpen,
  mismatchInfo,
  onClose,
  onAcknowledge,
  progress = null,
}) {
  if (!isOpen || !mismatchInfo) return null;

  const handleClose = onAcknowledge || onClose;

  return (
    <div className="intake-modal-backdrop" onClick={handleClose}>
      <div
        className="intake-modal intake-processing-modal is-failed"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="intake-processing-hero">
          <div className="intake-processing-orb is-failed" />

          <div className="intake-processing-copy">
            <span className="intake-processing-badge is-failed">
              Process Failed
            </span>

            <h3>Document Mismatch Detected</h3>

            <p className="intake-upload-subtitle">
              {mismatchInfo.subtitle ??
                "The uploaded file does not match the selected document type."}
            </p>
          </div>
        </div>

        {progress !== null && (
          <div className="intake-processing-bar-shell">
            <div
              className="intake-processing-bar-fill is-failed"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="intake-modal-body intake-processing-body">
          <div className="intake-processing-review-note intake-processing-failed-note">
            <span className="intake-processing-review-label">
              Mismatch Details
            </span>

            <div className="intake-upload-success-grid intake-mismatch-grid">
              <div className="intake-upload-success-item">
                <span>File Name</span>
                <strong>{mismatchInfo.file_name ?? "—"}</strong>
              </div>

              <div className="intake-upload-success-item">
                <span>File Size</span>
                <strong>{mismatchInfo.file_size ?? "—"}</strong>
              </div>

              <div className="intake-upload-success-item">
                <span>Selected Document Type</span>
                <strong>{mismatchInfo.selected_document_type ?? "—"}</strong>
              </div>

              <div className="intake-upload-success-item">
                <span>Detected Document Type</span>
                <strong>{mismatchInfo.detected_document_type ?? "—"}</strong>
              </div>
            </div>

            <p className="intake-processing-failed-message">
              {mismatchInfo.message ??
                "Process failed. Please check the file and try again."}
            </p>
          </div>
        </div>

        <div className="intake-modal-footer">
          <button
            type="button"
            className="intake-modal-btn primary"
            onClick={handleClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
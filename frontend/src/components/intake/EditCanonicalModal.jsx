import React, { useEffect, useMemo, useState } from "react";

function normalizeListForInput(value) {
  if (Array.isArray(value)) return value.join(", ");
  return value || "";
}

function normalizeDateForInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export default function EditCanonicalModal({
  open,
  onClose,
  onSave,
  saving = false,
  record,
  prosecutors = [],
}) {
  const initialForm = useMemo(
    () => ({
      docket_number: record?.docket_number || "",
      case_number: record?.case_number || "",
      case_title: record?.case_title || "",
      offense_or_violation: record?.offense_or_violation || "",
      assigned_prosecutor_id: record?.assigned_prosecutor_id || "",
      date_filed: normalizeDateForInput(record?.date_filed),
      resolution_date: normalizeDateForInput(record?.resolution_date),
      filed_in_court_date: normalizeDateForInput(record?.filed_in_court_date),
      prosecution_result: record?.prosecution_result || "none",
      court_result: record?.court_result || "none",
      court_branch: record?.court_branch || "",
      complainants: normalizeListForInput(record?.complainants),
      respondents: normalizeListForInput(record?.respondents),
    }),
    [record]
  );

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (open) {
      setForm(initialForm);
    }
  }, [open, initialForm]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    const payload = {
      ...form,
      assigned_prosecutor_id: form.assigned_prosecutor_id || null,
      complainants: form.complainants
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      respondents: form.respondents
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };

    onSave(payload);
  }

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card canonical-edit-modal">
        <div className="modal-header">
          <div>
            <h2>Edit Intake Details</h2>
            <p>Update the canonical data shown in the intake details card.</p>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="canonical-edit-grid">
            <div className="form-group">
              <label>Docket Number</label>
              <input
                name="docket_number"
                value={form.docket_number}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Case Number</label>
              <input
                name="case_number"
                value={form.case_number}
                onChange={handleChange}
              />
            </div>

            <div className="form-group form-group-full">
              <label>Case Title</label>
              <input
                name="case_title"
                value={form.case_title}
                onChange={handleChange}
              />
            </div>

            <div className="form-group form-group-full">
              <label>Offense / Violation</label>
              <input
                name="offense_or_violation"
                value={form.offense_or_violation}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Assigned Prosecutor</label>
           <select
  name="assigned_prosecutor_id"
  value={form.assigned_prosecutor_id}
  onChange={handleChange}
>
  <option value="">Select prosecutor</option>
  {prosecutors.map((item) => (
    <option key={item.id} value={item.id}>
      {item.name}
    </option>
  ))}
</select>
            </div>

            <div className="form-group">
              <label>Date Filed</label>
              <input
                type="date"
                name="date_filed"
                value={form.date_filed}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Resolution Date</label>
              <input
                type="date"
                name="resolution_date"
                value={form.resolution_date}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Information Date Filed</label>
              <input
                type="date"
                name="filed_in_court_date"
                value={form.filed_in_court_date}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Prosecution Result</label>
              <select
                name="prosecution_result"
                value={form.prosecution_result}
                onChange={handleChange}
              >
                <option value="none">None</option>
                <option value="with_probable_cause">With Probable Cause</option>
                <option value="without_probable_cause">Without Probable Cause</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>

            <div className="form-group">
              <label>Court Result</label>
              <select
                name="court_result"
                value={form.court_result}
                onChange={handleChange}
              >
                <option value="none">None</option>
                <option value="convicted">Convicted</option>
                <option value="acquitted">Acquitted</option>
                <option value="dismissed_by_court">Dismissed by Court</option>
              </select>
            </div>

            <div className="form-group">
              <label>Court Branch</label>
              <input
                name="court_branch"
                value={form.court_branch}
                onChange={handleChange}
              />
            </div>

            <div className="form-group form-group-full">
              <label>Complainants</label>
              <textarea
                name="complainants"
                value={form.complainants}
                onChange={handleChange}
                placeholder="Comma-separated names"
                rows={3}
              />
            </div>

            <div className="form-group form-group-full">
              <label>Respondents</label>
              <textarea
                name="respondents"
                value={form.respondents}
                onChange={handleChange}
                placeholder="Comma-separated names"
                rows={3}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="secondary-btn"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-btn"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
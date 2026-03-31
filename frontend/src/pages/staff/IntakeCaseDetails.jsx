import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import UserLayout from "../../components/UserLayout";
import { getStoredUser } from "../../utils/storage";
import {
  getIntakeCaseById,
  uploadIntakeCaseDocument,
} from "../../services/staffService";

import {
  PencilLine,
  RefreshCw,
  Download,
  Trash2,
  MoreVertical,
} from "lucide-react";



import DocumentReviewModal from "../../components/staff/DocumentReviewModal";
import "../../styles/staff/intake-case-details-page.css";
import api from "../../api";
import IntakeCaseDetailsReviewedModal from "../../components/staff/IntakeCaseDetailsReviewedModal";


export default function IntakeCaseDetails() {
  const { intakeCaseId } = useParams();

  const user = getStoredUser();

  const [activeTopTab, setActiveTopTab] = useState("intake-details");

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
const [documentToDelete, setDocumentToDelete] = useState(null);
const [deletingDocument, setDeletingDocument] = useState(false);

const [documentDetailsSearch, setDocumentDetailsSearch] = useState("");
const [activeMatchIndex, setActiveMatchIndex] = useState(0);

const detailMatchRefs = useRef([]);
const [activeDetailMatchIndex, setActiveDetailMatchIndex] = useState(0);

const detailMatchCounterRef = useRef(0);

const [trackerModal, setTrackerModal] = useState({
  isOpen: false,
  mode: "edit",
  item: null,
});

const [complianceModal, setComplianceModal] = useState({
  isOpen: false,
  mode: "edit",
  item: null,
});

const [trackerForm, setTrackerForm] = useState({
  document_type: "",
  tracking_type: "",
  source_location: "",
  office_department: "",
  responsible_party: "",
  requested_date: "",
  expected_date: "",
  due_date: "",
  received_date: "",
  status: "",
  remarks: "",
});

const [complianceForm, setComplianceForm] = useState({
  title: "",
  description: "",
  compliance_type: "",
  issued_date: "",
  due_date: "",
  days_to_comply: "",
  complied_date: "",
  compliance_status: "",
  responsible_party: "",
  remarks: "",
  related_document_id: "",
});

const [savingTracker, setSavingTracker] = useState(false);
const [savingCompliance, setSavingCompliance] = useState(false);

  const [record, setRecord] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [latestDocuments, setLatestDocuments] = useState([]);
  const [documentHistory, setDocumentHistory] = useState([]);
  const [checklist, setChecklist] = useState([]);
  const [trackers, setTrackers] = useState([]);
  const [complianceItems, setComplianceItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const [showAllDocuments, setShowAllDocuments] = useState(false);

  const [showUploadModal, setShowUploadModal] = useState(false);
const [showProcessingModal, setShowProcessingModal] = useState(false);
const [showUploadSuccessModal, setShowUploadSuccessModal] = useState(false);
const [showMismatchModal, setShowMismatchModal] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
const [processingComplete, setProcessingComplete] = useState(false);
const [uploadedDocumentSummary, setUploadedDocumentSummary] = useState(null);
const [mismatchInfo, setMismatchInfo] = useState(null);

  const [prosecutorOptions, setProsecutorOptions] = useState([]);
  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    documentId: null,
  });

  const [documentDetailsModal, setDocumentDetailsModal] = useState({
  isOpen: false,
  document: null,
});

const [openDocumentMenuId, setOpenDocumentMenuId] = useState(null);

  const [uploadDocumentType, setUploadDocumentType] = useState("");
  const [uploadDateReceived, setUploadDateReceived] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

const [reviewedDetailsModal, setReviewedDetailsModal] = useState({
  isOpen: false,
  documentId: null,
});

  useEffect(() => {
    loadDetails();
    loadProsecutors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intakeCaseId]);


  function formatFileSize(bytes) {
  if (!bytes) return "0 B";

  const sizes = ["B", "KB", "MB", "GB"];
  let i = 0;

  while (bytes >= 1024 && i < sizes.length - 1) {
    bytes /= 1024;
    i++;
  }

  return `${bytes.toFixed(1)} ${sizes[i]}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text, keyword, sectionKey = "default") {
  if (!text) return "—";
  if (!keyword?.trim()) return text;

  const escaped = escapeRegExp(keyword.trim());
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = String(text).split(regex);

  return parts.map((part, index) => {
    const isMatch = part.toLowerCase() === keyword.trim().toLowerCase();

    if (!isMatch) {
      return <span key={`${sectionKey}-${index}`}>{part}</span>;
    }

    const matchIndex = detailMatchCounterRef.current;
    detailMatchCounterRef.current += 1;

    const isActive = matchIndex === activeDetailMatchIndex;

    return (
      <mark
        key={`${sectionKey}-${index}`}
        ref={(el) => {
          if (el) {
            detailMatchRefs.current[matchIndex] = el;
          }
        }}
        className={`intake-details-highlight ${
          isActive ? "is-active-match" : ""
        }`}
        data-match-index={matchIndex}
      >
        {part}
      </mark>
    );
  });
}

function countMatches(text, keyword) {
  if (!text || !keyword?.trim()) return 0;

  const escaped = escapeRegExp(keyword.trim());
  const matches = String(text).match(new RegExp(escaped, "gi"));
  return matches ? matches.length : 0;
}


  async function loadDetails() {
    try {
      setLoading(true);
      setErr("");
      setMsg("");

      const res = await getIntakeCaseById(intakeCaseId);
      const data = res?.data?.data || {};

      setRecord(data.intake_case || null);
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
      setLatestDocuments(
        Array.isArray(data.latest_documents) ? data.latest_documents : []
      );
      setDocumentHistory(
        Array.isArray(data.document_history) ? data.document_history : []
      );
      setChecklist(Array.isArray(data.checklist) ? data.checklist : []);
      setTrackers(
        Array.isArray(data.document_trackers) ? data.document_trackers : []
      );
      setComplianceItems(
        Array.isArray(data.compliance_items) ? data.compliance_items : []
      );
    } catch (e) {
      setErr(
        e?.response?.data?.message || "Failed to load intake case details."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadProsecutors() {
    try {
      const res = await api.get("/staff/prosecutors");

      const payload = res?.data?.data || {};
      const list =
        payload.prosecutors ||
        payload.items ||
        payload.users ||
        payload.staff ||
        [];

      const normalized = Array.isArray(list)
        ? list
            .map((item, index) => ({
              id:
                item?.id ??
                item?.user_id ??
                item?.prosecutor_id ??
                item?.staff_id ??
                item?.value ??
                `prosecutor-${index}`,
              name:
                item?.full_name ||
                item?.display_name ||
                item?.name ||
                [item?.first_name, item?.middle_name, item?.last_name]
                  .filter(Boolean)
                  .join(" ")
                  .trim() ||
                `Prosecutor ${index + 1}`,
            }))
            .filter((item) => item.name)
        : [];

      setProsecutorOptions(normalized);
    } catch (error) {
      console.error(
        "Failed to load prosecutors:",
        error?.response?.data || error
      );
      setProsecutorOptions([]);
    }
  }

  function closeReviewedDetailsModal() {
  setReviewedDetailsModal({
    isOpen: false,
    documentId: null,
  });
}

function openReviewedDetailsModal(documentId) {
  setReviewedDetailsModal({
    isOpen: true,
    documentId,
  });
}

function isDocumentReviewed(doc) {
  const raw = String(
    doc?.document_status_label ||
      doc?.document_status ||
      (doc?.is_reviewed ? "Reviewed" : "")
  )
    .trim()
    .toLowerCase();

  return raw.includes("reviewed") || Boolean(doc?.is_reviewed);
}

function handleDocumentReviewOrEdit(doc) {
  if (!doc?.id) return;

  if (isDocumentReviewed(doc)) {
    openReviewedDetailsModal(doc.id);
    return;
  }

  openReviewModal(doc.id);
}

  function closeReviewModal() {
    setReviewModal({
      isOpen: false,
      documentId: null,
    });
  }

  function openReviewModal(documentId) {
    setReviewModal({
      isOpen: true,
      documentId,
    });
  }

  function getDocumentStatusLabel(doc) {
  return (
    doc?.document_status_label ||
    doc?.document_status ||
    (doc?.is_reviewed ? "Reviewed" : "Pending")
  );
}

function getDocumentHref(doc) {
  const rawPath =
    doc?.file_url ||
    doc?.document_url ||
    doc?.uploaded_file_url ||
    doc?.uploaded_file_path ||
    doc?.url ||
    doc?.path ||
    "";

  if (!rawPath) return "";

  const normalizedPath = String(rawPath).replace(/\\/g, "/");

  if (/^https?:\/\//i.test(normalizedPath)) {
    return normalizedPath;
  }

  const apiBase = api?.defaults?.baseURL || "";
  const backendBaseUrl = apiBase.replace(/\/api\/?$/, "");

  return `${backendBaseUrl}/staff/uploads/${normalizedPath
    .replace(/^uploads\//, "")
    .replace(/^\/+/, "")}`;
}

async function handleOpenDocument(doc) {
  const href = getDocumentHref(doc);

  if (!href) {
    setErr("No document file URL available for this record.");
    return;
  }

  try {
    setErr("");

    const response = await api.get(href, {
      responseType: "blob",
    });

    const fileBlob = new Blob([response.data], {
      type: response.headers["content-type"] || "application/pdf",
    });

    const fileUrl = window.URL.createObjectURL(fileBlob);
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    console.error("Failed to open document:", error);
    setErr("Failed to open document.");
  }
}

async function handleDownloadDocument(doc) {
  const href = getDocumentHref(doc);

  if (!href) {
    setErr("No downloadable document file URL available for this record.");
    return;
  }

  try {
    setErr("");

    const response = await api.get(href, {
      responseType: "blob",
    });

    const fileBlob = new Blob([response.data], {
      type: response.headers["content-type"] || "application/octet-stream",
    });

    const fileUrl = window.URL.createObjectURL(fileBlob);
    const link = document.createElement("a");

    link.href = fileUrl;
    link.download = doc?.uploaded_file_name || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(fileUrl);
  } catch (error) {
    console.error("Failed to download document:", error);
    setErr("Failed to download document.");
  }
}

async function handleReExtractDocument(doc) {
  if (!doc?.id) return;

  try {
    setErr("");
    setMsg("");

    await api.post(`/staff/intake-case-documents/${doc.id}/extract`);

    setMsg("Document extracted successfully.");
    await loadDetails();
  } catch (error) {
    console.error("Failed to extract document:", error);
    setErr(
      error?.response?.data?.message || "Failed to extract document."
    );
  }
}


function handleDeleteDocument(doc) {
  setErr("");
  setMsg("");
  setDocumentToDelete(doc);
  setShowDeleteConfirmModal(true);
}

async function confirmDeleteDocument() {
  if (!documentToDelete?.id) return;

  try {
    setDeletingDocument(true);
    setErr("");
    setMsg("");

    await api.delete(`/staff/intake-case-documents/${documentToDelete.id}`);

    setShowDeleteConfirmModal(false);
    setShowDeleteSuccessModal(true);
    setDocumentToDelete(null);

    await loadDetails();
  } catch (error) {
    console.error("Failed to delete document:", error);
    setErr(
      error?.response?.data?.message || "Failed to delete document."
    );
    setShowDeleteConfirmModal(false);
  } finally {
    setDeletingDocument(false);
  }
}

function closeDeleteConfirmModal() {
  if (deletingDocument) return;
  setShowDeleteConfirmModal(false);
  setDocumentToDelete(null);
}

function closeDeleteSuccessModal() {
  setShowDeleteSuccessModal(false);
}

async function handleReviewSaved(payload) {
  setMsg("Reviewed data successfully saved.");
  setShowUploadSuccessModal(false);

  await loadDetails();
  closeReviewModal();

  const savedDocumentId =
    payload?.document?.id ||
    reviewModal.documentId ||
    null;

  if (savedDocumentId) {
    openReviewedDetailsModal(savedDocumentId);
  }
}


  function normalizeText(value) {
    if (value === null || value === undefined) return "";

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value).trim().toLowerCase();
    }

    if (Array.isArray(value)) {
      return value.map(normalizeText).filter(Boolean).join(" ");
    }

    if (typeof value === "object") {
      const preferred = [
        value.label,
        value.status,
        value.status_label,
        value.name,
        value.full_name,
        value.document_type,
        value.value,
        value.title,
        value.display_name,
        value.compliance_status_label,
      ]
        .filter(Boolean)
        .join(" ");

      if (preferred) return preferred.toLowerCase();

      try {
        return JSON.stringify(value).toLowerCase();
      } catch {
        return "";
      }
    }

    return String(value).trim().toLowerCase();
  }

  function toDisplayValue(value, fallback = "—") {
    if (value === null || value === undefined || value === "") return fallback;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      const clean = String(value).trim();
      return clean || fallback;
    }

    if (Array.isArray(value)) {
      const joined = value
        .map((item) => toDisplayValue(item, ""))
        .filter((item) => item && item !== "—")
        .join(", ");
      return joined || fallback;
    }

    if (typeof value === "object") {
      const preferred =
        value.label ||
        value.status ||
        value.status_label ||
        value.name ||
        value.full_name ||
        value.document_type ||
        value.value ||
        value.title ||
        value.display_name ||
        value.compliance_status_label;

      if (
        preferred !== undefined &&
        preferred !== null &&
        String(preferred).trim()
      ) {
        return String(preferred);
      }

      if (value.first_name || value.last_name) {
        const fullName = [value.first_name, value.last_name]
          .filter(Boolean)
          .join(" ")
          .trim();

        if (fullName) return fullName;
      }

      try {
        return JSON.stringify(value);
      } catch {
        return fallback;
      }
    }

    return String(value);
  }

  const formatParty = (value) => {
  if (!value) return "—";

  // split names (assuming comma separated)
  const parts = value.split(",").map(v => v.trim()).filter(Boolean);

  if (parts.length === 0) return "—";

  if (parts.length === 1) return parts[0];

  return `${parts[0]} et. al`;
};

  const summaryData = {
    documentType: record?.document_type || record?.case_type,
    docketNumber: record?.docket_number,
    caseNumber: record?.case_number,
    dateFiled: record?.date_filed,

    assignedProsecutor:
      record?.assigned_prosecutor ||
      record?.assigned_prosecutor_name ||
      record?.assigned_prosecutor_label,

    caseStatus: record?.case_status || record?.case_status_label,
    prosecutionResult: record?.prosecution_result,
    courtResult: record?.court_result,

    caseTitle: record?.case_title,
    offenseOrViolation: record?.offense_or_violation,

    complainants: Array.isArray(record?.complainants)
      ? record.complainants.join(", ")
      : record?.complainants,

    respondents: Array.isArray(record?.respondents)
      ? record.respondents.join(", ")
      : record?.respondents,

    resolutionDate: record?.resolution_date,
    filedInCourtDate: record?.filed_in_court_date,
    courtBranch: record?.court_branch,

    intakeStatus:
      record?.intake_status_label ||
      record?.intake_status ||
      record?.case_status,

    createdBy:
      record?.created_by_name ||
      record?.created_by ||
      user?.full_name,

    createdAt: record?.created_at,
  };

const documentTypeOptions = useMemo(() => {
  if (record?.case_type === "INQ") {
    return [
      { value: "police_report", label: "Police Report" },
      { value: "arrest_report", label: "Arrest Report" },
      { value: "affidavit_of_arrest", label: "Affidavit of Arrest" },
      {
        value: "affidavit_of_apprehension",
        label: "Affidavit of Apprehension",
      },
      { value: "inquest_resolution", label: "Inquest Resolution" },
      { value: "subpoena", label: "Subpoena" },
      { value: "counter_affidavit", label: "Counter Affidavit" },
      { value: "reply_affidavit", label: "Reply Affidavit" },
      { value: "rejoinder_affidavit", label: "Rejoinder Affidavit" },
      { value: "resolution", label: "Resolution" },
      { value: "information", label: "Information" },
      { value: "motion", label: "Motion" },
      { value: "order", label: "Order" },
      { value: "notice", label: "Notice" },
      { value: "supporting_evidence", label: "Supporting Evidence" },
      { value: "certification", label: "Certification" },
      { value: "other_supporting_document", label: "Other" },
    ];
  }

  return [
    { value: "complaint_affidavit", label: "Complaint Affidavit" },
    { value: "subpoena", label: "Subpoena" },
    { value: "counter_affidavit", label: "Counter Affidavit" },
    { value: "reply_affidavit", label: "Reply Affidavit" },
    { value: "rejoinder_affidavit", label: "Rejoinder Affidavit" },
    { value: "resolution", label: "Resolution" },
    { value: "information", label: "Information" },
    { value: "motion", label: "Motion" },
    { value: "order", label: "Order" },
    { value: "notice", label: "Notice" },
    { value: "supporting_evidence", label: "Supporting Evidence" },
    { value: "certification", label: "Certification" },
    { value: "other_supporting_document", label: "Other" },
  ];
}, [record?.case_type]);

function resetAdditionalUploadState() {
  setUploadDocumentType("");
  setUploadDateReceived("");
  setUploadFile(null);
  setUploadProgress(0);
  setProcessingComplete(false);
  setUploadedDocumentSummary(null);
  setShowMismatchModal(false);
  setMismatchInfo(null);
}

function handleAddFiles() {
  setErr("");
  setMsg("");
  resetAdditionalUploadState();
  setShowUploadModal(true);
}

function closeUploadModal() {
  if (uploadLoading) return;
  setShowUploadModal(false);
}

function closeUploadSuccessModal() {
  setShowUploadSuccessModal(false);
}

function handleMismatchAcknowledge() {
  setShowMismatchModal(false);
  setShowProcessingModal(false);
  setProcessingComplete(false);
  setUploadProgress(0);
  setShowUploadModal(true);
}

  async function handleUploadAdditionalDocument(e) {
  e.preventDefault();

  if (!record?.id) {
    setErr("Missing intake case reference.");
    return;
  }

  if (!uploadDocumentType) {
    setErr("Please select a document type.");
    return;
  }

  if (!uploadFile) {
    setErr("Please choose a file to upload.");
    return;
  }

  try {
    setUploadLoading(true);
    setErr("");
    setMsg("");
    setShowUploadModal(false);
    setShowUploadSuccessModal(false);
    setShowMismatchModal(false);
    setMismatchInfo(null);
    setShowProcessingModal(true);
    setProcessingComplete(false);
    setUploadProgress(20);

    const currentFileName = uploadFile?.name || "—";
    const currentFileSize = uploadFile?.size || 0;
    const selectedDocumentType = uploadDocumentType;

    const formData = new FormData();
    formData.append("document", uploadFile);
    formData.append("document_type", uploadDocumentType);
    formData.append("upload_mode", "extract");

    if (uploadDateReceived) {
      formData.append("date_received", uploadDateReceived);
    }

    setUploadProgress(45);

    const res = await uploadIntakeCaseDocument(record.id, formData);
    const uploadedDoc = res?.data?.data?.document || null;

    setUploadProgress(100);
    setProcessingComplete(true);
    setUploadedDocumentSummary(uploadedDoc);

    setUploadDocumentType("");
    setUploadDateReceived("");
    setUploadFile(null);

    await loadDetails();

    setShowProcessingModal(false);
setShowUploadSuccessModal(true);
  } catch (e) {
    const responseMessage =
      e?.response?.data?.message ||
      e?.response?.data?.errors?.[0] ||
      "Failed to upload intake document.";

    const errorPayload = e?.response?.data?.data || {};
    const detectedDocumentType =
      errorPayload?.detected_document_type ||
      errorPayload?.document?.detected_document_type ||
      "";

    setUploadProgress(100);
    setProcessingComplete(false);

    if (
      responseMessage.toLowerCase().includes("match") ||
      responseMessage.toLowerCase().includes("mismatch")
    ) {
      setMismatchInfo({
        file_name: errorPayload?.file_name || uploadFile?.name || currentFileName,
        file_size: errorPayload?.file_size || uploadFile?.size || currentFileSize,
        selected_document_type: selectedDocumentType,
        detected_document_type: detectedDocumentType || "Unknown",
        message: responseMessage,
      });
      setShowMismatchModal(true);
    } else {
      setShowProcessingModal(false);
      setErr(responseMessage);
    }
  } finally {
    setUploadLoading(false);
  }
}

  function renderStatusBadge(value) {
    const display = toDisplayValue(value, "—");
    const text = normalizeText(value || "—");
    let className = "neutral";

    if (
      text.includes("ready") ||
      text.includes("complete") ||
      text.includes("reviewed") ||
      text.includes("active") ||
      text.includes("received") ||
      text.includes("uploaded")
    ) {
      className = "success";
    } else if (
      text.includes("review") ||
      text.includes("pending") ||
      text.includes("confirmation") ||
      text.includes("processing") ||
      text.includes("awaiting")
    ) {
      className = "warning";
    } else if (
      text.includes("dismissed") ||
      text.includes("failed") ||
      text.includes("missing") ||
      text.includes("incomplete")
    ) {
      className = "danger";
    }

    return (
      <span className={`intake-details-status ${className}`}>{display}</span>
    );
  }

  function renderListTable(
    title,
    rows,
    columns,
    emptyText = "No records found."
  ) {
    return (
      <div className="intake-details-panel tab-panel">
        <div className="intake-details-panel-header">
          <h3>{title}</h3>
        </div>

        {!rows || rows.length === 0 ? (
          <div className="intake-details-empty">{emptyText}</div>
        ) : (
          <div className="intake-details-table-wrap">
            <table className="intake-details-table">
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col.key}>{col.label}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id || `${title}-${index}`}>
                    {columns.map((col) => (
                      <td key={col.key}>
                        {typeof col.render === "function"
                          ? col.render(row)
                          : toDisplayValue(row[col.key], "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (!user) return <div style={{ padding: 20 }}>Redirecting...</div>;

  const visibleDocuments = showAllDocuments ? documents : documents.slice(0, 5);

  function handleOpenDocumentDetails(doc) {
  setDocumentDetailsModal({
    isOpen: true,
    document: doc,
  });
  setOpenDocumentMenuId(null);
}

function handleCloseDocumentDetails() {
  setDocumentDetailsModal({
    isOpen: false,
    document: null,
  });
}

function toggleDocumentMenu(docId) {
  setOpenDocumentMenuId((prev) => (prev === docId ? null : docId));
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function formatDateOnly(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function getFileTypeLabel(doc) {
  const mime = doc?.file_mime_type || "";
  const name = doc?.uploaded_file_name || "";

  if (mime) return mime;
  if (name.includes(".")) return name.split(".").pop()?.toUpperCase() || "—";
  return "—";
}

function renderYesNo(value) {
  return value ? "Yes" : "No";
}

function safePrettyJson(value) {
  if (value === null || value === undefined || value === "") return "—";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "—";

    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return trimmed;
    }
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getDocumentCleanText(doc) {
  if (!doc) return "";

  const directCandidates = [
    doc.clean_text,
    doc.cleaned_text,
    doc.ocr_text,
    doc.raw_text,
    doc.text,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate
  .replace(/\\n/g, "\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();
    }
  }

  const extracted = doc.extracted_data;

  if (typeof extracted === "string" && extracted.trim()) {
    return extracted.trim();
  }

  if (extracted && typeof extracted === "object") {
    const nestedCandidates = [
      extracted.clean_text,
      extracted.cleaned_text,
      extracted.ocr_text,
      extracted.raw_text,
      extracted.text,
      extracted.content,
      extracted.full_text,
      extracted.document_text,
      extracted?.metadata?.clean_text,
      extracted?.metadata?.ocr_text,
      extracted?.metadata?.text,
    ];

    for (const candidate of nestedCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }
  }

  return candidate
  .replace(/\\n/g, "\n")
  .replace(/\n{2,}/g, "\n\n")
  .trim();
}

const fullDetailsDoc = documentDetailsModal.document;

const cleanTextValue = getDocumentCleanText(fullDetailsDoc);
const extractedDataText = safePrettyJson(fullDetailsDoc?.extracted_data);
const reviewedDataText = safePrettyJson(fullDetailsDoc?.reviewed_data);
const reviewNotesText = fullDetailsDoc?.review_notes || "";

const cleanTextMatches = countMatches(cleanTextValue, documentDetailsSearch);
const extractedMatches = countMatches(extractedDataText, documentDetailsSearch);
const reviewedMatches = countMatches(reviewedDataText, documentDetailsSearch);
const reviewNotesMatches = countMatches(reviewNotesText, documentDetailsSearch);

const totalDetailMatches =
  cleanTextMatches +
  extractedMatches +
  reviewedMatches +
  reviewNotesMatches;

function resetDetailMatchRefs() {
  detailMatchRefs.current = [];
  detailMatchCounterRef.current = 0;
}

function scrollToDetailMatch(index) {
  const matchEl = detailMatchRefs.current[index];
  if (!matchEl) return;

  matchEl.scrollIntoView({
    behavior: "smooth",
    block: "center",
  });
}

function handleNextDetailMatch(totalMatches) {
  if (!totalMatches) return;

  setActiveDetailMatchIndex((prev) => {
    if (prev + 1 >= totalMatches) return 0;
    return prev + 1;
  });
}

function handlePreviousDetailMatch(totalMatches) {
  if (!totalMatches) return;

  setActiveDetailMatchIndex((prev) => {
    if (prev - 1 < 0) return totalMatches - 1;
    return prev - 1;
  });
}

useEffect(() => {
  resetDetailMatchRefs();
  setActiveDetailMatchIndex(0);
}, [documentDetailsSearch]);

useEffect(() => {
  if (!documentDetailsSearch.trim()) return;
  if (!totalDetailMatches) return;

  const timer = setTimeout(() => {
    const matchEl = detailMatchRefs.current[activeDetailMatchIndex];
    if (!matchEl) return;

    matchEl.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });
  }, 120);

  return () => clearTimeout(timer);
}, [activeDetailMatchIndex, documentDetailsSearch, totalDetailMatches]);

const highlightedCleanText = useMemo(() => {
  resetDetailMatchRefs();
  return highlightText(cleanTextValue, documentDetailsSearch, "clean-text");
}, [cleanTextValue, documentDetailsSearch, activeDetailMatchIndex]);

const highlightedExtractedData = useMemo(() => {
  return highlightText(
    extractedDataText,
    documentDetailsSearch,
    "extracted-data"
  );
}, [extractedDataText, documentDetailsSearch, activeDetailMatchIndex]);

const highlightedReviewedData = useMemo(() => {
  return highlightText(
    reviewedDataText,
    documentDetailsSearch,
    "reviewed-data"
  );
}, [reviewedDataText, documentDetailsSearch, activeDetailMatchIndex]);


function formatDateOnly(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function getChecklistRowMeta(row) {
  const statusText = String(
    row?.status_label ||
      row?.status ||
      row?.checklist_status ||
      row?.document_status ||
      ""
  )
    .trim()
    .toLowerCase();

  const isRequired =
    row?.is_required ??
    !(statusText.includes("optional") || statusText.includes("not applicable"));

const isPresent =
  row?.is_present ??
  (
    statusText.includes("uploaded") ||
    statusText.includes("present") ||
    statusText.includes("reviewed") ||
    statusText.includes("satisfied") ||
    Boolean(row?.matched_document_id)
  );

  const isReviewed =
    row?.is_reviewed ?? (
    statusText.includes("reviewed") ||
    statusText.includes("satisfied")
    );

  let derivedStatus = "Missing";

  if (!isRequired) derivedStatus = "Optional";
  else if (isReviewed) derivedStatus = "Satisfied";
  else if (isPresent) derivedStatus = "Uploaded";
  else derivedStatus = "Missing";

  return {
    isRequired,
    isPresent,
    isReviewed,
    derivedStatus,
  };
}

function getTrackerTimelineLabel(row) {
  if (row?.is_completed) return "Completed";
  if (row?.is_overdue) {
    return row?.days_delayed
      ? `${row.days_delayed} day(s) overdue`
      : "Overdue";
  }
  if (row?.days_remaining !== null && row?.days_remaining !== undefined) {
    return `${row.days_remaining} day(s) remaining`;
  }
  return "—";
}

function getComplianceTimelineLabel(row) {
  if (row?.is_complied) return "Complied";
  if (row?.is_overdue) {
    return row?.days_overdue
      ? `${row.days_overdue} day(s) overdue`
      : "Overdue";
  }
  if (row?.days_remaining !== null && row?.days_remaining !== undefined) {
    return `${row.days_remaining} day(s) remaining`;
  }
  return "—";
}

function getRelatedDocumentNameById(documentId) {
  if (!documentId) return "—";
  const match = documents.find((doc) => doc.id === documentId);
  return match?.uploaded_file_name || match?.document_type_label || `Document #${documentId}`;
}

function renderDerivedStatusBadge(label) {
  return renderStatusBadge(label);
}

function normalizeDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function openTrackerModal(item) {
  setTrackerModal({
    isOpen: true,
    mode: "edit",
    item,
  });

  setTrackerForm({
    document_type: item?.document_type || "",
    tracking_type: item?.track_type || item?.tracking_type || "",
    source_location: item?.source_location || "",
    office_department: item?.office_department || item?.office || "",
    responsible_party: item?.responsible_party || "",
    requested_date: normalizeDateInput(item?.requested_date),
    expected_date: normalizeDateInput(item?.expected_date),
    due_date: normalizeDateInput(item?.due_date),
    received_date: normalizeDateInput(item?.received_date),
    status: item?.status || "",
    remarks: item?.remarks || "",
  });
}

function closeTrackerModal() {
  if (savingTracker) return;
  setTrackerModal({
    isOpen: false,
    mode: "edit",
    item: null,
  });
}

function openComplianceModal(item) {
  setComplianceModal({
    isOpen: true,
    mode: "edit",
    item,
  });

  setComplianceForm({
    title: item?.title || "",
    description: item?.description || "",
    compliance_type: item?.type || item?.compliance_type || "",
    issued_date: normalizeDateInput(item?.issued_date),
    due_date: normalizeDateInput(item?.due_date),
    days_to_comply: item?.days_to_comply ?? "",
    complied_date: normalizeDateInput(item?.complied_date),
    compliance_status:
      item?.compliance_status || item?.status || "",
    responsible_party: item?.responsible_party || "",
    remarks: item?.remarks || "",
    related_document_id: item?.related_document_id || "",
  });
}

function closeComplianceModal() {
  if (savingCompliance) return;
  setComplianceModal({
    isOpen: false,
    mode: "edit",
    item: null,
  });
}

async function handleSaveTracker() {
  if (!trackerModal.item?.id) return;

  try {
    setSavingTracker(true);
    setErr("");
    setMsg("");

    const payload = {
      tracking_type: trackerForm.tracking_type || null,
      source_location: trackerForm.source_location || null,
      office_department: trackerForm.office_department || null,
      responsible_party: trackerForm.responsible_party || null,
      requested_date: trackerForm.requested_date || null,
      expected_date: trackerForm.expected_date || null,
      due_date: trackerForm.due_date || null,
      received_date: trackerForm.received_date || null,
      status: trackerForm.status || null,
      remarks: trackerForm.remarks || null,
    };

    await api.patch(
      `/staff/intake-cases/${intakeCaseId}/document-trackers/${trackerModal.item.id}`,
      payload
    );

    setMsg("Document tracker updated successfully.");
    closeTrackerModal();
    await loadDetails();
  } catch (error) {
    console.error("Failed to update tracker:", error);
    setErr(
      error?.response?.data?.message || "Failed to update document tracker."
    );
  } finally {
    setSavingTracker(false);
  }
}

async function handleSaveCompliance() {
  if (!complianceModal.item?.id) return;

  try {
    setSavingCompliance(true);
    setErr("");
    setMsg("");

    const payload = {
      title: complianceForm.title || null,
      description: complianceForm.description || null,
      due_date: complianceForm.due_date || null,
      issued_date: complianceForm.issued_date || null,
      days_to_comply:
        complianceForm.days_to_comply === ""
          ? null
          : Number(complianceForm.days_to_comply),
      complied_date: complianceForm.complied_date || null,
      compliance_status: complianceForm.compliance_status || null,
      responsible_party: complianceForm.responsible_party || null,
      remarks: complianceForm.remarks || null,
    };

    await api.patch(
      `/staff/intake-cases/${intakeCaseId}/compliance-items/${complianceModal.item.id}`,
      payload
    );

    setMsg("Compliance item updated successfully.");
    closeComplianceModal();
    await loadDetails();
  } catch (error) {
    console.error("Failed to update compliance item:", error);
    setErr(
      error?.response?.data?.message || "Failed to update compliance item."
    );
  } finally {
    setSavingCompliance(false);
  }
}
function openRelatedDocumentById(documentId) {
  if (!documentId) return;
  const matched = documents.find((doc) => doc.id === documentId);
  if (!matched) return;
  handleOpenDocumentDetails(matched);
}


  return (
    <UserLayout
      user={user}
      sectionBadge="INTAKE CASE DETAILS"
      pageTitle="Intake Case Details"
      pageSubtitle="Review uploaded documents, extracted data, trackers, and compliance items."
    >
      <div className="intake-details-page">
        {msg && <div className="intake-details-alert success">{msg}</div>}
        {err && <div className="intake-details-alert error">{err}</div>}

        {loading ? (
          <div className="intake-details-empty">
            Loading intake case details...
          </div>
        ) : !record ? (
          <div className="intake-details-empty">Intake case not found.</div>
        ) : (
<div className="intake-details-wide-layout">
<div className="intake-top-row">
  <div className="intake-hero-stack">

<div className="intake-top-tabs-shell">
  <div className="intake-top-tabs">
    <button
      type="button"
      className={`intake-top-tab ${activeTopTab === "intake-details" ? "active" : ""}`}
      onClick={() => setActiveTopTab("intake-details")}
    >
      <span className="intake-top-tab-icon">⌂</span>
      <span>Intake Details</span>
    </button>

    <button
      type="button"
      className={`intake-top-tab ${activeTopTab === "checklist" ? "active" : ""}`}
      onClick={() => setActiveTopTab("checklist")}
    >
      <span className="intake-top-tab-icon">✓</span>
      <span>Checklist ({checklist.length})</span>
    </button>

    <button
      type="button"
      className={`intake-top-tab ${activeTopTab === "trackers" ? "active" : ""}`}
      onClick={() => setActiveTopTab("trackers")}
    >
      <span className="intake-top-tab-icon">▤</span>
      <span>Document Trackers ({trackers.length})</span>
    </button>

    <button
      type="button"
      className={`intake-top-tab ${activeTopTab === "compliance" ? "active" : ""}`}
      onClick={() => setActiveTopTab("compliance")}
    >
      <span className="intake-top-tab-icon">◫</span>
      <span>Compliance Items ({complianceItems.length})</span>
    </button>
  </div>
</div>

{activeTopTab === "intake-details" && (
  <div className="intake-case-hero-card">
    <div className="intake-case-hero-top">
      <div className="intake-case-hero-main">
        <div className="intake-case-docket-inline">
          <span className="intake-case-docket-label">DOCKET NO.</span>
          <div className="intake-case-docket-pill">
            {toDisplayValue(summaryData.docketNumber, "—")}
          </div>
        </div>

        <div className="intake-case-title-block">
          <div className="intake-case-party">
            {toDisplayValue(summaryData.complainants, "—")}
          </div>

          <div className="intake-case-vs">VS.</div>

          <div className="intake-case-party">
            {toDisplayValue(summaryData.respondents, "—")}
          </div>
        </div>
      </div>

      <div className="intake-case-hero-side">
        <div className="intake-case-side-card intake-case-side-card-wide">
          <span>OFFENSE / VIOLATION</span>
          <strong>{toDisplayValue(summaryData.offenseOrViolation, "—")}</strong>
        </div>

        <div className="intake-case-side-card intake-case-side-card-narrow">
          <span>DATE FILED</span>
          <strong>{toDisplayValue(summaryData.dateFiled, "—")}</strong>
        </div>

        <div className="intake-case-side-card intake-case-side-card-wide">
          <span>ASSIGNED PROSECUTOR</span>
          <strong>{toDisplayValue(summaryData.assignedProsecutor, "Not Assigned")}</strong>
        </div>

        <div className="intake-case-side-card intake-case-side-card-narrow">
          <span>INTAKE STATUS</span>
          <strong>{toDisplayValue(summaryData.intakeStatus, "Active")}</strong>
        </div>
      </div>
    </div>

<div className="intake-case-extra-grid">

  {/* ROW 1 */}
  <div className="intake-case-extra-card">
    <span>RESOLUTION DATE</span>
    <strong>{toDisplayValue(summaryData.resolutionDate, "—")}</strong>
  </div>

  <div className="intake-case-extra-card">
    <span>PROSECUTION RESULT</span>
    <strong>{toDisplayValue(summaryData.prosecutionResult, "—")}</strong>
  </div>

  <div className="intake-case-extra-card intake-case-extra-card-wide">
    <span>COMPLAINANTS</span>
    <strong>{toDisplayValue(summaryData.complainants, "—")}</strong>
  </div>

  {/* ROW 2 */}
  <div className="intake-case-extra-card">
    <span>INFORMATION DATE FILED</span>
    <strong>{toDisplayValue(summaryData.filedInCourtDate, "—")}</strong>
  </div>

  <div className="intake-case-extra-card">
    <span>CASE NUMBER</span>
    <strong>{toDisplayValue(summaryData.caseNumber, "—")}</strong>
  </div>

  <div className="intake-case-extra-card intake-case-extra-card-wide">
    <span>RESPONDENTS</span>
    <strong>{toDisplayValue(summaryData.respondents, "—")}</strong>
  </div>

</div>
  </div>
)}

{activeTopTab === "checklist" &&
  renderListTable(
    "Required Documents Checklist",
    checklist,
    [
      {
        key: "document_type",
        label: "Document Type",
        render: (row) =>
          toDisplayValue(
            row.document_type_label ||
              row.document_type ||
              row.name ||
              row.item_name,
            "—"
          ),
      },
      {
        key: "required",
        label: "Required",
        render: (row) =>
          toDisplayValue(getChecklistRowMeta(row).isRequired ? "Yes" : "No", "—"),
      },
      {
        key: "present",
        label: "Present",
        render: (row) =>
          toDisplayValue(getChecklistRowMeta(row).isPresent ? "Yes" : "No", "—"),
      },
      {
        key: "reviewed",
        label: "Reviewed",
        render: (row) =>
          toDisplayValue(getChecklistRowMeta(row).isReviewed ? "Yes" : "No", "—"),
      },
      {
        key: "status",
        label: "Status",
        render: (row) =>
          renderDerivedStatusBadge(getChecklistRowMeta(row).derivedStatus),
      },
      {
        key: "matched_document",
        label: "Matched Document",
        render: (row) =>
          toDisplayValue(
            row.matched_document_name ||
              getRelatedDocumentNameById(row.matched_document_id),
            "—"
          ),
      },
      {
        key: "label",
        label: "Remarks",
        render: (row) =>
          toDisplayValue(
            row.label ||
              row.description ||
              row.remarks ||
              row.note,
            "—"
          ),
      },
    ],
    "No checklist items found."
  )}


{activeTopTab === "trackers" &&
  renderListTable(
    "Document Tracking / Monitoring",
    trackers,
    [
      {
        key: "document_type",
        label: "Doc Type",
        render: (row) =>
          toDisplayValue(
            row.document_type_label ||
              row.document_type ||
              row.doc_type ||
              row.name,
            "—"
          ),
      },
      {
        key: "track_type",
        label: "Track Type",
        render: (row) =>
          toDisplayValue(
            row.track_type_label ||
              row.track_type ||
              row.tracker_type ||
              row.tracking_type,
            "—"
          ),
      },
      {
        key: "status",
        label: "Status",
        render: (row) =>
          renderStatusBadge(
            row.status_label ||
              row.status ||
              (row.is_completed
                ? "Completed"
                : row.is_overdue
                ? "Overdue"
                : "Pending")
          ),
      },
      {
        key: "responsible_party",
        label: "Responsible",
        render: (row) =>
          toDisplayValue(
            row.responsible_party ||
              row.responsible ||
              row.assigned_to,
            "—"
          ),
      },
      {
        key: "office",
        label: "Office",
        render: (row) =>
          toDisplayValue(
            row.office ||
              row.office_name ||
              row.office_department ||
              row.destination_office,
            "—"
          ),
      },
      {
        key: "requested_date",
        label: "Requested",
        render: (row) =>
          toDisplayValue(formatDateOnly(row.requested_date), "—"),
      },
      {
        key: "expected_date",
        label: "Expected",
        render: (row) =>
          toDisplayValue(formatDateOnly(row.expected_date), "—"),
      },
      {
        key: "due_date",
        label: "Due Date",
        render: (row) =>
          toDisplayValue(formatDateOnly(row.due_date || row.target_date), "—"),
      },
      {
        key: "received_date",
        label: "Received",
        render: (row) =>
          toDisplayValue(
            formatDateOnly(
              row.received_date ||
                row.date_received ||
                row.completed_at
            ),
            "—"
          ),
      },

      {
  key: "related_document",
  label: "Related Document",
  render: (row) => {
    const label = getRelatedDocumentNameById(row.related_document_id);

    if (!row.related_document_id || label === "—") {
      return toDisplayValue(label, "—");
    }

    return (
      <button
        type="button"
        className="intake-inline-link-btn"
        onClick={() => openRelatedDocumentById(row.related_document_id)}
      >
        {label}
      </button>
    );
  },
},

      {
        key: "timeline",
        label: "Timeline",
        render: (row) =>
          toDisplayValue(getTrackerTimelineLabel(row), "—"),
      },
      {
        key: "remarks",
        label: "Remarks",
        render: (row) =>
          toDisplayValue(
            row.remarks ||
              row.note ||
              row.description,
            "—"
          ),
      },
    ],
    "No document trackers found."
  )}


{activeTopTab === "compliance" &&
  renderListTable(
    "Compliance Monitoring",
    complianceItems,
    [
      {
        key: "title",
        label: "Title",
        render: (row) =>
          toDisplayValue(row.title || row.name, "—"),
      },
      {
        key: "type",
        label: "Type",
        render: (row) =>
          toDisplayValue(
            row.type_label ||
              row.type ||
              row.compliance_type,
            "—"
          ),
      },
      {
        key: "status",
        label: "Status",
        render: (row) =>
          renderStatusBadge(
            row.compliance_status_label ||
              row.status_label ||
              row.compliance_status ||
              row.status ||
              (row.is_complied
                ? "Complied"
                : row.is_overdue
                ? "Overdue"
                : "Pending")
          ),
      },
      {
        key: "issued_date",
        label: "Issued",
        render: (row) =>
          toDisplayValue(formatDateOnly(row.issued_date), "—"),
      },
      {
        key: "due_date",
        label: "Due Date",
        render: (row) =>
          toDisplayValue(formatDateOnly(row.due_date), "—"),
      },
      {
        key: "complied_date",
        label: "Complied Date",
        render: (row) =>
          toDisplayValue(formatDateOnly(row.complied_date), "—"),
      },
      {
        key: "timeline",
        label: "Timeline",
        render: (row) =>
          toDisplayValue(getComplianceTimelineLabel(row), "—"),
      },
      {
        key: "responsible_party",
        label: "Responsible",
        render: (row) =>
          toDisplayValue(row.responsible_party, "—"),
      },
{
  key: "related_document",
  label: "Related Document",
  render: (row) => {
    const label = getRelatedDocumentNameById(row.related_document_id);

    if (!row.related_document_id || label === "—") {
      return toDisplayValue(label, "—");
    }

    return (
      <button
        type="button"
        className="intake-inline-link-btn"
        onClick={() => openRelatedDocumentById(row.related_document_id)}
      >
        {label}
      </button>
    );
  },
},
      {
        key: "remarks",
        label: "Remarks",
        render: (row) =>
          toDisplayValue(
            row.remarks ||
              row.description,
            "—"
          ),
      },
    ],
    "No compliance items found."
  )}


  </div>


    <div className="intake-top-documents">

          <div className="intake-case-top-badges">
      <div className="intake-case-intake-no">
        <span className="intake-case-intake-label">INTAKE NO.</span>
        <span className="intake-case-intake-pill">
          {toDisplayValue(record.intake_case_id, "INT-0000")}
        </span>
      </div>

      <span className="intake-case-badge">
        {toDisplayValue(summaryData.documentType, "—")}
      </span>
    </div>
      <div className="intake-details-panel intake-documents-panel fixed-panel">
        <div className="intake-documents-header">
          <h3>Documents</h3>

          <button
            type="button"
            className="intake-documents-add-btn"
            onClick={handleAddFiles}
          >
            <span className="intake-documents-add-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-5-5 5 5m-5-5v5h5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span>Add files</span>
          </button>
        </div>

        {!documents || documents.length === 0 ? (
          <div className="intake-details-empty">No uploaded documents found.</div>
        ) : (
          <div className="intake-documents-list-wrap">
            <div className="intake-documents-list">
              {visibleDocuments.map((doc, index) => ( 
                <div className="intake-documents-row" key={doc.id || index}>
                  <div className="intake-documents-row-left">
                    <div className="intake-documents-file-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8m-5-5 5 5m-5-5v5h5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M9 13h6M9 17h4"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    <div className="intake-documents-file-meta">
                      <button
                        type="button"
                        className="intake-documents-file-link"
                        onClick={() => handleOpenDocument(doc)}
                        title={toDisplayValue(doc.uploaded_file_name, "Untitled document")}
                      >
                        {toDisplayValue(doc.uploaded_file_name, "Untitled document")}
                      </button>

                      <div className="intake-documents-file-subline">
                        <span className="intake-documents-file-status">
                          {renderStatusBadge(getDocumentStatusLabel(doc))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="intake-documents-row-actions">
                      <button
                        type="button"
                        className="intake-documents-icon-btn"
                        onClick={() => handleDocumentReviewOrEdit(doc)}
                        title={isDocumentReviewed(doc) ? "View / edit reviewed data" : "Review document"}
                      >
                        <PencilLine size={18} />
                      </button>

                    <button
                      className="intake-documents-icon-btn"
                      onClick={() => handleDownloadDocument(doc)}
                    >
                      <Download size={17} />
                    </button>

                    <button
                      type="button"
                      className="intake-documents-icon-btn danger"
                      onClick={() => handleDeleteDocument(doc)}
                    >
                      <Trash2 size={18} />
                    </button>

                    <div className="intake-documents-row-menu-wrap">
  <button
    type="button"
    className="intake-documents-icon-btn"
    onClick={() => toggleDocumentMenu(doc.id)}
    title="More actions"
  >
    <MoreVertical size={18} />
  </button>

  {openDocumentMenuId === doc.id && (
    <div className="intake-documents-row-menu">
      <button
        type="button"
        className="intake-documents-row-menu-item"
        onClick={() => handleOpenDocumentDetails(doc)}
      >
        View full document details
      </button>
    </div>
  )}
</div>
                  </div>
                </div>
              ))}
            </div>
{documents.length > 5 && (
  <button
    type="button"
    className="intake-documents-see-more"
    onClick={() => setShowAllDocuments((prev) => !prev)}
  >
    {showAllDocuments ? "See less" : "See more"}
  </button>
)}
          </div>
        )}
      </div>
    </div>
  </div>

  <div className="intake-case-meta-grid">
    ...
  </div>
</div>
        )}

        {showUploadModal && (
  <div className="intake-modal-backdrop" onClick={closeUploadModal}>
    <div
      className="intake-modal intake-upload-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intake-modal-header">
        <div>
       <h3>
  Upload Additional Document for Intake Case{" "}
  {toDisplayValue(record?.intake_case_id || record?.intake_id, "—")}
</h3>
        </div>

        <button
          type="button"
          className="intake-modal-close"
          onClick={closeUploadModal}
        >
          ×
        </button>
      </div>

      <form onSubmit={handleUploadAdditionalDocument}>
        <div className="intake-modal-body">
          <div className="intake-details-upload-grid">
            <div className="intake-details-upload-field">
              <label>Document Type</label>
              <select
                value={uploadDocumentType}
                onChange={(e) => setUploadDocumentType(e.target.value)}
              >
                <option value="">Select document type</option>
                {documentTypeOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="intake-details-upload-field">
              <label>Date Received</label>
              <input
                type="date"
                value={uploadDateReceived}
                onChange={(e) => setUploadDateReceived(e.target.value)}
              />
            </div>
          </div>

         <div className="intake-details-upload-field-full">
  <label className="intake-upload-section-label">Upload File</label>

  {!uploadFile ? (
    <div className="intake-upload-dropzone-card">
      <label className="intake-upload-dropzone">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
          hidden
        />

        <div className="intake-upload-dropzone-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l1.4 1.6c.3.34.73.54 1.18.54H18.5A2.5 2.5 0 0 1 21 9.64V16.5A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <strong>Drag and drop or choose file</strong>
        <span>Accepted formats: PDF, JPG, PNG • Max 5MB</span>
      </label>
    </div>
  ) : (
<div className="intake-upload-file-card">
  <div className="intake-upload-file-left">
    <div className="intake-upload-file-type">
      {(uploadFile.name?.split(".").pop() || "FILE").toUpperCase()}
    </div>

    <div className="intake-upload-file-info">
      <strong title={uploadFile.name}>{uploadFile.name}</strong>
      <span>{formatFileSize(uploadFile.size)}</span>

      <div className="intake-upload-progress-track">
        <div className="intake-upload-progress-fill" style={{ width: "82%" }} />
      </div>
    </div>
  </div>

  <div className="intake-upload-file-right">
    <button
      type="button"
      className="intake-upload-file-remove"
      onClick={() => setUploadFile(null)}
      aria-label="Remove selected file"
      title="Remove selected file"
    >
      ×
    </button>

    <div className="intake-upload-file-progress-text">Ready</div>
  </div>
</div>
  )}
</div>
        </div>

        <div className="intake-modal-footer">
          <button
            type="button"
            className="intake-modal-btn secondary"
            onClick={closeUploadModal}
            disabled={uploadLoading}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="intake-modal-btn primary"
            disabled={uploadLoading}
          >
            {uploadLoading ? "Uploading..." : "Upload Document"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}
{showProcessingModal && (
  <div className="intake-modal-backdrop">
    <div
      className={`intake-modal intake-processing-modal ${
        showMismatchModal && mismatchInfo ? "is-failed" : ""
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intake-processing-hero">
        <div
          className={`intake-processing-orb ${
            showMismatchModal && mismatchInfo
              ? "is-failed"
              : processingComplete
              ? "is-complete"
              : ""
          }`}
        />

        <div className="intake-processing-copy">
          <span
            className={`intake-processing-badge ${
              showMismatchModal && mismatchInfo ? "is-failed" : ""
            }`}
          >
            {showMismatchModal && mismatchInfo
              ? "Process Failed"
              : processingComplete
              ? "Completed"
              : "Processing"}
          </span>

          <h3>
            {showMismatchModal && mismatchInfo
              ? "Document Mismatch Detected"
              : processingComplete
              ? "Extraction Complete"
              : "Processing Document Extraction"}
          </h3>

          <p className="intake-upload-subtitle">
            {showMismatchModal && mismatchInfo
              ? "The uploaded file does not match the selected document type."
              : processingComplete
              ? "Please review the extracted result before finalizing this uploaded document."
              : "Please wait while the system validates and extracts the additional document data."}
          </p>
        </div>
      </div>

      <div className="intake-modal-body intake-processing-body">
        <div className="intake-processing-progress-top">
          <span className="intake-processing-step">
            {showMismatchModal && mismatchInfo
              ? "Process failed"
              : processingComplete
              ? "Completed successfully"
              : uploadProgress < 35
              ? "Uploading document..."
              : uploadProgress < 75
              ? "Extracting data..."
              : uploadProgress < 100
              ? "Finalizing extracted details..."
              : "Wrapping up..."}
          </span>

          <strong className="intake-processing-percent">
            {showMismatchModal && mismatchInfo ? "Failed" : `${uploadProgress}%`}
          </strong>
        </div>

        <div
          className={`intake-processing-bar-shell modern ${
            showMismatchModal && mismatchInfo ? "is-failed" : ""
          }`}
          role="progressbar"
          aria-valuenow={uploadProgress}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Document extraction progress"
        >
          <div
            className={`intake-processing-bar-fill modern ${
              showMismatchModal && mismatchInfo
                ? "is-failed"
                : processingComplete
                ? "is-complete"
                : ""
            }`}
            style={{
              width:
                showMismatchModal && mismatchInfo ? "100%" : `${uploadProgress}%`,
            }}
          >
            <span className="intake-processing-bar-glow" />
          </div>
        </div>

        {showMismatchModal && mismatchInfo ? (
          <div className="intake-processing-review-note intake-processing-failed-note">
            <span className="intake-processing-review-label">
              Mismatch Details
            </span>

            <div className="intake-upload-success-grid intake-mismatch-grid">
              <div className="intake-upload-success-item">
                <span>File Name</span>
                <strong>{mismatchInfo.file_name || "—"}</strong>
              </div>

              <div className="intake-upload-success-item">
                <span>File Size</span>
                <strong>{mismatchInfo.file_size || "—"}</strong>
              </div>

              <div className="intake-upload-success-item">
                <span>Selected Document Type</span>
                <strong>{mismatchInfo.selected_document_type || "—"}</strong>
              </div>

              <div className="intake-upload-success-item">
                <span>Extracted Document Type</span>
                <strong>{mismatchInfo.detected_document_type || "Unknown"}</strong>
              </div>
            </div>

            <p className="intake-processing-failed-message">
              {mismatchInfo.message ||
                "Process failed. Please check the file and try again."}
            </p>
          </div>
        ) : (
          <div className="intake-processing-review-note">
            <span className="intake-processing-review-label">
              {processingComplete ? "Next Step" : "Processing Status"}
            </span>


          </div>
        )}
      </div>

      <div className="intake-modal-footer">
        {showMismatchModal && mismatchInfo ? (
          <button
            type="button"
            className="intake-modal-btn primary"
            onClick={handleMismatchAcknowledge}
          >
            OK
          </button>
        ) : !processingComplete ? (
          <button type="button" className="intake-modal-btn secondary" disabled>
            Processing...
          </button>
        ) : (
          <>
            <button
              type="button"
              className="intake-modal-btn secondary"
              onClick={() => {
                setShowProcessingModal(false);
                setProcessingComplete(false);
              }}
            >
              Done
            </button>

            <button
              type="button"
              className="intake-modal-btn primary"
              onClick={() => {
                setShowProcessingModal(false);
                setProcessingComplete(false);

                if (uploadedDocumentSummary?.id) {
                  openReviewModal(uploadedDocumentSummary.id);
                }
              }}
            >
              Review
            </button>
          </>
        )}
      </div>
    </div>
  </div>
)}

{showUploadSuccessModal && (
  <div
    className="intake-modal-backdrop"
    onClick={closeUploadSuccessModal}
  >
    <div
      className="intake-modal intake-simple-success-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="intake-simple-success-close"
        onClick={closeUploadSuccessModal}
        aria-label="Close success modal"
      >
        ×
      </button>

      <div className="intake-simple-success-body">
        <h3>Additional document uploaded successfully!</h3>
        <p>
          You can now check it in the documents list and review now or later.
        </p>

        <div className="intake-simple-success-actions">
          <button
            type="button"
            className="intake-simple-success-btn secondary"
            onClick={() => {
              setShowUploadSuccessModal(false);
              if (uploadedDocumentSummary?.id) {
                openReviewModal(uploadedDocumentSummary.id);
              }
            }}
          >
            Review
          </button>

          <button
            type="button"
            className="intake-simple-success-btn primary"
            onClick={closeUploadSuccessModal}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{showDeleteConfirmModal && (
  <div className="intake-modal-backdrop" onClick={closeDeleteConfirmModal}>
    <div
      className="intake-modal intake-delete-confirm-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intake-modal-header">
        <div>
          <h3>Delete Document</h3>
          <p className="intake-upload-subtitle">
            Are you sure you want to delete{" "}
            <strong>{documentToDelete?.uploaded_file_name || "this document"}</strong>?
          </p>
        </div>

        <button
          type="button"
          className="intake-modal-close"
          onClick={closeDeleteConfirmModal}
          disabled={deletingDocument}
        >
          ×
        </button>
      </div>

      <div className="intake-modal-footer intake-delete-confirm-footer">
        <button
          type="button"
          className="intake-modal-btn secondary"
          onClick={closeDeleteConfirmModal}
          disabled={deletingDocument}
        >
          Cancel
        </button>

        <button
          type="button"
          className="intake-modal-btn primary danger"
          onClick={confirmDeleteDocument}
          disabled={deletingDocument}
        >
          {deletingDocument ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  </div>
)}

{showDeleteSuccessModal && (
  <div
    className="intake-modal-backdrop"
    onClick={closeDeleteSuccessModal}
  >
    <div
      className="intake-modal intake-upload-success-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intake-modal-header">
        <div>
          <h3>Document Deleted</h3>
          <p className="intake-upload-subtitle">
            The document was deleted successfully.
          </p>
        </div>

        <button
          type="button"
          className="intake-modal-close"
          onClick={closeDeleteSuccessModal}
        >
          ×
        </button>
      </div>

      <div className="intake-modal-body">
        <div className="intake-upload-success-card">
          <div className="intake-upload-success-title">
            Document deleted successfully
          </div>
        </div>
      </div>

      <div className="intake-modal-footer">
        <button
          type="button"
          className="intake-modal-btn primary"
          onClick={closeDeleteSuccessModal}
        >
          OK
        </button>
      </div>
    </div>
  </div>
)}

{documentDetailsModal.isOpen && documentDetailsModal.document && (
  <div className="intake-modal-backdrop" onClick={handleCloseDocumentDetails}>
    <div
      className="intake-modal intake-document-details-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intake-modal-header intake-document-details-header">
        <div>
          <h3>Document Full Details</h3>
          <p className="intake-document-details-subtitle">
            {toDisplayValue(
              documentDetailsModal.document.uploaded_file_name,
              "Untitled document"
            )}
          </p>
        </div>

        <button
          type="button"
          className="intake-modal-close"
          onClick={handleCloseDocumentDetails}
        >
          ×
        </button>
      </div>
<div className="intake-document-details-search">
  <div className="intake-document-details-search-row">
    <input
      type="text"
      placeholder="Search keyword in document details"
      value={documentDetailsSearch}
      onChange={(e) => setDocumentDetailsSearch(e.target.value)}
      className="intake-document-details-search-input"
    />

    <div className="intake-document-details-search-actions">
      <button
        type="button"
        className="intake-search-nav-btn"
        onClick={() => handlePreviousDetailMatch(totalDetailMatches)}
        disabled={!documentDetailsSearch.trim() || totalDetailMatches === 0}
      >
        Previous
      </button>

      <button
        type="button"
        className="intake-search-nav-btn"
        onClick={() => handleNextDetailMatch(totalDetailMatches)}
        disabled={!documentDetailsSearch.trim() || totalDetailMatches === 0}
      >
        Next
      </button>
    </div>
  </div>

<div className="intake-document-details-search-meta">
  {documentDetailsSearch.trim()
    ? totalDetailMatches > 0
      ? `Match ${activeDetailMatchIndex + 1} of ${totalDetailMatches}`
      : "No matches found"
    : "Type a keyword to search"}
</div>
</div>

      <div className="intake-document-details-body">
        <div className="intake-document-details-grid">
          <div className="intake-details-card">
            <h4>File Information</h4>
            <div className="intake-details-list">
              <div className="intake-details-item">
                <span>File Name</span>
                <strong>
                  {toDisplayValue(
                    documentDetailsModal.document.uploaded_file_name,
                    "—"
                  )}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>File Type</span>
                <strong>{getFileTypeLabel(documentDetailsModal.document)}</strong>
              </div>
              <div className="intake-details-item">
                <span>File Size</span>
                <strong>
                  {formatFileSize(documentDetailsModal.document.file_size)}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Uploaded At</span>
                <strong>
                  {formatDateTime(documentDetailsModal.document.created_at)}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Updated At</span>
                <strong>
                  {formatDateTime(documentDetailsModal.document.updated_at)}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Date Received</span>
                <strong>
                  {formatDateOnly(documentDetailsModal.document.date_received)}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Document Date</span>
                <strong>
                  {formatDateOnly(documentDetailsModal.document.document_date)}
                </strong>
              </div>
            </div>
          </div>

          <div className="intake-details-card">
            <h4>Review Information</h4>
            <div className="intake-details-list">
              <div className="intake-details-item">
                <span>Reviewed</span>
                <strong>
                  {renderYesNo(documentDetailsModal.document.is_reviewed)}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Reviewed By</span>
                <strong>
                  {toDisplayValue(
                    documentDetailsModal.document.reviewed_by_name,
                    "—"
                  )}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Reviewed At</span>
                <strong>
                  {formatDateTime(documentDetailsModal.document.reviewed_at)}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Review Notes</span>
                <strong>
                  {toDisplayValue(
                    documentDetailsModal.document.review_notes,
                    "—"
                  )}
                </strong>
              </div>
            </div>
          </div>

          <div className="intake-details-card">
            <h4>Extraction Status</h4>
            <div className="intake-details-list">
              <div className="intake-details-item">
                <span>Document Status</span>
                <strong>
                  {toDisplayValue(
                    documentDetailsModal.document.document_status_label,
                    "—"
                  )}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>OCR Status</span>
                <strong>
                  {toDisplayValue(
                    documentDetailsModal.document.ocr_status_label,
                    "—"
                  )}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>NLP Status</span>
                <strong>
                  {toDisplayValue(
                    documentDetailsModal.document.nlp_status_label,
                    "—"
                  )}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Has Extraction Issues</span>
                <strong>
                  {renderYesNo(
                    documentDetailsModal.document.has_extraction_issues
                  )}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Review Priority</span>
                <strong>
                  {toDisplayValue(
                    documentDetailsModal.document.review_priority,
                    "—"
                  )}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Source Confidence</span>
                <strong>
                  {toDisplayValue(
                    documentDetailsModal.document.source_confidence,
                    "—"
                  )}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Source Warnings</span>
                <strong>
                  {Array.isArray(documentDetailsModal.document.source_warnings)
                    ? documentDetailsModal.document.source_warnings.join(", ") || "—"
                    : toDisplayValue(
                        documentDetailsModal.document.source_warnings,
                        "—"
                      )}
                </strong>
              </div>
            </div>
          </div>

          <div className="intake-details-card">
            <h4>Document Context</h4>
            <div className="intake-details-list">
              <div className="intake-details-item">
                <span>Initiating Document</span>
                <strong>
                  {renderYesNo(
                    documentDetailsModal.document.is_initiating_document
                  )}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Version No.</span>
                <strong>
                  {toDisplayValue(documentDetailsModal.document.version_no, "—")}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Latest Version</span>
                <strong>
                  {renderYesNo(documentDetailsModal.document.is_latest)}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Version Status</span>
                <strong>
                  {toDisplayValue(
                    documentDetailsModal.document.version_status,
                    "—"
                  )}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Start Page</span>
                <strong>
                  {toDisplayValue(documentDetailsModal.document.start_page, "—")}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>End Page</span>
                <strong>
                  {toDisplayValue(documentDetailsModal.document.end_page, "—")}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Case Applied</span>
                <strong>
                  {renderYesNo(documentDetailsModal.document.is_case_applied)}
                </strong>
              </div>
              <div className="intake-details-item">
                <span>Case Applied At</span>
                <strong>
                  {formatDateTime(documentDetailsModal.document.case_applied_at)}
                </strong>
              </div>
            </div>
          </div>

          <div className="intake-details-card intake-details-card-full">
<h4>
  Clean Text
  {documentDetailsSearch.trim() && (
    <span className="intake-details-match-badge">
      {cleanTextMatches} match{cleanTextMatches === 1 ? "" : "es"}
    </span>
  )}
</h4>
  <div className="intake-details-raw-block">
    {getDocumentCleanText(documentDetailsModal.document) ? (
  <pre className="intake-details-raw-pre">
  {highlightedCleanText}
</pre>
    ) : (
      <div className="intake-details-empty-lite">No clean text available.</div>
    )}
  </div>
</div>

<div className="intake-details-card intake-details-card-full">
  <h4>
  Extracted Data
  {documentDetailsSearch.trim() && (
    <span className="intake-details-match-badge">
      {extractedMatches} match{extractedMatches === 1 ? "" : "es"}
    </span>
  )}
</h4>
  <div className="intake-details-raw-block">
  <pre className="intake-details-raw-pre">
  {highlightedExtractedData}
</pre>
  </div>
</div>

<div className="intake-details-card intake-details-card-full">
 <h4>
  Reviewed Data
  {documentDetailsSearch.trim() && (
    <span className="intake-details-match-badge">
      {reviewedMatches} match{reviewedMatches === 1 ? "" : "es"}
    </span>
  )}
</h4>
  <div className="intake-details-raw-block">
<pre className="intake-details-raw-pre">
  {highlightedReviewedData}
</pre>  
  </div>
</div>
        </div>
      </div>

      <div className="intake-modal-footer">
        <button
          type="button"
          className="intake-modal-btn secondary"
          onClick={handleCloseDocumentDetails}
        >
          Close
        </button>
      </div>
    </div>
  </div>
)}

        <DocumentReviewModal
          isOpen={reviewModal.isOpen}
          documentId={reviewModal.documentId}
          prosecutorOptions={prosecutorOptions}
          onClose={closeReviewModal}
          onSaved={handleReviewSaved}
        />

<IntakeCaseDetailsReviewedModal
  isOpen={reviewedDetailsModal.isOpen}
  documentId={reviewedDetailsModal.documentId}
  intakeCaseId={record?.intake_case_id || "—"}
  prosecutorOptions={prosecutorOptions}
  onClose={closeReviewedDetailsModal}
  onSaved={async () => {
    setMsg("Reviewed data successfully updated.");
    await loadDetails();
  }}
/>
      </div>
    </UserLayout>
  );
}
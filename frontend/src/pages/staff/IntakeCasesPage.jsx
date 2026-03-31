// src/pages/staff/IntakeCasesPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RotateCcw,
  RefreshCw,
  SlidersHorizontal,
  X,
} from "lucide-react";

import api from "../../api";
import UserLayout from "../../components/UserLayout";
import { getStoredUser, setStoredUser } from "../../utils/storage";
import { isAdminLevel, isStaff } from "../../utils/roles";
import {
  createIntakeCase,
  uploadIntakeCaseDocument,
  confirmIntakeCase,
  saveIntakeCaseDraft, // ✅ ADD THIS
} from "../../services/staffService";

import ReviewedDataModal from "../../components/staff/ReviewedDataModal";
import DocumentReviewModal from "../../components/staff/DocumentReviewModal";

import "../../styles/staff/intake-cases-page.css";

export default function IntakeCasesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser());

  const [lastReviewedDocumentId, setLastReviewedDocumentId] = useState(null);

  const [pageLoading, setPageLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [err, setErr] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [caseType, setCaseType] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const [showCaseCreatedSuccessModal, setShowCaseCreatedSuccessModal] =
  useState(false);
const [createdSuccessInfo, setCreatedSuccessInfo] = useState(null);

  const [selectedCase, setSelectedCase] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState(null);

  const [showReviewedDataModal, setShowReviewedDataModal] = useState(false);
  const [reviewedDocumentPayload, setReviewedDocumentPayload] = useState(null);

  const [confirmingIntake, setConfirmingIntake] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [readyToConfirmCaseId, setReadyToConfirmCaseId] = useState(null);

  const [createdIntakeCase, setCreatedIntakeCase] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [initiatingDocumentType, setInitiatingDocumentType] = useState("");
  const [initiatingFile, setInitiatingFile] = useState(null);
  const [initiatingUploadLoading, setInitiatingUploadLoading] = useState(false);

  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingComplete, setProcessingComplete] = useState(false);

  const [uploadedInitiatingDocument, setUploadedInitiatingDocument] =
    useState(null);
  const [showUploadSuccessModal, setShowUploadSuccessModal] = useState(false);
  const [uploadedDocumentSummary, setUploadedDocumentSummary] = useState(null);

  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    documentId: null,
  });

  const [showReviewSavedToast, setShowReviewSavedToast] = useState(false);

  const [showMismatchModal, setShowMismatchModal] = useState(false);
  const [mismatchInfo, setMismatchInfo] = useState(null);

  const [prosecutorOptions, setProsecutorOptions] = useState([]);

const [filters, setFilters] = useState({
  search: "",
  status: "",
});

  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    total_pages: 1,
  });

  const intakeTabs = [
    { key: "all", label: "Intake Cases" },
    { key: "inv", label: "Preliminary Investigation (INV)" },
    { key: "inq", label: "Inquest Proceedings (INQ)" },
    { key: "dismissed", label: "Dismissed Intake Cases" },
    { key: "drafts", label: " Intake Drafts" },
  ];

  const formatDateTime = (value) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

function formatFileSize(bytes) {
  if (bytes == null || isNaN(bytes)) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Number(bytes);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
function formatIntakeId(id) {
  if (!id) return "—";
  return `INT-${String(id).padStart(4, "0")}`;
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
      return value
        .map((item) => normalizeText(item))
        .filter(Boolean)
        .join(" ");
    }

    if (typeof value === "object") {
      const preferred = [
        value.label,
        value.name,
        value.full_name,
        value.status,
        value.document_type,
        value.value,
        value.title,
        value.display_name,
      ]
        .filter(Boolean)
        .join(" ");

      if (preferred) return preferred.trim().toLowerCase();

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
      const rendered = value
        .map((item) => toDisplayValue(item, ""))
        .filter((item) => item && item !== "—")
        .join(", ");
      return rendered || fallback;
    }

    if (typeof value === "object") {
      const preferred =
        value.label ||
        value.name ||
        value.full_name ||
        value.status ||
        value.document_type ||
        value.value ||
        value.title ||
        value.display_name ||
        value.case_title ||
        value.uploaded_file_name;

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

  function getAssignedProsecutorDisplay(item) {
    return toDisplayValue(
      item.assigned_prosecutor_label ||
        item.assigned_prosecutor_name ||
        item.assigned_prosecutor?.name ||
        item.assigned_prosecutor?.full_name ||
        item.assigned_prosecutor,
      "—"
    );
  }

  function getStatusDisplay(value, fallback = "—") {
    return toDisplayValue(value, fallback);
  }

  function formatFileSize(bytes) {
    if (bytes == null || isNaN(bytes)) return "0 B";

    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = Number(bytes);
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${
      units[unitIndex]
    }`;
  }

  const initiatingDocumentOptions = useMemo(() => {
    if (caseType === "INV") {
      return [{ value: "complaint_affidavit", label: "Complaint Affidavit" }];
    }

    if (caseType === "INQ") {
      return [
        { value: "police_report", label: "Police Report" },
        { value: "arrest_report", label: "Arrest Report" },
        { value: "affidavit_of_arrest", label: "Affidavit of Arrest" },
        {
          value: "affidavit_of_apprehension",
          label: "Affidavit of Apprehension",
        },
      ];
    }

    return [];
  }, [caseType]);

  useEffect(() => {
    const anyModalOpen =
      showCreateModal ||
      showUploadModal ||
      showProcessingModal ||
      showMismatchModal;

    if (anyModalOpen) {
      document.body.classList.add("intake-modal-open");
    } else {
      document.body.classList.remove("intake-modal-open");
    }

    return () => {
      document.body.classList.remove("intake-modal-open");
    };
  }, [
    showCreateModal,
    showUploadModal,
    showProcessingModal,
    showMismatchModal,
  ]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!user || !isStaff(user)) return;
    fetchIntakeCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, activeTab]);

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

  async function init() {
    if (!user) {
      navigate("/");
      return;
    }

    try {
      setPageLoading(true);
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

      await loadProsecutors();
    } catch (e) {
      setErr(e?.response?.data?.message || "Failed to load intake cases page.");
    } finally {
      setPageLoading(false);
    }
  }

  function openDetailsModal(caseItem) {
    setSelectedCase(caseItem);
    setShowDetailsModal(true);
  }

  function closeDetailsModal() {
    setSelectedCase(null);
    setShowDetailsModal(false);
  }

  async function fetchIntakeCases(customPage = pagination.page) {
    try {
      setTableLoading(true);
      setErr("");

const params = {
  page: customPage,
  per_page: pagination.per_page || 10,
  search: filters.search,
  tab: activeTab,
};

if (activeTab === "inv") params.case_type = "INV";
if (activeTab === "inq") params.case_type = "INQ";

      if (filters.search) params.search = filters.search;
      if (filters.caseType) params.case_type = filters.caseType;
      if (filters.intakeStatus) params.intake_status = filters.intakeStatus;
      if (filters.intakeDocumentStatus) {
        params.intake_document_status = filters.intakeDocumentStatus;
      }
      if (filters.prosecutionResult) {
        params.prosecution_result = filters.prosecutionResult;
      }
      if (filters.assignedProsecutor) {
        params.assigned_prosecutor_id = filters.assignedProsecutor;
      }

      const res = await api.get("/staff/intake-cases", { params });

      const payload = res?.data?.data || {};

      const extractedRows = Array.isArray(payload)
        ? payload
        : payload.intake_cases ||
          payload.items ||
          payload.rows ||
          payload.records ||
          payload.intakeCases ||
          [];

      const extractedPagination = payload.pagination || payload.meta || {};

      setRows(Array.isArray(extractedRows) ? extractedRows : []);

      setPagination({
        page: Number(extractedPagination.page || customPage || 1),
        per_page: Number(
          extractedPagination.per_page ||
            extractedPagination.perPage ||
            Number(filters.perPage || 10)
        ),
        total: Number(extractedPagination.total || extractedRows.length || 0),
        total_pages: Number(
          extractedPagination.total_pages ||
            extractedPagination.totalPages ||
            1
        ),
      });
    } catch (e) {
      console.error("fetch intake error:", e?.response?.data || e);
      setErr(e?.response?.data?.message || "Failed to fetch intake cases.");
      setRows([]);
      setPagination((prev) => ({
        ...prev,
        total: 0,
        total_pages: 1,
      }));
    } finally {
      setTableLoading(false);
    }
  }

  function isConfirmedCase(item) {
    const intakeStatus = normalizeText(
      item.intake_status_label || item.intake_status
    );

    return (
      intakeStatus.includes("confirmed") ||
      intakeStatus.includes("for_confirmation_done") ||
      intakeStatus.includes("ready_for_conversion") ||
      intakeStatus.includes("ready for conversion")
    );
  }

  function isDraftCase(item) {
    const intakeStatus = normalizeText(
      item.intake_status_label || item.intake_status
    );

    return intakeStatus === "draft";
  }

  function isDismissedCase(item) {
    const prosecutionResult = normalizeText(
      item.prosecution_result_label || item.prosecution_result
    );

    return (
      prosecutionResult.includes("without probable cause") ||
      prosecutionResult.includes("no probable cause") ||
      prosecutionResult.includes("dismissed")
    );
  }

  function openCreateModal() {
    setCaseType("");
    setReviewNotes("");
    setCreatedIntakeCase(null);
    setShowUploadModal(false);
    setShowUploadSuccessModal(false);
    setUploadedDocumentSummary(null);
    setUploadedInitiatingDocument(null);
    setShowMismatchModal(false);
    setMismatchInfo(null);
    setShowProcessingModal(false);
    setUploadProgress(0);
    setInitiatingDocumentType("");
    setInitiatingFile(null);
    setProcessingComplete(false);
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
      setErr("");

      const res = await createIntakeCase({
        case_type: caseType,
        review_notes: reviewNotes,
      });

      const createdCase = res?.data?.data?.intake_case || null;

      if (!createdCase?.id) {
        throw new Error(
          "Intake workflow initialized but no intake case ID was returned."
        );
      }

      setCreatedIntakeCase(createdCase);
      setShowCreateModal(false);

      if (caseType === "INV") {
        setInitiatingDocumentType("complaint_affidavit");
      } else {
        setInitiatingDocumentType("");
      }

      setInitiatingFile(null);
      setUploadedInitiatingDocument(null);
      setUploadedDocumentSummary(null);
      setShowUploadModal(true);

      // Option B: the backend creates only a hidden pre-intake record here.
      // No need to refresh the list yet because it should not appear until
      // it becomes a true draft or a confirmed intake case.
    } catch (error) {
      alert(
        error?.response?.data?.message || "Failed to initialize intake workflow."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function closeUploadModal() {
    if (initiatingUploadLoading) return;
    setShowUploadModal(false);
    setShowMismatchModal(false);
    setMismatchInfo(null);
  }

  function closeUploadSuccessModal() {
    setShowUploadSuccessModal(false);
  }

  function handleMismatchAcknowledge() {
    setShowMismatchModal(false);
    setShowProcessingModal(false);
    setShowUploadSuccessModal(false);
    setProcessingComplete(false);
    setUploadProgress(0);
    setShowUploadModal(true);
  }

  function openReusableReviewModal(documentId) {
    setReviewModal({
      isOpen: true,
      documentId,
    });
  }

  function closeReusableReviewModal() {
    setReviewModal({
      isOpen: false,
      documentId: null,
    });
  }

  async function handleSaveDraftFromProcessing() {
    if (!createdIntakeCase?.id) {
      setShowProcessingModal(false);
      setProcessingComplete(false);
      return;
    }

    try {
      setSavingDraft(true);
      setErr("");

      await saveIntakeCaseDraft(createdIntakeCase.id, {
  review_notes: reviewNotes || null,
});

      setShowProcessingModal(false);
      setProcessingComplete(false);
      setShowMismatchModal(false);
      setMismatchInfo(null);
      setUploadProgress(0);
      setInitiatingFile(null);

      await fetchIntakeCases(1);
      setActiveTab("drafts");
      alert("Intake case saved as draft.");
    } catch (error) {
      alert(
        error?.response?.data?.message ||
          error?.response?.data?.errors?.[0] ||
          "Failed to save intake case as draft."
      );
    } finally {
      setSavingDraft(false);
    }
  }


  async function handleUploadInitiatingDocument(e) {
  e.preventDefault();

  if (!createdIntakeCase?.id) {
    alert("Missing intake case reference.");
    return;
  }

  if (!initiatingDocumentType) {
    alert("Please select the initiating document type.");
    return;
  }

  if (!initiatingFile) {
    alert("Please choose a file to upload.");
    return;
  }

  try {
    setInitiatingUploadLoading(true);
    setErr("");
    setShowUploadModal(false);
    setShowUploadSuccessModal(false);
    setShowMismatchModal(false);
    setMismatchInfo(null);
    setShowProcessingModal(true);
    setProcessingComplete(false);
    setUploadProgress(20);

    const currentFileName = initiatingFile?.name || "—";
    const currentFileSize = initiatingFile?.size || 0;
    const currentDocumentType = initiatingDocumentType;

    const formData = new FormData();
    formData.append("document", initiatingFile);
    formData.append("document_type", initiatingDocumentType);
    formData.append("upload_mode", "extract");

    setUploadProgress(45);

    const res = await uploadIntakeCaseDocument(createdIntakeCase.id, formData);
    const uploadedDoc = res?.data?.data?.document || null;

    const detectedDocumentType =
      uploadedDoc?.detected_document_type ||
      uploadedDoc?.extracted_data?.document_type ||
      "";

    const uploadedType = String(currentDocumentType || "")
      .trim()
      .toLowerCase();
    const detectedType = String(detectedDocumentType || "")
      .trim()
      .toLowerCase();

    const isMismatch =
      Boolean(detectedType) &&
      Boolean(uploadedType) &&
      detectedType !== uploadedType;

    if (isMismatch) {
      setUploadProgress(100);
      setProcessingComplete(false);

      setMismatchInfo({
        file_name: uploadedDoc?.uploaded_file_name || currentFileName,
        file_size: uploadedDoc?.file_size ?? currentFileSize,
        selected_document_type: currentDocumentType,
        detected_document_type: detectedDocumentType || "Unknown",
        message:
          "Process failed. Failed to save the data because the uploaded document does not match the selected initiating document type. Please check the file and try again.",
      });

      setShowMismatchModal(true);
      return;
    }

    setUploadProgress(100);
    setProcessingComplete(true);

    setUploadedInitiatingDocument(uploadedDoc);
    setUploadedDocumentSummary(uploadedDoc);
    setInitiatingFile(null);

    await fetchIntakeCases(1);
  } catch (error) {
    const backendMessage =
      error?.response?.data?.message ||
      error?.response?.data?.errors?.[0] ||
      "";

    const normalizedMessage = String(backendMessage).toLowerCase();

    const isBackendMismatch =
      normalizedMessage.includes("not an initiating document type") ||
      normalizedMessage.includes("does not match") ||
      normalizedMessage.includes("document mismatch") ||
      normalizedMessage.includes("uploaded document");

    if (isBackendMismatch) {
      setUploadProgress(100);
      setProcessingComplete(false);

      setMismatchInfo({
        file_name: initiatingFile?.name || "—",
        file_size: initiatingFile?.size || 0,
        selected_document_type: initiatingDocumentType || "—",
        detected_document_type: "Unknown",
        message:
          backendMessage ||
          "Process failed. Failed to save the data because the uploaded document does not match the selected initiating document type. Please check the file and try again.",
      });

      setShowMismatchModal(true);
      return;
    }

    setShowProcessingModal(false);
    setProcessingComplete(false);
    setShowMismatchModal(false);
    setMismatchInfo(null);

    alert(backendMessage || "Failed to upload initiating document.");
  } finally {
    setInitiatingUploadLoading(false);
  }
}

async function handleReviewSaved(payload) {
  const previousDocumentId =
    reviewModal.documentId ||
    payload?.document?.id ||
    null;

  setLastReviewedDocumentId(previousDocumentId);

  closeReusableReviewModal();
  setReviewedDocumentPayload(payload);

  const intakeCaseId =
    createdIntakeCase?.id ||
    payload?.intakeCaseId ||
    payload?.intake_case_id ||
    payload?.intake_case?.id ||
    null;

  setReadyToConfirmCaseId(intakeCaseId);
  setShowReviewedDataModal(true);
}

async function handleConfirmReviewedIntakeCase() {
  if (!readyToConfirmCaseId) {
    alert("Missing intake case reference.");
    return;
  }

  try {
    setConfirmingIntake(true);
    setErr("");

    await confirmIntakeCase(readyToConfirmCaseId, {});

    setShowReviewedDataModal(false);

    await fetchIntakeCases(1);

    const confirmedType = normalizeText(
      createdIntakeCase?.case_type || reviewedDocumentPayload?.document?.case_type
    );

    if (confirmedType === "inv") {
      setActiveTab("inv");
    } else if (confirmedType === "inq") {
      setActiveTab("inq");
    } else {
      setActiveTab("all");
    }

setCreatedSuccessInfo({
  intake_case_id:
    createdIntakeCase?.intake_case_id ||
    reviewedDocumentPayload?.intakeCase?.intake_case_id ||
    "—",
  message: "Intake case confirmed successfully.",
});
setShowReviewedDataModal(false);
setLastReviewedDocumentId(null);

    setShowCaseCreatedSuccessModal(true);
  } catch (error) {
    alert(
      error?.response?.data?.message ||
        error?.response?.data?.errors?.[0] ||
        "Failed to confirm intake case."
    );
  } finally {
    setConfirmingIntake(false);
  }
}

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
    status: "",
    caseType: "",
    intakeStatus: "",
    intakeDocumentStatus: "",
    prosecutionResult: "",
    assignedProsecutor: "",
    sortBy: "",
    sortDirection: "desc",
    perPage: "10",
  });
  setPagination((prev) => ({ ...prev, page: 1 }));
}

  function handleRefreshFilters() {
    fetchIntakeCases(1);
  }

  function handleApplyFilters() {
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchIntakeCases(1);
    setShowFilters(false);
  }

  const activeFilterEntries = useMemo(
    () =>
      [
        filters.search && { key: "search", label: `Search: ${filters.search}` },
        filters.caseType && {
          key: "caseType",
          label: `Case Type: ${filters.caseType}`,
        },
        filters.intakeStatus && {
          key: "intakeStatus",
          label: `Status: ${filters.intakeStatus}`,
        },
        filters.intakeDocumentStatus && {
          key: "intakeDocumentStatus",
          label: `Document: ${filters.intakeDocumentStatus}`,
        },
        filters.prosecutionResult && {
          key: "prosecutionResult",
          label: `Result: ${filters.prosecutionResult}`,
        },
        filters.assignedProsecutor && {
          key: "assignedProsecutor",
          label: `Prosecutor ID: ${filters.assignedProsecutor}`,
        },
        filters.sortBy && {
          key: "sortBy",
          label: `Sort By: ${filters.sortBy}`,
        },
        filters.sortDirection !== "desc" && {
          key: "sortDirection",
          label: `Direction: ${filters.sortDirection}`,
        },
        filters.perPage !== "10" && {
          key: "perPage",
          label: `Per Page: ${filters.perPage}`,
        },

      ].filter(Boolean),
    [filters]
  );

  function removeFilterChip(key) {
   const nextValue =
  key === "sortDirection"
    ? "desc"
    : key === "perPage"
    ? "10"
    : "";

    setFilters((prev) => ({
      ...prev,
      [key]: nextValue,
    }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  }

  const displayRows = useMemo(() => {
    return Array.isArray(rows) ? rows : [];
  }, [rows]);

  function goToPreviousPage() {
    if (pagination.page <= 1) return;
    setPagination((prev) => ({ ...prev, page: prev.page - 1 }));
  }

  function goToNextPage() {
    if (pagination.page >= pagination.total_pages) return;
    setPagination((prev) => ({ ...prev, page: prev.page + 1 }));
  }

  function getStatusClass(value = "") {
    const normalized = normalizeText(value);

    if (
      normalized.includes("ready") ||
      normalized.includes("complete") ||
      normalized.includes("with probable")
    ) {
      return "success";
    }

    if (
      normalized.includes("review") ||
      normalized.includes("confirmation") ||
      normalized.includes("pending")
    ) {
      return "warning";
    }

    if (
      normalized.includes("dismissed") ||
      normalized.includes("incomplete") ||
      normalized.includes("without probable")
    ) {
      return "danger";
    }

    return "neutral";
  }

  if (!user) {
    return <div style={{ padding: 20 }}>Redirecting...</div>;
  }

  return (
    <UserLayout
      user={user}
      sectionBadge="INTAKE CASES"
      pageTitle="Intake Cases"
      pageSubtitle="Create, filter, review, and manage intake case records."
    >

          <div className="intake-page-shell">
          <div className="intake-actions-row">
            <div className="intake-actions-left">
              <button
                className="intake-toolbar-btn back-btn"
                onClick={() => navigate("/staff/dashboard")}
                type="button"
              >
                ← Back
              </button>
            </div>

            <div className="intake-actions-right">
              <button
                className="intake-toolbar-btn primary"
                onClick={openCreateModal}
                type="button"
              >
                + Add New Intake Case
              </button>

              <button
                className={`intake-toolbar-btn secondary ${
                  showFilters ? "is-active" : ""
                }`}
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
              >
                <SlidersHorizontal size={16} />
                <span>{showFilters ? "Hide Filters" : "Filters"}</span>
                {activeFilterEntries.length > 0 && (
                  <span className="intake-toolbar-badge">
                    {activeFilterEntries.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="intake-workspace-shell">
            <div className="intake-tabs-shell">
              <div className="intake-tabs-track">
                {intakeTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`intake-tab-btn ${
                      activeTab === tab.key ? "active" : ""
                    }`}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {pageLoading ? (
              <div className="intake-panel intake-workspace-panel">
                <div className="intake-cases-empty">Loading intake cases...</div>
              </div>
            ) : err && !rows.length ? (
              <div className="intake-panel intake-workspace-panel">
                <div className="intake-cases-empty">{err}</div>
              </div>
            ) : (
              <>
                {showFilters && (
                  <div className="intake-filters-layout">
                    <div className="intake-filters-shell">
                      <div className="intake-filters-topbar">
                        <div className="intake-filters-topbar-left">
                          <div className="intake-filters-eyebrow">
                            Filter Tools
                          </div>
                          <h4>Refine Intake Records</h4>
                          <p>
                            Search, narrow, and organize intake case entries
                            using grouped filter controls.
                          </p>
                        </div>

                        <div className="intake-filter-toolbar-actions">
                          <div className="intake-filter-count">
                            {activeFilterEntries.length} active
                          </div>

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

                          <button
                            type="button"
                            className="intake-icon-btn"
                            onClick={() => setShowFilters(false)}
                            title="Close Filters"
                            aria-label="Close Filters"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>

                      {activeFilterEntries.length > 0 && (
                        <div className="intake-filter-chips">
                          {activeFilterEntries.map((item) => (
                            <button
                              key={item.key}
                              type="button"
                              className="intake-filter-chip"
                              onClick={() => removeFilterChip(item.key)}
                              title="Remove filter"
                            >
                              <span>{item.label}</span>
                              <span className="intake-filter-chip-x">×</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="intake-filter-sections">
                        <div className="intake-filter-section">
                          <div className="intake-filter-section-head">
                            <h5>Search & Quick Find</h5>
                            <p>
                              Look up intake records by ID, title, or
                              complainant.
                            </p>
                          </div>

                          <div className="intake-filter-section-grid intake-filter-section-grid-single">
                            <div className="intake-form-group">
                              <label htmlFor="search">Search</label>
                              <input
                                id="search"
                                name="search"
                                type="text"
                                className="intake-form-control intake-select"
                                placeholder="Search intake ID, title, complainant..."
                                value={filters.search}
                                onChange={handleFilterChange}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="intake-filter-section">
                          <div className="intake-filter-section-head">
                            <h5>Case Details</h5>
                            <p>
                              Filter records using intake attributes and case
                              handling status.
                            </p>
                          </div>

                          <div className="intake-filter-section-grid">
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
                                <option value="INV">
                                  Preliminary Investigation (INV)
                                </option>
                                <option value="INQ">
                                  Inquest Proceedings (INQ)
                                </option>
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
                                <option value="needs_review">For Extraction Review</option>
                                <option value="for_confirmation">
                                  For Confirmation
                                </option>
                                <option value="ready_for_conversion">
                                  Ready for Conversion
                                </option>
                                <option value="draft">Draft</option>
                              </select>
                            </div>

                            <div className="intake-form-group">
                              <label htmlFor="intakeDocumentStatus">
                                Document Status
                              </label>
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
                              <label htmlFor="prosecutionResult">
                                Prosecution Result
                              </label>
                              <select
                                id="prosecutionResult"
                                name="prosecutionResult"
                                className="intake-form-control"
                                value={filters.prosecutionResult}
                                onChange={handleFilterChange}
                              >
                                <option value="">All prosecution results</option>
                                <option value="with_probable_cause">
                                  With Probable Cause
                                </option>
                                <option value="without_probable_cause">
                                  Without Probable Cause
                                </option>
                                <option value="dismissed">Dismissed</option>
                                <option value="pending">Pending</option>
                              </select>
                            </div>

                            <div className="intake-form-group">
                              <label htmlFor="assignedProsecutor">
                                Assigned Prosecutor
                              </label>
                              <select
                                id="assignedProsecutor"
                                name="assignedProsecutor"
                                className="intake-form-control"
                                value={filters.assignedProsecutor}
                                onChange={handleFilterChange}
                              >
                                <option value="">All prosecutors</option>
                                {prosecutorOptions.map((prosecutor) => (
                                  <option
                                    key={prosecutor.id}
                                    value={prosecutor.id}
                                  >
                                    {prosecutor.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="intake-filter-section">
                          <div className="intake-filter-section-head">
                            <h5>View Options</h5>
                            <p>
                              Control sorting, display order, and list size.
                            </p>
                          </div>

                          <div className="intake-filter-section-grid">
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
                                <option value="intake_status">
                                  Intake Status
                                </option>
                              </select>
                            </div>

                            <div className="intake-form-group">
                              <label htmlFor="sortDirection">
                                Sort Direction
                              </label>
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
                        </div>
                      </div>

                      <div className="intake-filters-footer">

                        <div className="intake-filters-footer-actions">
                          <button
                            type="button"
                            className="intake-filter-footer-btn subtle"
                            onClick={() => setShowFilters(false)}
                          >
                            Close
                          </button>

                          <button
                            type="button"
                            className="intake-filter-footer-btn primary"
                            onClick={handleApplyFilters}
                          >
                            Apply Filters
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

          <div className="intake-panel intake-workspace-panel">
            {tableLoading ? (
  <div className="intake-loading-table">
    <div className="intake-loading-table-head">
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>

    {Array.from({ length: 6 }).map((_, index) => (
      <div className="intake-loading-table-row" key={index}>
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    ))}

    <div className="intake-loading-message">Loading intake cases...</div>
  </div>
) : (
              <div className="intake-table-shell">
                
                  <table className="intake-table">
                    <thead>
                      <tr>
                        <th>Intake ID</th>
                        <th>Docket Number</th>
                        <th>Case Title</th>
                        <th>Assigned Prosecutor</th>
                        <th>Intake Status</th>
                        <th>Actions</th>
                        <th>Updated At</th>
                      </tr>
                    </thead>

                    <tbody>
                      {displayRows.length > 0 ? (
                        displayRows.map((item) => {
                          const rowKey = item.id;
                          const intakeStatusValue =
                            item.intake_status_label || item.intake_status;

                          return (
                            <tr key={rowKey}>
                              <td>{formatIntakeId(item.id)}</td>
                              <td>{toDisplayValue(item.docket_number, "—")}</td>
                              <td className="intake-table-title-cell">
                                {toDisplayValue(item.case_title, "—")}
                              </td>
                              <td>{getAssignedProsecutorDisplay(item)}</td>
                              <td>
                                <span
                                  className={`intake-table-status ${getStatusClass(
                                    intakeStatusValue
                                  )}`}
                                >
                                  {getStatusDisplay(intakeStatusValue, "—")}
                                </span>
                              </td>
                              <td>
                                <button
                                        type="button"
                                        className="intake-table-action-btn"
                                        onClick={() => navigate(`/staff/intake-cases/${item.id}`)}
                                          
                                        
                                      >
                                        View Details
                                      </button>
                              </td>
                              <td>{formatDateTime(item.updated_at)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="7" className="intake-table-empty-cell">
                            No intake cases found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                

                <div className="intake-pagination">
                  <button
                    type="button"
                    className="intake-pagination-btn"
                    onClick={goToPreviousPage}
                    disabled={pagination.page === 1}
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
                    onClick={goToNextPage}
                    disabled={pagination.page === pagination.total_pages}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
{showCreateModal && (
  <div className="intake-modal-backdrop" onClick={closeCreateModal}>
    <div className="intake-modal" onClick={(e) => e.stopPropagation()}>
      <span className="intake-modal-eyebrow">Intake Management</span>

      <div className="intake-modal-header">
        <div>
          <h3>Start Intake Workflow</h3>
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
            <label htmlFor="createCaseType">Case Type</label>
            <select
              id="createCaseType"
              className="intake-form-control intake-select"
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
            {submitting ? "Starting..." : "Next"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{showUploadModal && createdIntakeCase && (
  <div className="intake-modal-backdrop">
    <div
      className="intake-modal intake-upload-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intake-modal-header">
        <div>
          <h3>Initiating Document Required</h3>
          <p className="intake-upload-subtitle">
            Upload and extract the initiating document to continue the
            intake workflow.
          </p>
        </div>

        <button
          type="button"
          className="intake-modal-close"
          onClick={closeUploadModal}
        >
          ×
        </button>
      </div>

      <form onSubmit={handleUploadInitiatingDocument}>
        <div className="intake-modal-body">
          <div className="intake-details-upload-grid">
            <div className="intake-details-upload-field">
              <label htmlFor="initiatingDocumentType">
                Initiating Document Type
              </label>
              <select
                id="initiatingDocumentType"
                className="intake-form-control"
                value={initiatingDocumentType}
                onChange={(e) => setInitiatingDocumentType(e.target.value)}
                disabled={caseType === "INV"}
              >
                <option value="">Select initiating document</option>
                {initiatingDocumentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="intake-details-upload-field">
              <label htmlFor="initiatingDateReceived">Date Received</label>
              <input
                id="initiatingDateReceived"
                type="date"
                className="intake-form-control"
                value=""
                readOnly
                disabled
              />
            </div>

            <div className="intake-details-upload-field-full">
              <label className="intake-upload-section-label">Upload File</label>

              {!initiatingFile ? (
                <div className="intake-upload-dropzone-card">
                  <label className="intake-upload-dropzone">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        setInitiatingFile(e.target.files?.[0] || null)
                      }
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
                <div className="intake-upload-selected-card">
                  <div className="intake-upload-selected-main">
                    <div className="intake-upload-selected-badge">
                      {(initiatingFile.name?.split(".").pop() || "FILE").toUpperCase()}
                    </div>

                    <div className="intake-upload-selected-meta">
                      <strong title={initiatingFile.name}>
                        {initiatingFile.name}
                      </strong>
                      <span>{formatFileSize(initiatingFile.size)}</span>

                      <div className="intake-upload-selected-progress">
                        <div className="intake-upload-selected-progress-fill" />
                      </div>
                    </div>

                    <div className="intake-upload-selected-status">Ready</div>
                  </div>

                  <button
                    type="button"
                    className="intake-upload-selected-remove"
                    onClick={() => setInitiatingFile(null)}
                    aria-label="Remove selected file"
                    title="Remove selected file"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="intake-modal-footer">
          <button
            type="button"
            className="intake-modal-btn secondary"
            onClick={closeUploadModal}
            disabled={initiatingUploadLoading}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="intake-modal-btn primary"
            disabled={initiatingUploadLoading}
          >
            {initiatingUploadLoading
              ? "Uploading..."
              : "Upload Initiating Document"}
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
                      ? "The uploaded file does not match the selected initiating document type."
                      : processingComplete
                      ? "Please review the extracted result. Cancelling here will save this record under Intake Drafts."
                      : "Please wait while the system validates and extracts the initiating document data."}
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
                      ? "Finalizing record..."
                      : "Wrapping up..."}
                  </span>

                  <strong className="intake-processing-percent">
                    {showMismatchModal && mismatchInfo
                      ? "Failed"
                      : `${uploadProgress}%`}
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
                        showMismatchModal && mismatchInfo
                          ? "100%"
                          : `${uploadProgress}%`,
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
                        <strong>
                          {formatFileSize(mismatchInfo.file_size)}
                        </strong>
                      </div>

                      <div className="intake-upload-success-item">
                        <span>Selected Document Type</span>
                        <strong>
                          {mismatchInfo.selected_document_type || "—"}
                        </strong>
                      </div>

                      <div className="intake-upload-success-item">
                        <span>Extracted Document Type</span>
                        <strong>
                          {mismatchInfo.detected_document_type || "Unknown"}
                        </strong>
                      </div>
                    </div>

                    <p className="intake-processing-failed-message">
                      {mismatchInfo.message ||
                        "Process failed. Failed to save the data because the uploaded document does not match the selected initiating document type. Please check the file and try again."}
                    </p>
                  </div>
                ) : (
                  <div className="intake-processing-review-note">
                    <span className="intake-processing-review-label">
                      {processingComplete ? "Next Step" : "Processing Status"}
                    </span>

                    <p>
                      {processingComplete
                        ? "The extracted data from the initiating document requires review. Review it now, or cancel to save it under Intake Drafts."
                        : uploadProgress < 35
                        ? "Uploading the initiating document. Please wait..."
                      
                        : "Finalizing the extracted document details..."}
                    </p>
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
                  <button
                    type="button"
                    className="intake-modal-btn secondary"
                    disabled
                  >
                    Processing...
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="intake-modal-btn secondary"
                      onClick={handleSaveDraftFromProcessing}
                      disabled={savingDraft}
                    >
                      {savingDraft ? "Saving Draft..." : "Cancel"}
                    </button>

                    <button
                      type="button"
                      className="intake-modal-btn primary"
                      onClick={() => {
                        setShowProcessingModal(false);
                        setProcessingComplete(false);

                        if (uploadedDocumentSummary?.id) {
                          openReusableReviewModal(uploadedDocumentSummary.id);
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

{showUploadSuccessModal &&
          uploadedDocumentSummary &&
          createdIntakeCase && (
            <div
              className="intake-modal-backdrop"
              onClick={closeUploadSuccessModal}
            >
              <div
                className="intake-modal intake-upload-success-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="intake-modal-header">
                  <div>
                    <h3>Initiating Document Uploaded</h3>
                    <p className="intake-upload-subtitle">
                      Please review the data before confirming this intake case.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="intake-modal-close"
                    onClick={closeUploadSuccessModal}
                  >
                    ×
                  </button>
                </div>

                <div className="intake-modal-body">
                  <div className="intake-upload-success-card">
                    <div className="intake-upload-success-title">
                      Initiating document uploaded successfully
                    </div>

                    <div className="intake-upload-success-grid">
                      <div className="intake-upload-success-item">
                        <span>Document Name</span>
                        <strong>
                          {uploadedDocumentSummary.uploaded_file_name || "—"}
                        </strong>
                      </div>

                      <div className="intake-upload-success-item">
                        <span>Document Type</span>
                        <strong>
                          {uploadedDocumentSummary.document_type_label ||
                            uploadedDocumentSummary.document_type ||
                            "—"}
                        </strong>
                      </div>

                      <div className="intake-upload-success-item">
                        <span>File Size</span>
                        <strong>
                          {formatFileSize(uploadedDocumentSummary.file_size)}
                        </strong>
                      </div>

                      <div className="intake-upload-success-item">
                        <span>Uploaded At</span>
                        <strong>
                          {uploadedDocumentSummary.created_at || "—"}
                        </strong>
                      </div>
                    </div>

                    <div className="intake-upload-review-note">
                      Please review the extracted data before confirming this intake case.
                    </div>
                  </div>
                </div>

                <div className="intake-modal-footer">
                  <button
                    type="button"
                    className="intake-modal-btn secondary"
                    onClick={closeUploadSuccessModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="intake-modal-btn primary"
                    onClick={() => {
                      setShowUploadSuccessModal(false);

                      if (uploadedDocumentSummary?.id) {
                        openReusableReviewModal(uploadedDocumentSummary.id);
                      }
                    }}
                  >
                    Review
                  </button>
                </div>
              </div>
            </div>
          )}

          <DocumentReviewModal
        isOpen={reviewModal.isOpen}
        documentId={reviewModal.documentId}
        prosecutorOptions={prosecutorOptions}
        onClose={closeReusableReviewModal}
        onSaved={handleReviewSaved}
      />

<ReviewedDataModal
  isOpen={showReviewedDataModal}
  payload={reviewedDocumentPayload}
  intakeCaseId={
    createdIntakeCase?.intake_case_id ||
    reviewedDocumentPayload?.intakeCase?.intake_case_id ||
    "—"
  }
  confirming={confirmingIntake}
  onClose={() => {
    setShowReviewedDataModal(false);
  }}
  onConfirm={handleConfirmReviewedIntakeCase}
/>

{showCaseCreatedSuccessModal ? (
  <div
    className="intake-success-backdrop"
    onClick={() => setShowCaseCreatedSuccessModal(false)}
  >
    <div
      className="intake-success-modal premium-compact"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="intake-success-close"
        onClick={() => setShowCaseCreatedSuccessModal(false)}
      >
        ×
      </button>

      <div className="intake-success-content">
        <h3>Intake Case Confirmed</h3>

        <div className="intake-success-id-badge">
          {createdSuccessInfo?.intake_case_id || "—"}
        </div>

        <p>
          This intake case has been reviewed, confirmed, and is now an official intake case.
        </p>

        <button
          type="button"
          className="intake-success-ok-btn"
          onClick={() => setShowCaseCreatedSuccessModal(false)}
        >
          OK
        </button>
      </div>
    </div>
  </div>
) : null}

      </div>
    </UserLayout>
  );
}
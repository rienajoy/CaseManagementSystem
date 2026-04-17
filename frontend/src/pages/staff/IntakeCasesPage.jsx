// src/pages/staff/IntakeCasesPage.jsx
import { useNavigate } from "react-router-dom";
import {
  RotateCcw,
  RefreshCw,
  SlidersHorizontal,
  X,
  Eye,
  Trash2,
} from "lucide-react";

import api from "../../api";
import UserLayout from "../../components/UserLayout";

import "../../styles/staff/document-review-modal.css";

import { useIntakeCases } from "../../hooks/useIntakeCases";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getStoredUser, setStoredUser } from "../../utils/storage";
import { isAdminLevel, isStaff } from "../../utils/roles";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  createIntakeCase,
  uploadIntakeCaseDocument,
  extractIntakeCaseDocument,
  getIntakeCaseDocument,
  confirmIntakeCase,
  saveIntakeCaseDraft,
  deleteIntakeCase,
} from "../../services/staffService";

import ReviewedDataModal from "../../components/staff/ReviewedDataModal";
import DocumentReviewModal from "../../components/staff/DocumentReviewModal";

import DocumentTypeMismatchModal from "../../components/staff/DocumentTypeMismatchModal";
import {
  normalizeDocumentType,
  getDetectedDocumentType,
  isDocumentTypeMismatch,
  buildMismatchInfo,
} from "../../utils/documentTypeMismatch";

import "../../styles/staff/intake-cases-page.css";

import SearchBar from "../../components/staff/SearchBar";


export default function IntakeCasesPage() {

  const navigate = useNavigate();
  const [user, setUser] = useState(getStoredUser());

  const initializedRef = useRef(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [caseType, setCaseType] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const [showCanonicalUpdateModal, setShowCanonicalUpdateModal] = useState(false);
const [canonicalCandidates, setCanonicalCandidates] = useState([]);
const [canonicalSelections, setCanonicalSelections] = useState({});
const [canonicalSourceDoc, setCanonicalSourceDoc] = useState(null);
const [applyingCanonicalUpdates, setApplyingCanonicalUpdates] = useState(false);

const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
const [intakeCaseToDelete, setIntakeCaseToDelete] = useState(null);
const [deletingIntakeCase, setDeletingIntakeCase] = useState(false);

const [uploadFormError, setUploadFormError] = useState("");

const [deleteErrorModal, setDeleteErrorModal] = useState({
  isOpen: false,
  message: "",
});


  const [showCaseCreatedSuccessModal, setShowCaseCreatedSuccessModal] =
  useState(false);
const [createdSuccessInfo, setCreatedSuccessInfo] = useState(null);

  const [selectedCase, setSelectedCase] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [isDragActive, setIsDragActive] = useState(false);
  
const [startingWorkflow, setStartingWorkflow] = useState(false);
  

  const [showReviewedDataModal, setShowReviewedDataModal] = useState(false);
  const [reviewedDocumentPayload, setReviewedDocumentPayload] = useState(null);

  const [pollingDocumentId, setPollingDocumentId] = useState(null);
const [pollingStarted, setPollingStarted] = useState(false);
const [pollingAttempts, setPollingAttempts] = useState(0);

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
  const [uploadedInitiatingDocument, setUploadedInitiatingDocument] =
    useState(null);
  const [uploadedDocumentSummary, setUploadedDocumentSummary] = useState(null);

  const [showReviewSavedToast, setShowReviewSavedToast] = useState(false);

  const [showMismatchModal, setShowMismatchModal] = useState(false);
  const [mismatchInfo, setMismatchInfo] = useState(null);


  const [reviewModalOpen, setReviewModalOpen] = useState(false);
const [selectedReviewDocumentId, setSelectedReviewDocumentId] = useState(null);

const [lastReviewedDocumentId, setLastReviewedDocumentId] = useState(null);

const [filters, setFilters] = useState({
  search: "",
  status: "",
  caseType: "",
  intakeStatus: "",
  intakeDocumentStatus: "",
  prosecutionResult: "",
  assignedProsecutor: "",
  sortBy: "",
  sortDirection: "asc",
  perPage: "5",
});

  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 10,
    total: 0,
    total_pages: 1,
  });

const [searchInput, setSearchInput] = useState(filters.search || "");


const intakeParams = useMemo(() => ({
  page: pagination.page,
  per_page: pagination.per_page || 10,
  search: filters.search || "",
  tab: activeTab,
  ...(activeTab === "inv" ? { case_type: "INV" } : {}),
  ...(activeTab === "inq" ? { case_type: "INQ" } : {}),
  ...(filters.caseType ? { case_type: filters.caseType } : {}),
  ...(filters.intakeStatus ? { intake_status: filters.intakeStatus } : {}),
  ...(filters.intakeDocumentStatus
    ? { intake_document_status: filters.intakeDocumentStatus }
    : {}),
  ...(filters.prosecutionResult
    ? { prosecution_result: filters.prosecutionResult }
    : {}),
  ...(filters.assignedProsecutor
    ? { assigned_prosecutor_id: filters.assignedProsecutor }
    : {}),
}), [
  pagination.page,
  pagination.per_page,
  activeTab,
  filters.search,
  filters.caseType,
  filters.intakeStatus,
  filters.intakeDocumentStatus,
  filters.prosecutionResult,
  filters.assignedProsecutor,
]);

const queryClient = useQueryClient();

const { data: prosecutorsData } = useQuery({
  queryKey: ["staff-prosecutors"],
  queryFn: async () => {
    const res = await api.get("/staff/prosecutors");

    const payload = res?.data?.data || {};
    const list =
      payload.prosecutors ||
      payload.items ||
      payload.users ||
      payload.staff ||
      [];

    return Array.isArray(list)
      ? list.map((item, index) => ({
          id:
            item?.id ??
            item?.user_id ??
            item?.prosecutor_id ??
            item?.staff_id ??
            `prosecutor-${index}`,
          name:
            item?.full_name ||
            item?.display_name ||
            item?.name ||
            "Unknown",
        }))
      : [];
  },
  staleTime: 5 * 60 * 1000,
});

const prosecutorOptions = prosecutorsData || [];

const {
  data: intakeData,
  isLoading: tableLoading,
  isFetching,
  error,
  refetch: refetchIntakeCases,
} = useIntakeCases(intakeParams);

const createIntakeCaseMutation = useMutation({
  mutationFn: (payload) => createIntakeCase(payload),
});

const saveDraftMutation = useMutation({
  mutationFn: ({ intakeCaseId, payload }) =>
    saveIntakeCaseDraft(intakeCaseId, payload),
  onSuccess: async () => {
    await refreshIntakeQueries();
  },
});

const uploadInitiatingDocumentMutation = useMutation({
  mutationFn: ({ intakeCaseId, formData }) =>
    uploadIntakeCaseDocument(intakeCaseId, formData),
});

const confirmIntakeCaseMutation = useMutation({
  mutationFn: ({ intakeCaseId, payload }) =>
    confirmIntakeCase(intakeCaseId, payload),
});

const deleteIntakeCaseMutation = useMutation({
  mutationFn: ({ intakeCaseId }) => deleteIntakeCase(intakeCaseId),
  onSuccess: async () => {
    await refreshIntakeQueries();
  },
});

const applyCanonicalUpdatesMutation = useMutation({
  mutationFn: ({ intakeCaseId, payload }) =>
    api.patch(`/staff/intake-cases/${intakeCaseId}/apply-canonical-updates`, payload),
  onSuccess: async () => {
    await refreshIntakeQueries();
  },
});

const extractInitiatingDocumentMutation = useMutation({
  mutationFn: ({ documentId }) => extractIntakeCaseDocument(documentId),
});

const rows = Array.isArray(
  intakeData?.intake_cases ||
    intakeData?.items ||
    intakeData?.rows ||
    intakeData?.records
)
  ? (
      intakeData?.intake_cases ||
      intakeData?.items ||
      intakeData?.rows ||
      intakeData?.records
    )
  : [];

const pageLoading = false;
const err =
  error?.response?.data?.message ||
  error?.message ||
  "";


useEffect(() => {
  const meta = intakeData?.pagination || intakeData?.meta || {};
  if (!intakeData) return;

  const nextPage = Number(meta.page || pagination.page || 1);
  const nextPerPage = Number(meta.per_page || meta.perPage || pagination.per_page || 10);
  const nextTotal = Number(meta.total || rows.length || 0);
  const nextTotalPages = Number(meta.total_pages || meta.totalPages || 1);

  setPagination((prev) => {
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
}, [intakeData, rows.length, pagination.page, pagination.per_page]);

useEffect(() => {
  const timeout = setTimeout(() => {
    setFilters((prev) => {
      if (prev.search === searchInput) return prev;

      return {
        ...prev,
        search: searchInput,
      };
    });

    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  }, 350);

  return () => clearTimeout(timeout);
}, [searchInput]);

  const intakeTabs = [
    { key: "all", label: "Intake Cases" },
    { key: "inv", label: "Preliminary Investigation (INV)" },
    { key: "inq", label: "Inquest Proceedings (INQ)" },
    { key: "dismissed", label: "Dismissed Intake Cases" },
    { key: "drafts", label: " Intake Drafts" },
  ];

const formatDateOnly = (value) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

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

function isDocumentExtractionComplete(doc) {
  const ocrDone = doc?.ocr_status === "completed";
  const nlpDone = doc?.nlp_status === "completed";
  const hasData = !!doc?.extracted_data;

  return ocrDone && nlpDone && hasData;
}

function isDocumentExtractionFailed(doc) {
  return doc?.ocr_status === "failed" || doc?.nlp_status === "failed";
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

  function getPartyDisplay(value) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }

  if (typeof value === "string") {
    return value.trim() || "—";
  }

  return "—";
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
  if (!pollingStarted || !pollingDocumentId) return;

  let cancelled = false;

  const interval = setInterval(async () => {
    try {
      const res = await getIntakeCaseDocument(pollingDocumentId);
      const payload = res?.data?.data || {};
      const document = payload?.document || null;

      if (!document || cancelled) return;

      setUploadProgress((prev) => {
        if (prev >= 90) return prev;
        return Math.min(prev + 3, 90);
      });

      setPollingAttempts((prev) => {
        const next = prev + 1;

        if (next > 40) {
          clearInterval(interval);

          if (!cancelled) {
            setPollingStarted(false);
            setPollingDocumentId(null);
            setShowProcessingModal(false);
            alert("Extraction is taking too long. Please try again.");
          }
        }

        return next;
      });

      if (isDocumentExtractionFailed(document)) {
        clearInterval(interval);
        if (cancelled) return;

        setPollingStarted(false);
        setPollingDocumentId(null);
        setShowProcessingModal(false);
        setShowMismatchModal(false);
        setMismatchInfo(null);

        alert("Document extraction failed.");
        return;
      }

const rawSelectedType =
  initiatingDocumentType || document?.document_type || "";

const rawDetectedType = getDetectedDocumentType(document);

const selectedType = normalizeDocumentType(rawSelectedType);
const detectedType = normalizeDocumentType(rawDetectedType);

const backendMismatchFlag =
  document?.is_document_type_mismatch === true ||
  document?.is_mismatch === true;

const hasMismatch =
  backendMismatchFlag ||
  (!!selectedType && !!detectedType && selectedType !== detectedType);

      if (hasMismatch) {
        clearInterval(interval);
        if (cancelled) return;

        setUploadProgress(100);

setMismatchInfo(
  buildMismatchInfo(document, rawSelectedType, initiatingFile)
);

        setShowMismatchModal(true);
        setShowProcessingModal(true);
        setPollingStarted(false);
        setPollingDocumentId(null);

        return;
      }

      if (isDocumentExtractionComplete(document)) {
        clearInterval(interval);
        if (cancelled) return;

        setUploadProgress(100);
        setUploadedInitiatingDocument(document);
        setUploadedDocumentSummary(document);

        setShowProcessingModal(false);
        setPollingStarted(false);
        setPollingDocumentId(null);

        openReusableReviewModal(document.id);
        return;
      }
    } catch (error) {
      clearInterval(interval);
      if (cancelled) return;

      setPollingStarted(false);
      setPollingDocumentId(null);
      setShowProcessingModal(false);

      alert(
        error?.response?.data?.message ||
          error?.response?.data?.errors?.[0] ||
          "Failed while checking document extraction status."
      );
    }
  }, 1500);

  return () => {
    cancelled = true;
    clearInterval(interval);
  };
}, [
  pollingStarted,
  pollingDocumentId,
  createdIntakeCase,
  initiatingDocumentType,
  initiatingFile,
]);

  useEffect(() => {
const anyModalOpen =
  showCreateModal ||
  showUploadModal ||
  showProcessingModal ||
  showMismatchModal ||
  reviewModalOpen ||
  showReviewedDataModal ||
  showCanonicalUpdateModal;

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
  reviewModalOpen,
  showReviewedDataModal,
  showCanonicalUpdateModal,
]);

  async function refreshIntakeQueries() {
  await queryClient.invalidateQueries({
    queryKey: ["intake-cases"],
  });
}

function handleDeleteIntakeCase(item) {
  const intakeCaseId = item?.id || item?.intake_case_id;

  if (!intakeCaseId) {
    return;
  }

  setIntakeCaseToDelete(item);
  setShowDeleteConfirmModal(true);
}

async function confirmDeleteIntakeCase() {
  const intakeCaseId =
    intakeCaseToDelete?.id || intakeCaseToDelete?.intake_case_id;

  if (!intakeCaseId) return;

  try {
    setDeletingIntakeCase(true);

    await deleteIntakeCaseMutation.mutateAsync({ intakeCaseId });

    setShowDeleteConfirmModal(false);
    setShowDeleteSuccessModal(true);
    setIntakeCaseToDelete(null);
  } catch (error) {
  setDeleteErrorModal({
    isOpen: true,
    message:
      error?.response?.data?.message ||
      error?.response?.data?.errors?.[0] ||
      "Failed to delete intake case.",
  });
} finally {
    setDeletingIntakeCase(false);
  }
}

function closeDeleteConfirmModal() {
  if (deletingIntakeCase) return;
  setShowDeleteConfirmModal(false);
  setIntakeCaseToDelete(null);
}

function closeDeleteSuccessModal() {
  setShowDeleteSuccessModal(false);
}


  async function handleApplyCanonicalSelections() {
  const intakeCaseId =
    reviewedDocumentPayload?.intakeCase?.id ||
    reviewedDocumentPayload?.intakeCaseId ||
    createdIntakeCase?.id;

  if (!intakeCaseId) {
    alert("Missing intake case reference.");
    return;
  }

  try {
    setApplyingCanonicalUpdates(true);

    const appliedFields = {};

    canonicalCandidates.forEach((item) => {
      if (canonicalSelections[item.field]) {
        appliedFields[item.field] = item.proposed_value;
      }
    });

    if (Object.keys(appliedFields).length > 0) {
    await applyCanonicalUpdatesMutation.mutateAsync({
  intakeCaseId,
  payload: {
    applied_fields: appliedFields,
    source_document_id: canonicalSourceDoc?.id || null,
    source_document_type: canonicalSourceDoc?.document_type || null,
  },
});
    }

    setShowCanonicalUpdateModal(false);

    const nextIntakeCaseId =
      reviewedDocumentPayload?.intakeCase?.id ||
      reviewedDocumentPayload?.intakeCaseId ||
      createdIntakeCase?.id ||
      null;

    setReadyToConfirmCaseId(nextIntakeCaseId);
    setShowReviewedDataModal(true);

  } catch (error) {
    alert(
      error?.response?.data?.message ||
      error?.response?.data?.errors?.[0] ||
      "Failed to apply canonical updates."
    );
  } finally {
    setApplyingCanonicalUpdates(false);
  }
}



useEffect(() => {
  if (initializedRef.current) return;
  initializedRef.current = true;

  init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
  console.log("reviewModalOpen:", reviewModalOpen);
  console.log("selectedReviewDocumentId:", selectedReviewDocumentId);
}, [reviewModalOpen, selectedReviewDocumentId]);

async function init() {
  if (!user) {
    navigate("/");
    return;
  }

  if (isAdminLevel(user)) {
    navigate("/admin/dashboard");
    return;
  }

  if (!isStaff(user)) {
    navigate("/dashboard");
    return;
  }
}

function openDetailsPage(caseItem) {
  const intakeCaseId = caseItem?.id || caseItem?.intake_case_id;
  if (!intakeCaseId) return;

  navigate(`/staff/intake-cases/${intakeCaseId}`);
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
    setUploadedDocumentSummary(null);
    setUploadedInitiatingDocument(null);
    setShowMismatchModal(false);
    setMismatchInfo(null);
    setShowProcessingModal(false);
    setUploadProgress(0);
    setInitiatingDocumentType("");
    setInitiatingFile(null);
    setShowCreateModal(true);
    setUploadFormError("");
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
    setStartingWorkflow(true);

    // close current modal immediately
    setShowCreateModal(false);

    // prepare upload modal immediately
    if (caseType === "INV") {
      setInitiatingDocumentType("complaint_affidavit");
    } else {
      setInitiatingDocumentType("");
    }

    setInitiatingFile(null);
    setUploadedInitiatingDocument(null);
    setUploadedDocumentSummary(null);
    setShowUploadModal(true);

    const res = await createIntakeCaseMutation.mutateAsync({
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
  } catch (error) {
    setShowUploadModal(false);
    setShowCreateModal(true);

    alert(
      error?.response?.data?.message || "Failed to initialize intake workflow."
    );
  } finally {
    setSubmitting(false);
    setStartingWorkflow(false);
  }
}

  function closeUploadModal() {
    if (initiatingUploadLoading) return;
    setShowUploadModal(false);
    setShowMismatchModal(false);
    setMismatchInfo(null);
    setUploadFormError("");
  }

function handleMismatchAcknowledge() {
  setShowMismatchModal(false);
  setMismatchInfo(null);
  setShowProcessingModal(false);
  setUploadProgress(0);
  setUploadedInitiatingDocument(null);
  setUploadedDocumentSummary(null);
  setPollingStarted(false);
  setPollingDocumentId(null);
  setInitiatingFile(null);
  setShowUploadModal(true);
  setUploadFormError("");
}

function openReusableReviewModal(documentId) {
  console.log("Opening review modal:", documentId);

  if (!documentId || typeof documentId === "object") {
    console.warn("Invalid documentId:", documentId);
    return;
  }

  setSelectedReviewDocumentId(documentId);
  setReviewModalOpen(true);
}

function closeReusableReviewModal() {
  console.log("closeReusableReviewModal fired");
  setReviewModalOpen(false);
  setSelectedReviewDocumentId(null);
}


async function handleUploadInitiatingDocument(e) {
  e.preventDefault();

setUploadFormError("");

if (!createdIntakeCase?.id) {
  setUploadFormError("Missing intake case reference.");
  return;
}

if (!initiatingDocumentType) {
  setUploadFormError("Please select the initiating document type.");
  return;
}

if (!initiatingFile) {
  setUploadFormError("Please choose a file to upload.");
  return;
}

  try {
    setInitiatingUploadLoading(true);

    setShowUploadModal(false);
    setShowMismatchModal(false);
    setMismatchInfo(null);
    setShowProcessingModal(true);
    setUploadProgress(15);

    const formData = new FormData();
    formData.append("document", initiatingFile);
    formData.append("document_type", initiatingDocumentType);
    formData.append("upload_mode", "save_only");

    const uploadRes = await uploadInitiatingDocumentMutation.mutateAsync({
      intakeCaseId: createdIntakeCase.id,
      formData,
    });

    const uploadData = uploadRes?.data?.data || {};
    const uploadedDoc = uploadData?.document || null;

    if (!uploadedDoc?.id) {
      throw new Error("Upload succeeded but no document ID was returned.");
    }

    setUploadProgress(45);

    const extractRes = await extractInitiatingDocumentMutation.mutateAsync({
      documentId: uploadedDoc.id,
    });

    const extractData = extractRes?.data?.data || {};
    const extractedDocument = extractData?.document || uploadedDoc;

    if (!extractedDocument) {
      throw new Error("Extraction finished but no document payload was returned.");
    }

    const rawSelectedType =
      initiatingDocumentType ||
      uploadedDoc?.document_type ||
      "";

   const rawDetectedType =
  extractData?.detected_document_type ||
  extractData?.document_type_detected ||
  extractData?.document?.detected_document_type ||
  extractData?.document?.extracted_data?.detected_document_type ||
  extractData?.document?.extracted_data?.metadata?.document_type ||
  extractedDocument?.detected_document_type ||
  extractedDocument?.document_type_detected ||
  extractedDocument?.classification?.document_type ||
  extractedDocument?.classifier_result?.document_type ||
  extractedDocument?.extracted_data?.detected_document_type ||
  extractedDocument?.extracted_data?.metadata?.document_type ||
  extractedDocument?.extracted_data?.document_type ||
  extractedDocument?.extracted_data?.document_class ||
  "";

    const selectedType = normalizeDocumentType(rawSelectedType);
    const detectedType = normalizeDocumentType(rawDetectedType);

    const extractMismatch =
      extractData?.is_document_type_mismatch === true ||
      extractData?.is_mismatch === true ||
      extractedDocument?.is_document_type_mismatch === true ||
      extractedDocument?.is_mismatch === true ||
      (!!selectedType && !!detectedType && selectedType !== detectedType);

    if (extractMismatch) {
      setUploadProgress(100);
      setUploadedInitiatingDocument(null);
      setUploadedDocumentSummary(null);
      setPollingStarted(false);
      setPollingDocumentId(null);

      setMismatchInfo(
        buildMismatchInfo(extractedDocument, rawSelectedType, initiatingFile)
      );

      setShowProcessingModal(false);
      setShowMismatchModal(true);
      setInitiatingFile(null);
      return;
    }

    setUploadProgress(45);
    setPollingDocumentId(uploadedDoc.id);
    setPollingStarted(true);
    setPollingAttempts(0);

    setUploadedInitiatingDocument(extractedDocument);
    setUploadedDocumentSummary(extractedDocument);
    setInitiatingFile(null);

    return;
  } catch (error) {
    const backendMessage =
      error?.response?.data?.message ||
      error?.response?.data?.errors?.[0] ||
      error?.message ||
      "Failed to upload initiating document.";

    const errorData = error?.response?.data?.data || {};
    const errorDocument = errorData?.document || null;

    const normalizedMessage = String(backendMessage).toLowerCase();

    const isBackendMismatch =
      errorData?.is_document_type_mismatch === true ||
      errorData?.is_mismatch === true ||
      errorDocument?.is_document_type_mismatch === true ||
      errorDocument?.is_mismatch === true ||
      normalizedMessage.includes("not an initiating document type") ||
      normalizedMessage.includes("does not match") ||
      normalizedMessage.includes("document mismatch") ||
      normalizedMessage.includes("uploaded document");

    if (isBackendMismatch) {
      setUploadProgress(100);
      setUploadedInitiatingDocument(null);
      setUploadedDocumentSummary(null);
      setPollingStarted(false);
      setPollingDocumentId(null);

     setMismatchInfo(
  buildMismatchInfo(
    {
      ...errorData,
      ...errorDocument,
      detected_document_type:
        errorData?.detected_document_type ||
        errorDocument?.detected_document_type ||
        errorDocument?.extracted_data?.detected_document_type ||
        errorDocument?.extracted_data?.metadata?.document_type ||
        "",
    },
    initiatingDocumentType || "—",
    initiatingFile
  )
);

      setShowProcessingModal(false);
      setShowMismatchModal(true);
      return;
    }

    setShowProcessingModal(false);
    setShowMismatchModal(false);
    setMismatchInfo(null);

    alert(backendMessage);
  } finally {
    setInitiatingUploadLoading(false);
  }
}


async function handleReviewSaved(payload) {
  const previousDocumentId =
  selectedReviewDocumentId ||
  payload?.document?.id ||
  null;

  setLastReviewedDocumentId(previousDocumentId);
  closeReusableReviewModal();

  const candidates = Array.isArray(payload?.canonicalUpdateCandidates)
    ? payload.canonicalUpdateCandidates
    : [];

  if (candidates.length > 0) {
    const defaultSelections = {};
    candidates.forEach((item) => {
      defaultSelections[item.field] = false;
    });

    setCanonicalCandidates(candidates);
    setCanonicalSelections(defaultSelections);
    setCanonicalSourceDoc(payload?.document || null);
    setReviewedDocumentPayload(payload);
    setShowCanonicalUpdateModal(true);
    return;
  }

  setReviewedDocumentPayload(payload);

  const intakeCaseId =
    payload?.intakeCase?.id ||
    createdIntakeCase?.id ||
    payload?.intakeCaseId ||
    payload?.intake_case_id ||
    null;

  setReadyToConfirmCaseId(intakeCaseId);
  setShowReviewedDataModal(true);
}

async function handleSaveReviewedAsDraft() {
  const intakeCaseId =
    readyToConfirmCaseId ||
    reviewedDocumentPayload?.intakeCase?.id ||
    reviewedDocumentPayload?.intakeCaseId ||
    createdIntakeCase?.id ||
    null;

  if (!intakeCaseId) {
    alert("Missing intake case reference.");
    return;
  }

  try {
    setSavingDraft(true);

    await saveDraftMutation.mutateAsync({
      intakeCaseId,
      payload: {},
    });

    setShowReviewedDataModal(false);
    setReviewedDocumentPayload(null);
    setReadyToConfirmCaseId(null);
    setLastReviewedDocumentId(null);

    setActiveTab("drafts");
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

async function handleConfirmReviewedIntakeCase() {
  if (!readyToConfirmCaseId) {
    alert("Missing intake case reference.");
    return;
  }

  try {
    setConfirmingIntake(true);

    const res = await confirmIntakeCaseMutation.mutateAsync({
      intakeCaseId: readyToConfirmCaseId,
      payload: {},
    });

    const confirmedCaseId =
      res?.data?.data?.intake_case_id || readyToConfirmCaseId;

    const confirmedType = normalizeText(
      createdIntakeCase?.case_type ||
      reviewedDocumentPayload?.intakeCase?.case_type ||
      reviewedDocumentPayload?.document?.case_type
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
        reviewedDocumentPayload?.intakeCase?.intake_case_id ||
        createdIntakeCase?.intake_case_id ||
        confirmedCaseId,
      message: "Intake case confirmed successfully.",
    });

    setShowReviewedDataModal(false);
    setReviewedDocumentPayload(null);
    setReadyToConfirmCaseId(null);
    setLastReviewedDocumentId(null);
    setShowCaseCreatedSuccessModal(true);
  } catch (error) {
    alert(
      error?.response?.data?.message ||
      error?.response?.data?.errors?.[0] ||
      error?.message ||
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
  setSearchInput("");

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
  refetchIntakeCases();
}

function handleApplyFilters() {
  setPagination((prev) => ({ ...prev, page: 1 }));
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


  function formatCanonicalFieldLabel(field) {
  if (!field) return "Field";

  return String(field)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusClass(value = "") {
  const normalized = normalizeText(value);

  if (
    normalized.includes("active") ||
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

  function handleDragOver(e) {
  e.preventDefault();
  e.stopPropagation();
  setIsDragActive(true);
}

function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  setIsDragActive(false);
}

function handleDropInitiatingFile(e) {
  e.preventDefault();
  e.stopPropagation();
  setIsDragActive(false);

  const file = e.dataTransfer?.files?.[0];
  if (!file) return;

  setInitiatingFile(file);
  setUploadFormError("");
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
    <SearchBar
      value={searchInput}
      onSearch={setSearchInput}
      placeholder="Search docket no., case no., title, offense..."
      className="intake-page-search"
      debounceMs={350}
    />
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
      className={`intake-toolbar-btn secondary ${showFilters ? "is-active" : ""}`}
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
                                value={searchInput}
onChange={(e) => setSearchInput(e.target.value)}
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

    {Array.from({ length: 5 }).map((_, index) => (
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
  </div>
) : (
  
              <div className="intake-table-shell">
                {isFetching && !tableLoading ? (
  <div className="small-spinner">Refreshing...</div>
) : null}
                  <table className="intake-table">
                    <thead>
  <tr>
    <th>Intake ID</th>
    <th>Docket Number</th>
    <th>Complainants</th>
    <th>Respondents</th>
    <th>Assigned Prosecutor</th>
    <th>Intake Status</th>
    <th>Date Filed</th>
    <th>Actions</th>
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
  <td>{formatIntakeId(item.id || item.intake_case_id)}</td>
  <td>{toDisplayValue(item.docket_number, "—")}</td>
  <td>{getPartyDisplay(item.complainants)}</td>
  <td>{getPartyDisplay(item.respondents)}</td>
  <td>{getAssignedProsecutorDisplay(item)}</td>
  <td>
    <span
      className={`intake-table-status ${getStatusClass(intakeStatusValue)}`}
    >
      {getStatusDisplay(intakeStatusValue, "—")}
    </span>
  </td>
  <td>{formatDateOnly(item.date_filed)}</td>
  <td>
    <div className="intake-case-actions">
      <button
        type="button"
        className="icon-action-btn"
        onClick={() => openDetailsPage(item)}
        title="Open intake case details"
      >
        <Eye size={18} />
      </button>

      <button
        type="button"
        className="icon-action-btn danger"
        onClick={() => handleDeleteIntakeCase(item)}
        title="Delete intake case"
      >
        <Trash2 size={18} />
      </button>
    </div>
  </td>
</tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="8" className="intake-table-empty-cell">
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
            disabled={createIntakeCaseMutation.isPending} >
{createIntakeCaseMutation.isPending ? "Starting..." : "Next"}
          </button>
        </div>
      </form>
    </div>
  </div>
)}

{showUploadModal && (
  <div className="intake-modal-backdrop">
    <div
      className="intake-modal intake-upload-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intake-modal-header">
        <div>
          <h3>Initiating Document Required</h3>
          <p className="intake-upload-subtitle">
  {startingWorkflow
    ? "Preparing intake workflow. Please wait..."
    : "Upload and extract the initiating document to continue the intake workflow."}
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
  onChange={(e) => {
  setInitiatingDocumentType(e.target.value);
  setUploadFormError("");
}}
  disabled={caseType === "INV" || startingWorkflow}
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
                  <label
  className={`intake-upload-dropzone ${isDragActive ? "is-drag-active" : ""}`}
  onDragOver={handleDragOver}
  onDragEnter={handleDragOver}
  onDragLeave={handleDragLeave}
  onDrop={handleDropInitiatingFile}
>
<input
  type="file"
  accept=".pdf,.jpg,.jpeg,.png"
  onChange={(e) => {
  const nextFile = e.target.files?.[0] || null;
  setInitiatingFile(nextFile);

  if (nextFile) {
    setUploadFormError("");
  }
}}
  hidden
  disabled={startingWorkflow}
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
{uploadFormError && (
  <div className="intake-form-inline-error" role="alert">
    {uploadFormError}
  </div>
)}
        <div className="intake-modal-footer">
          <button
  type="button"
  className="intake-modal-btn secondary"
  onClick={closeUploadModal}
  disabled={initiatingUploadLoading || startingWorkflow}
>
            Cancel
          </button>

          <button
  type="submit"
  className="intake-modal-btn primary"
  disabled={
    startingWorkflow ||
    uploadInitiatingDocumentMutation.isPending ||
    !createdIntakeCase?.id
  }
>
  {startingWorkflow
    ? "Preparing..."
    : uploadInitiatingDocumentMutation.isPending
    ? "Uploading..."
    : "Upload Initiating Document"}
</button>
        </div>
      </form>
    </div>
  </div>
)}

{showProcessingModal && !showMismatchModal && (
  <div className="intake-modal-backdrop">
    <div
      className="intake-modal intake-processing-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intake-processing-hero">
        <div className="intake-processing-orb" />

        <div className="intake-processing-copy">
          <span className="intake-processing-badge">
            Processing
          </span>

          <h3>Processing Document Extraction</h3>

          <p className="intake-upload-subtitle">
            The document was uploaded successfully. The system is now extracting the document data.
          </p>
        </div>
      </div>

      <div className="intake-modal-body intake-processing-body">
        <div className="intake-processing-progress-top">
          <span className="intake-processing-step">
            {uploadProgress < 35
              ? "Uploading document..."
              : uploadProgress < 75
              ? "Extracting data..."
              : "Waiting for extraction to complete..."}
          </span>

          <strong className="intake-processing-percent">
            {`${uploadProgress}%`}
          </strong>
        </div>

        <div
          className="intake-processing-bar-shell modern"
          role="progressbar"
          aria-valuenow={uploadProgress}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Document extraction progress"
        >
          <div
            className="intake-processing-bar-fill modern"
            style={{ width: `${uploadProgress}%` }}
          >
            <span className="intake-processing-bar-glow" />
          </div>
        </div>

        <div className="intake-processing-review-note">
          <span className="intake-processing-review-label">
            Processing Status
          </span>

          <p>
            {uploadProgress < 35
              ? "Uploading the initiating document. Please wait..."
              : "The document is being processed. Please wait while extraction completes..."}
          </p>
        </div>
      </div>

      <div className="intake-modal-footer">
        <button
          type="button"
          className="intake-modal-btn secondary"
          disabled
        >
          Processing...
        </button>
      </div>
    </div>
  </div>
)}

<DocumentReviewModal
  isOpen={reviewModalOpen}
  documentId={selectedReviewDocumentId}
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

<DocumentTypeMismatchModal
  isOpen={showMismatchModal}
  mismatchInfo={mismatchInfo}
  onAcknowledge={handleMismatchAcknowledge}
  onClose={handleMismatchAcknowledge}
  formatFileSize={formatFileSize}
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

      {showCanonicalUpdateModal && (
  <div
    className="intake-modal-backdrop"
    onClick={() => setShowCanonicalUpdateModal(false)}
  >
    <div
      className="intake-modal canonical-update-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intake-modal-header">
        <div>
          <h3>Review Canonical Case Updates</h3>
          <p className="intake-upload-subtitle">
            This reviewed document contains values that differ from the current canonical case summary.
            Select which changes should update the intake case.
          </p>
        </div>

        <button
          type="button"
          className="intake-modal-close"
          onClick={() => setShowCanonicalUpdateModal(false)}
        >
          ×
        </button>
      </div>

      <div className="intake-modal-body">
        <div className="canonical-update-list">
          {canonicalCandidates.map((item, index) => (
            <label
              key={`${item.field}-${index}`}
              className="canonical-update-item"
            >
              <div className="canonical-update-check">
                <input
                  type="checkbox"
                  checked={!!canonicalSelections[item.field]}
                  onChange={(e) =>
                    setCanonicalSelections((prev) => ({
                      ...prev,
                      [item.field]: e.target.checked,
                    }))
                  }
                />
              </div>

              <div className="canonical-update-content">
                <div className="canonical-update-field">
  {formatCanonicalFieldLabel(item.field)}
</div>
                <div>
                  <strong>Current:</strong> {toDisplayValue(item.current_value, "—")}
                </div>
                <div>
                  <strong>Proposed:</strong> {toDisplayValue(item.proposed_value, "—")}
                </div>
                <div>
                  <strong>From:</strong> {toDisplayValue(item.document_type, "—")} #{toDisplayValue(item.document_id, "—")}
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="intake-modal-footer">
        <button
          type="button"
          className="intake-modal-btn secondary"
          onClick={() => {
            setShowCanonicalUpdateModal(false);
            setShowReviewedDataModal(true);
          }}
        >
          Keep Current Values
        </button>

        <button
          type="button"
          className="intake-modal-btn primary"
          onClick={handleApplyCanonicalSelections}
          disabled={applyingCanonicalUpdates}
        >
          {applyingCanonicalUpdates ? "Applying..." : "Apply Selected Changes"}
        </button>
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
          <h3>Delete Intake Case</h3>
          <p className="intake-upload-subtitle">
            Are you sure you want to delete{" "}
            <strong>
              {formatIntakeId(
                intakeCaseToDelete?.id || intakeCaseToDelete?.intake_case_id
              )}
            </strong>
            ? This action cannot be undone.
          </p>
        </div>

        <button
          type="button"
          className="intake-modal-close"
          onClick={closeDeleteConfirmModal}
          disabled={deletingIntakeCase}
        >
          ×
        </button>
      </div>

      <div className="intake-modal-footer intake-delete-confirm-footer">
        <button
          type="button"
          className="intake-modal-btn secondary"
          onClick={closeDeleteConfirmModal}
          disabled={deletingIntakeCase}
        >
          Cancel
        </button>

        <button
          type="button"
          className="intake-modal-btn primary danger"
          onClick={confirmDeleteIntakeCase}
          disabled={deletingIntakeCase}
        >
          {deletingIntakeCase ? "Deleting..." : "Delete"}
        </button>
      </div>
    </div>
  </div>
)}

{showDeleteSuccessModal && (
  <div className="intake-modal-backdrop" onClick={closeDeleteSuccessModal}>
    <div
      className="intake-modal intake-upload-success-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intake-modal-header">
        <div>
          <h3>Intake Case Deleted</h3>
          <p className="intake-upload-subtitle">
            The intake case was deleted successfully.
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
            Intake case deleted successfully
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

{deleteErrorModal.isOpen && (
  <div
    className="intake-modal-backdrop"
    onClick={() => setDeleteErrorModal({ isOpen: false, message: "" })}
  >
    <div
      className="intake-modal intake-delete-success-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="intake-modal-header">
        <div>
          <h3>Delete Failed</h3>
          <p className="intake-upload-subtitle">
            The intake case could not be deleted.
          </p>
        </div>

        <button
          type="button"
          className="intake-modal-close"
          onClick={() => setDeleteErrorModal({ isOpen: false, message: "" })}
        >
          ×
        </button>
      </div>

      <div className="intake-modal-body">
        <div className="intake-delete-success-copy">
          {deleteErrorModal.message || "Failed to delete intake case."}
        </div>
      </div>

      <div className="intake-modal-footer">
        <button
          type="button"
          className="intake-modal-btn primary"
          onClick={() => setDeleteErrorModal({ isOpen: false, message: "" })}
        >
          OK
        </button>
      </div>
    </div>
  </div>
)}


    </UserLayout>
  );
}
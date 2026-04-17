export function normalizeDocumentType(value) {
  if (!value) return "";

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function prettifyDocumentType(value) {
  if (!value) return "Unknown";

  return String(value)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getDetectedDocumentType(source) {
  if (!source) return "";

  return (
    source?.detected_document_type ||
    source?.document_type_detected ||
    source?.classification?.document_type ||
    source?.classifier_result?.document_type ||
    source?.review_context?.detected_document_type ||
    source?.extracted_data?.detected_document_type ||
    source?.extracted_data?.metadata?.document_type ||
    source?.metadata?.document_type ||
    source?.document_type_detected_label ||
    ""
  );
}

export function isDocumentTypeMismatch(source, selectedType) {
  const backendMismatch =
    source?.is_document_type_mismatch === true ||
    source?.is_mismatch === true ||
    source?.extracted_data?.is_document_type_mismatch === true;

  if (backendMismatch) return true;

  const normalizedSelected = normalizeDocumentType(selectedType);
  const normalizedDetected = normalizeDocumentType(
    getDetectedDocumentType(source)
  );

  if (!normalizedSelected || !normalizedDetected) return false;

  return normalizedSelected !== normalizedDetected;
}

function formatFileSize(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return "—";

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = Number(bytes);
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function buildMismatchInfo(source, selectedDocumentType, file) {
  const detectedType = getDetectedDocumentType(source);

  return {
    file_name:
      source?.uploaded_file_name ||
      source?.file_name ||
      file?.name ||
      "—",
    file_size: formatFileSize(source?.file_size ?? file?.size),
    selected_document_type: prettifyDocumentType(selectedDocumentType || "—"),
    detected_document_type: prettifyDocumentType(detectedType || "Unknown"),
    subtitle:
      source?.subtitle ||
      "The uploaded file does not match the selected document type.",
    message:
      source?.message ||
      source?.mismatch_message ||
      source?.review_notes ||
      "Process failed. The uploaded file does not match the selected document type.",
  };
}
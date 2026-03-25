// src/services/staffService.js

import api from "../api";



function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.append(key, value);
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

/* -----------------------------
 * Reference / options
 * ----------------------------- */
export function getStaffProsecutors() {
  return api.get("/staff/prosecutors");
}

export function getStaffCaseOptions() {
  return api.get("/staff/case-options");
}

/* -----------------------------
 * Dashboard
 * ----------------------------- */
export function getStaffDashboardCards() {
  return api.get("/staff/dashboard/cards");
}

export function getStaffDashboardSummary() {
  return api.get("/staff/dashboard/summary");
}

export function getStaffDashboardRecentActivity(params = {}) {
  return api.get(`/staff/dashboard/recent-activity${buildQuery(params)}`);
}

/* -----------------------------
 * Intake cases
 * ----------------------------- */
export function createIntakeCase(data) {
  return api.post("/staff/intake-cases", data);
}

export function getIntakeCases(params = {}) {
  return api.get(`/staff/intake-cases${buildQuery(params)}`);
}

export function getIntakeCaseById(intakeCaseId) {
  return api.get(`/staff/intake-cases/${intakeCaseId}`);
}

export function confirmIntakeCase(intakeCaseId, data = {}) {
  return api.post(`/staff/intake-cases/${intakeCaseId}/confirm`, data);
}

export function convertIntakeCase(intakeCaseId) {
  return api.post(`/staff/intake-cases/${intakeCaseId}/convert`);
}

export function deleteIntakeCase(intakeCaseId) {
  return api.delete(`/staff/intake-cases/${intakeCaseId}`);
}

export function resetUnconvertedIntakeCases() {
  return api.delete("/staff/intake-cases/reset");
}

export function deleteAllIntakeCases() {
  return api.delete("/staff/intake-cases/delete-all");
}

/* -----------------------------
 * Intake documents
 * ----------------------------- */
export function uploadIntakeCaseDocument(intakeCaseId, formData) {
  return api.post(`/staff/intake-cases/${intakeCaseId}/documents`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function getIntakeCaseDocument(documentId) {
  return api.get(`/staff/intake-case-documents/${documentId}`);
}

export function extractIntakeCaseDocument(documentId, forceReextract = false) {
  const query = forceReextract ? "?force_reextract=true" : "";
  return api.post(`/staff/intake-case-documents/${documentId}/extract${query}`);
}

export function reviewIntakeCaseDocument(documentId, data) {
  return api.patch(`/staff/intake-case-documents/${documentId}/review`, data);
}

export function deleteIntakeCaseDocument(documentId) {
  return api.delete(`/staff/intake-case-documents/${documentId}`);
}

export function deleteAllIntakeCaseDocuments() {
  return api.delete("/staff/intake-case-documents/delete-all");
}

/* -----------------------------
 * Intake trackers
 * ----------------------------- */
export function getIntakeCaseDocumentTrackers(intakeCaseId) {
  return api.get(`/staff/intake-cases/${intakeCaseId}/document-trackers`);
}

export function createIntakeCaseDocumentTracker(intakeCaseId, data) {
  return api.post(`/staff/intake-cases/${intakeCaseId}/document-trackers`, data);
}

export function updateIntakeCaseDocumentTracker(intakeCaseId, trackerId, data) {
  return api.patch(
    `/staff/intake-cases/${intakeCaseId}/document-trackers/${trackerId}`,
    data
  );
}

export function deleteIntakeCaseDocumentTracker(intakeCaseId, trackerId) {
  return api.delete(
    `/staff/intake-cases/${intakeCaseId}/document-trackers/${trackerId}`
  );
}

export function deleteAllIntakeDocumentTrackers() {
  return api.delete("/staff/intake-document-trackers/delete-all");
}

/* -----------------------------
 * Intake compliance items
 * ----------------------------- */
export function getIntakeCaseComplianceItems(intakeCaseId) {
  return api.get(`/staff/intake-cases/${intakeCaseId}/compliance-items`);
}

export function createIntakeCaseComplianceItem(intakeCaseId, data) {
  return api.post(`/staff/intake-cases/${intakeCaseId}/compliance-items`, data);
}

export function updateIntakeCaseComplianceItem(intakeCaseId, complianceId, data) {
  return api.patch(
    `/staff/intake-cases/${intakeCaseId}/compliance-items/${complianceId}`,
    data
  );
}

/* note:
 * backend snippet you gave does not currently show
 * DELETE /staff/intake-cases/:id/compliance-items/:compliance_id
 * so no delete function here yet for intake compliance
 */

/* -----------------------------
 * Intake audit logs
 * ----------------------------- */
export function getIntakeCaseAuditLogs(intakeCaseId) {
  return api.get(`/staff/intake-cases/${intakeCaseId}/audit-logs`);
}

/* -----------------------------
 * Official cases
 * ----------------------------- */
export function getOfficialCases(params = {}) {
  return api.get(`/staff/cases${buildQuery(params)}`);
}

export function getOfficialCaseById(caseId) {
  return api.get(`/staff/cases/${caseId}`);
}

export function updateOfficialCase(caseId, data) {
  return api.patch(`/staff/cases/${caseId}`, data);
}

/* -----------------------------
 * Official case documents
 * ----------------------------- */
export function uploadOfficialCaseDocument(caseId, formData) {
  return api.post(`/staff/cases/${caseId}/documents`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function getOfficialCaseDocuments(caseId) {
  return api.get(`/staff/cases/${caseId}/documents`);
}

export function updateOfficialCaseDocument(documentId, data) {
  return api.patch(`/staff/case-documents/${documentId}`, data);
}

export function deleteOfficialCaseDocument(documentId) {
  return api.delete(`/staff/cases/documents/${documentId}`);
}

/* -----------------------------
 * Official case document trackers
 * ----------------------------- */
export function getOfficialCaseDocumentTrackers(caseId) {
  return api.get(`/staff/cases/${caseId}/document-trackers`);
}

export function createOfficialCaseDocumentTracker(caseId, data) {
  return api.post(`/staff/cases/${caseId}/document-trackers`, data);
}

export function updateOfficialCaseDocumentTracker(caseId, trackerId, data) {
  return api.patch(`/staff/cases/${caseId}/document-trackers/${trackerId}`, data);
}

export function deleteOfficialCaseDocumentTracker(caseId, trackerId) {
  return api.delete(`/staff/cases/${caseId}/document-trackers/${trackerId}`);
}

/* -----------------------------
 * Official case compliance items
 * ----------------------------- */
export function getOfficialCaseComplianceItems(caseId) {
  return api.get(`/staff/cases/${caseId}/compliance-items`);
}

export function createOfficialCaseComplianceItem(caseId, data) {
  return api.post(`/staff/cases/${caseId}/compliance-items`, data);
}

export function updateOfficialCaseComplianceItem(caseId, complianceId, data) {
  return api.patch(
    `/staff/cases/${caseId}/compliance-items/${complianceId}`,
    data
  );
}

export function deleteOfficialCaseComplianceItem(caseId, complianceId) {
  return api.delete(`/staff/cases/${caseId}/compliance-items/${complianceId}`);
}

/* -----------------------------
 * Official case court events
 * ----------------------------- */
export function getOfficialCaseCourtEvents(caseId) {
  return api.get(`/staff/cases/${caseId}/court-events`);
}

export function createOfficialCaseCourtEvent(caseId, data) {
  return api.post(`/staff/cases/${caseId}/court-events`, data);
}

export function updateOfficialCaseCourtEvent(caseId, eventId, data) {
  return api.patch(`/staff/cases/${caseId}/court-events/${eventId}`, data);
}

export function deleteOfficialCaseCourtEvent(caseId, eventId) {
  return api.delete(`/staff/cases/${caseId}/court-events/${eventId}`);
}

/* -----------------------------
 * Official case audit logs
 * ----------------------------- */
export function getOfficialCaseAuditLogs(caseId) {
  return api.get(`/staff/cases/${caseId}/audit-logs`);
}

/* -----------------------------
 * Legacy cases
 * ----------------------------- */
export function createLegacyCase(data) {
  return api.post("/staff/legacy-cases", data);
}

export function getLegacyCases(params = {}) {
  return api.get(`/staff/legacy-cases${buildQuery(params)}`);
}

export function getLegacyCaseById(caseId) {
  return api.get(`/staff/legacy-cases/${caseId}`);
}

export function updateLegacyCase(caseId, data) {
  return api.patch(`/staff/legacy-cases/${caseId}`, data);
}

export function deleteLegacyCase(caseId) {
  return api.delete(`/staff/legacy-cases/${caseId}`);
}

export function getLegacyCaseStats() {
  return api.get("/staff/legacy-cases/stats");
}

/* -----------------------------
 * Global audit logs
 * ----------------------------- */
export function getStaffAuditLogs(params = {}) {
  return api.get(`/staff/audit-logs${buildQuery(params)}`);
}
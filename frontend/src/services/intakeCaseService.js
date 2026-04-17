import api from "../api";

export async function updateCanonicalIntakeCase(intakeCaseId, payload) {
  return api.patch(`/staff/intake-cases/${intakeCaseId}/canonical`, payload);
}


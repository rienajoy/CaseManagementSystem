// src/services/adminService.js

import api from "../api";

export function getAdminUsers() {
  return api.get("/admin/users");
}

export function createAdminUser(data) {
  return api.post("/admin/users", data);
}

export function lockAdminUser(userId) {
  return api.put(`/admin/users/${userId}/lock`);
}

export function unlockAdminUser(userId) {
  return api.put(`/admin/users/${userId}/unlock`);
}

export function deleteAdminUser(userId) {
  return api.delete(`/admin/users/${userId}`);
}

export function resetAdminUserPassword(userId, data) {
  return api.put(`/admin/users/${userId}/reset-password`, data);
}

export function getAdminPermissions() {
  return api.get("/admin/permissions");
}

export function updateAdminUserPermissions(userId, data) {
  return api.put(`/admin/users/${userId}/permissions`, data);
}

export function getUsersStatus() {
  return api.get("/users-status");
}

export function getAdminActionLogs() {
  return api.get("/admin/action-logs");
}
// src/utils/roles.js

export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  PROSECUTOR: "prosecutor",
  STAFF: "staff",
};

export const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN];

export function isAdminLevel(user) {
  return ADMIN_ROLES.includes(user?.role);
}

export function isSuperAdmin(user) {
  return user?.role === ROLES.SUPER_ADMIN;
}

export function isProsecutor(user) {
  return user?.role === ROLES.PROSECUTOR;
}

export function isStaff(user) {
  return user?.role === ROLES.STAFF;
}
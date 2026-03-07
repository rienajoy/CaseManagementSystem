// src/utils/storage.js

export function getStoredToken() {
  return localStorage.getItem("token");
}

export function setStoredToken(token) {
  localStorage.setItem("token", token);
}

export function clearStoredToken() {
  localStorage.removeItem("token");
}

export function getStoredUser() {
  return JSON.parse(localStorage.getItem("user") || "null");
}

export function setStoredUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}

export function clearStoredUser() {
  localStorage.removeItem("user");
}

export function getRememberedEmail() {
  return localStorage.getItem("remember_email") || "";
}

export function setRememberedEmail(email) {
  localStorage.setItem("remember_email", email);
}

export function clearRememberedEmail() {
  localStorage.removeItem("remember_email");
}
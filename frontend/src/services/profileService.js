// src/services/profileService.js

import api from "../api";

export function getMyProfile() {
  return api.get("/my-profile");
}

export function updateMyProfile(data) {
  return api.put("/update-profile", data);
}

export function uploadMyProfilePicture(formData) {
  return api.post("/upload-profile-pic", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function changeMyPassword(data) {
  return api.post("/change-password", data);
}
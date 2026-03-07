const SETTINGS_KEY = "app_settings";

const defaultSettings = {
  theme: "light",
  sidebarDefault: "expanded",
  showDashboardHints: true,
  showActivityPanels: true,
};

export function getDefaultAppSettings() {
  return defaultSettings;
}

export function getAppSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw);

    return {
      ...defaultSettings,
      ...parsed,
    };
  } catch {
    return defaultSettings;
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;

  root.classList.remove("theme-light", "theme-dark");

  if (theme === "system") {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    root.classList.add(prefersDark ? "theme-dark" : "theme-light");
    return;
  }

  root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
}

export function saveAppSettings(settings) {
  const merged = {
    ...defaultSettings,
    ...settings,
  };

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  applyTheme(merged.theme);

  window.dispatchEvent(new Event("app-settings-changed"));
}

export function initializeAppSettings() {
  const settings = getAppSettings();
  applyTheme(settings.theme);
  return settings;
}
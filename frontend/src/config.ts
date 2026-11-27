const rawApiUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const rawGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const rawSupportApiKey = import.meta.env.VITE_SUPPORT_API_KEY as string | undefined;

export const API_BASE_URL = (rawApiUrl?.trim() || "http://localhost:8000").replace(/\/+$/, "");

export const GOOGLE_CLIENT_ID = rawGoogleClientId?.trim() || "";

export const SUPPORT_API_KEY = rawSupportApiKey?.trim() || "";

export const STORAGE_KEYS = {
  ACTIVE_USER: "guia_turista_active_user",
  SAVED_GOOGLE_USER: "guia_turista_saved_google_user",
  SESSION_START: "guia_turista_session_start",
  GUEST_TRIPS_CACHE: "guia_turista_guest_trips",
  THEME: "guia_turista_theme",
} as const;

export const VISITANTE_TTL_MS = 2 * 60 * 60 * 1000;

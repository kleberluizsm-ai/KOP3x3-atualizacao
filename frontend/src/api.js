import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("kop_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function formatErr(detail) {
  if (!detail) return "Erro inesperado.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(d => d.msg || JSON.stringify(d)).join(" ");
  if (detail?.msg) return detail.msg;
  return String(detail);
}

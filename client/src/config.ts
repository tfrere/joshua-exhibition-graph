export const SOCKET_SERVER_URL = import.meta.env.PROD
  ? import.meta.env.VITE_SERVER_URL || "https://your-server-url.railway.app"
  : "http://localhost:3000";

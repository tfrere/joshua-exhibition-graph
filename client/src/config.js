// Configuration de l'application

// Déterminer l'environnement d'exécution
const isProd = window.location.hostname !== "localhost";

// URL du serveur socket.io - différente en prod et en dev
export const SOCKET_SERVER_URL = isProd
  ? import.meta.env.VITE_SERVER_URL ||
    "https://server-production-6167.up.railway.app"
  : "http://localhost:3000";

console.log(`Mode d'exécution: ${isProd ? "PRODUCTION" : "DÉVELOPPEMENT"}`);
console.log(`Socket.IO se connecte à: ${SOCKET_SERVER_URL}`);

// Autres paramètres de configuration
export const APP_CONFIG = {
  maxPostsToRender: 10000,
  bloomIntensity: 0.1,
  bloomThreshold: 0.9,
  bloomSmoothness: 0.9,
};

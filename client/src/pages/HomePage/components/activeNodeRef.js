// Référence partagée pour le nœud actif et les nœuds Joshua
// Cette méthode évite les re-renders React tout en partageant l'état dans toute l'application
import { io } from "socket.io-client";
import { SOCKET_SERVER_URL } from "../../../config";

// Node actif
export const activeNodeRef = { current: null };

// Liste des nœuds Joshua
export const joshuaNodesRef = { current: [] };

// Socket pour la synchronisation
let socket = null;

// Système d'événements pour notifier les changements en temps réel
const eventListeners = {
  activeNodeChanged: [],
};

// Ajouter un écouteur d'événement
export const addEventListener = (event, callback) => {
  if (eventListeners[event]) {
    eventListeners[event].push(callback);
    return true;
  }
  return false;
};

// Supprimer un écouteur d'événement
export const removeEventListener = (event, callback) => {
  if (eventListeners[event]) {
    const index = eventListeners[event].indexOf(callback);
    if (index !== -1) {
      eventListeners[event].splice(index, 1);
      return true;
    }
  }
  return false;
};

// Déclencher un événement
const triggerEvent = (event, data) => {
  if (eventListeners[event]) {
    eventListeners[event].forEach((callback) => callback(data));
  }
};

// Initialiser la connexion socket
export const initSocketSync = () => {
  if (!socket) {
    socket = io(SOCKET_SERVER_URL);

    // Écouter les mises à jour de nœud actif depuis d'autres clients
    socket.on("activeNodeUpdated", (node) => {
      // Ne mettre à jour que si le nœud a changé
      if (!activeNodeRef.current || activeNodeRef.current.id !== node.id) {
        console.log("Nœud actif reçu via socket:", node);
        activeNodeRef.current = node;
        // Notifier tous les écouteurs du changement
        triggerEvent("activeNodeChanged", node);
      }
    });
  }
  return socket;
};

// Mettre à jour le nœud actif et l'envoyer via socket
export const updateActiveNode = (node) => {
  // Ne faire l'envoi que si le nœud a changé
  if (!activeNodeRef.current || activeNodeRef.current.id !== node.id) {
    console.log("Envoi du nœud actif via socket:", node);
    activeNodeRef.current = node;

    // Notifier tous les écouteurs du changement
    triggerEvent("activeNodeChanged", node);

    // Si le socket est initialisé, envoyer la mise à jour
    if (socket) {
      // N'envoyer que les informations essentielles pour réduire la taille des données
      const nodeData = {
        id: node.id,
        slug: node.slug,
        name: node.name || node.label,
        x: node.x,
        y: node.y,
        z: node.z,
      };

      socket.emit("updateActiveNode", nodeData);
    }
  }
};

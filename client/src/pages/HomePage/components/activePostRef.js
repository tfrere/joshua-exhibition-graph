// Référence partagée pour le post actif
// Cette méthode évite les re-renders React tout en partageant l'état dans toute l'application
import { io } from "socket.io-client";
import { SOCKET_SERVER_URL } from "../../../config";

// Post actif
export const activePostRef = { current: null };

// Socket pour la synchronisation
let socket = null;

// Système d'événements pour notifier les changements en temps réel
const eventListeners = {
  activePostChanged: [],
};

// Ajouter un écouteur d'événement
export const addEventListener = (event, callback) => {
  if (eventListeners[event]) {
    eventListeners[event].push(callback);
    console.log(
      `Écouteur ajouté pour l'événement '${event}'. Total: ${eventListeners[event].length}`
    );
    return true;
  }
  console.warn(
    `Tentative d'ajout d'écouteur pour un événement inconnu: ${event}`
  );
  return false;
};

// Supprimer un écouteur d'événement
export const removeEventListener = (event, callback) => {
  if (eventListeners[event]) {
    const index = eventListeners[event].indexOf(callback);
    if (index !== -1) {
      eventListeners[event].splice(index, 1);
      console.log(
        `Écouteur supprimé pour l'événement '${event}'. Restants: ${eventListeners[event].length}`
      );
      return true;
    }
  }
  console.warn(
    `Tentative de suppression d'un écouteur inexistant pour: ${event}`
  );
  return false;
};

// Déclencher un événement
const triggerEvent = (event, data) => {
  if (eventListeners[event]) {
    console.log(
      `Déclenchement de l'événement '${event}' avec les données:`,
      data
    );
    eventListeners[event].forEach((callback) => callback(data));
  } else {
    console.warn(`Tentative de déclenchement d'un événement inconnu: ${event}`);
  }
};

// Initialiser la connexion socket
export const initSocketSync = () => {
  console.log(
    "Initialisation de la connexion socket au serveur:",
    SOCKET_SERVER_URL
  );

  if (!socket) {
    try {
      socket = io(SOCKET_SERVER_URL);

      socket.on("connect", () => {
        console.log("Socket connecté avec succès. ID:", socket.id);
      });

      socket.on("connect_error", (error) => {
        console.error("Erreur de connexion socket:", error);
      });

      // Écouter les mises à jour de post actif depuis d'autres clients
      socket.on("activePostUpdated", (post) => {
        // Ne mettre à jour que si le post a changé
        if (
          !activePostRef.current ||
          activePostRef.current.postUID !== post.postUID
        ) {
          console.log("Post actif reçu via socket:", post);
          activePostRef.current = post;
          // Notifier tous les écouteurs du changement
          triggerEvent("activePostChanged", post);
        }
      });
    } catch (error) {
      console.error("Erreur lors de l'initialisation de la socket:", error);
    }
  } else {
    console.log(
      "Socket déjà initialisé. État:",
      socket.connected ? "connecté" : "déconnecté"
    );
  }

  return socket;
};

// Mettre à jour le post actif et l'envoyer via socket
export const updateActivePost = (post) => {
  // Vérifier que le post contient les données minimales nécessaires
  if (!post || !post.postUID) {
    console.error("Tentative de mise à jour avec un post invalide:", post);
    return;
  }

  // Ne faire l'envoi que si le post a changé
  if (
    !activePostRef.current ||
    activePostRef.current.postUID !== post.postUID
  ) {
    console.log("Envoi du post actif via socket:", post);
    activePostRef.current = post;

    // Notifier tous les écouteurs du changement
    triggerEvent("activePostChanged", post);

    // Si le socket est initialisé, envoyer la mise à jour
    if (socket) {
      if (!socket.connected) {
        console.warn(
          "Socket non connecté lors de la tentative d'envoi du post actif"
        );
      }

      // N'envoyer que les informations essentielles pour réduire la taille des données
      const postData = {
        id: post.id,
        postUID: post.postUID,
        slug: post.slug,
        x:
          post.x !== undefined
            ? post.x
            : post.coordinates
            ? post.coordinates.x
            : 0,
        y:
          post.y !== undefined
            ? post.y
            : post.coordinates
            ? post.coordinates.y
            : 0,
        z:
          post.z !== undefined
            ? post.z
            : post.coordinates
            ? post.coordinates.z
            : 0,
        impact: post.impact,
      };

      try {
        socket.emit("updateActivePost", postData);
        console.log("Post actif envoyé avec succès via socket");
      } catch (error) {
        console.error(
          "Erreur lors de l'envoi du post actif via socket:",
          error
        );
      }
    } else {
      console.error(
        "Socket non initialisée lors de la tentative d'envoi du post actif"
      );
    }
  } else {
    console.log("Post déjà actif, pas d'envoi:", post.postUID);
  }
};

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { io } from "socket.io-client";
import { SOCKET_SERVER_URL } from "../../../../../config";
import { getInputManager } from "../../../utils/inputManager";

// Référence partagée pour le post actif
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
    
    // Activer la vibration de la manette lors du changement de post
    const inputManager = getInputManager();
    if (inputManager) {
      // Vibration courte mais forte pour signaler le changement de focus
      inputManager.vibrateGamepad(20, 0.0, 0.1);
    }
    
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

/**
 * Hook personnalisé pour détecter le post le plus proche de la cible
 * et mettre à jour le post actif
 */
const useNearestPostDetection = (posts) => {
  const { camera } = useThree();
  const prevNearestPostRef = useRef(null);
  const frameCountRef = useRef(0);
  const targetPositionRef = useRef(new THREE.Vector3());

  // Constantes pour la configuration
  const UPDATE_INTERVAL = 1; // Nombre de frames entre chaque mise à jour

  // Initialiser la connexion socket
  useEffect(() => {
    console.log(
      "useNearestPostDetection - Initialisation de la connexion socket"
    );
    initSocketSync();
  }, []);

  // Log initial pour vérifier les données reçues
  useEffect(() => {
    console.log("useNearestPostDetection - Posts reçus:", posts);
    if (posts && posts.length > 0) {
      console.log("Premier post:", posts[0]);
      // Vérifier si les posts ont des coordonnées
      const postsWithCoordinates = posts.filter(
        (post) =>
          (post.x !== undefined &&
            post.y !== undefined &&
            post.z !== undefined) ||
          (post.coordinates && post.coordinates.x !== undefined)
      );
      console.log(
        `Posts avec coordonnées: ${postsWithCoordinates.length}/${posts.length}`
      );

      // Vérifier si les posts ont un postUID
      const postsWithUID = posts.filter((post) => post.postUID !== undefined);
      console.log(`Posts avec postUID: ${postsWithUID.length}/${posts.length}`);

      // Si certains posts n'ont pas de postUID, ajouter un avertissement
      if (postsWithUID.length < posts.length) {
        console.warn(
          "Certains posts n'ont pas de postUID, ce qui empêchera la détection correcte."
        );
        const postsWithoutUID = posts.filter(
          (post) => post.postUID === undefined
        );
        console.log("Exemple de post sans postUID:", postsWithoutUID[0]);
      }
    }
  }, [posts]);

  // Fonction de détection du post le plus proche exécutée à chaque frame
  useFrame(() => {
    if (!posts || posts.length === 0) {
      // Si pas de posts, on log une fois toutes les 100 frames
      if (frameCountRef.current % 100 === 0) {
        console.log("useNearestPostDetection - Aucun post disponible");
      }
      frameCountRef.current += 1;
      return;
    }

    // Mettre à jour uniquement toutes les X frames pour optimiser les performances
    frameCountRef.current += 1;
    if (frameCountRef.current % UPDATE_INTERVAL !== 0) return;

    // Position de la caméra
    const cameraPosition = camera.position.clone();

    // Créer un point situé 50 unités devant la caméra dans la direction où elle regarde
    const targetPosition = new THREE.Vector3();

    // Direction dans laquelle la caméra regarde (vecteur unitaire)
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);

    // Calcul de la position cible: position caméra + (direction * distance)
    targetPosition.copy(cameraPosition);
    targetPosition.addScaledVector(cameraDirection, 50);

    // Mettre à jour la référence de position pour la sphère
    targetPositionRef.current.copy(targetPosition);

    // Trouver le post le plus proche
    let nearestPost = null;
    let minDistance = Infinity;

    posts.forEach((post) => {
      // Vérifier si le post a des coordonnées valides
      if (!post) return;

      const postPosition = new THREE.Vector3(
        post.x !== undefined
          ? post.x
          : post.coordinates
          ? post.coordinates.x
          : 0,
        post.y !== undefined
          ? post.y
          : post.coordinates
          ? post.coordinates.y
          : 0,
        post.z !== undefined
          ? post.z
          : post.coordinates
          ? post.coordinates.z
          : 0
      );

      // Log pour debugging (une fois toutes les 100 frames)
      if (frameCountRef.current % 100 === 0 && post === posts[0]) {
        console.log("Position du premier post:", postPosition);
        console.log("Position cible:", targetPosition);
        console.log("Propriétés de position du premier post:", {
          directX: post.x,
          directY: post.y,
          directZ: post.z,
          coordinates: post.coordinates,
        });
      }

      // Calculer la distance entre le point cible et le post
      const distance = targetPosition.distanceTo(postPosition);

      // Mettre à jour le post le plus proche
      if (distance < minDistance) {
        minDistance = distance;
        nearestPost = post;
      }
    });

    // Log pour debugging (une fois toutes les 100 frames)
    if (frameCountRef.current % 100 === 0) {
      console.log("Post le plus proche trouvé:", nearestPost);
      console.log("Distance minimale:", minDistance);
    }

    // Si le post le plus proche a changé, le logger et mettre à jour la référence partagée
    if (
      nearestPost &&
      (!prevNearestPostRef.current ||
        prevNearestPostRef.current.postUID !== nearestPost.postUID)
    ) {
      console.log("Post actif le plus proche:", nearestPost);
      prevNearestPostRef.current = nearestPost;

      // Mettre à jour la référence partagée et envoyer via socket
      updateActivePost(nearestPost);
    }
  });

  // Retourner la position cible et d'autres valeurs utiles
  return { targetPositionRef };
};

export default useNearestPostDetection;

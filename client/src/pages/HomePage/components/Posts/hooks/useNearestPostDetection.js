import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { io } from "socket.io-client";
import { SOCKET_SERVER_URL } from "../../../../../config";
import { getInputManager } from "../../../utils/inputManager";
// Importer la référence au nœud actif pour vérifier son état
import { activeNodeRef } from "../../Node/hooks/useNodeProximitySync";

// Référence partagée pour le post actif
export const activePostRef = { current: null };

// Variable pour suivre si la détection de posts est en pause
let isPostDetectionPaused = false;

// Variable pour suivre si nous sommes en train de traiter un événement socket
let processingSocketEvent = false;

// Socket pour la synchronisation
let socket = null;

// Système d'événements pour notifier les changements en temps réel
const eventListeners = {
  activePostChanged: [],
  detectionPaused: [],
  detectionResumed: [],
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

// Fonction pour envoyer un signal de réinitialisation
export const sendResetSignal = () => {
  if (socket && socket.connected) {
    try {
      socket.emit("resetView", { timestamp: Date.now() });
    } catch (error) {
      // Silencieux en cas d'erreur
    }
  }
};

// Fonction pour vérifier si un nœud est actif
export const isNodeActive = () => {
  return activeNodeRef.current !== null;
};

// Fonction pour mettre en pause la détection de posts
export const pausePostDetection = (fromSocket = false) => {
  // Si nous sommes déjà en pause, ne rien faire
  if (isPostDetectionPaused) {
    return;
  }

  console.log(
    "[pausePostDetection] Pausing post detection, fromSocket:",
    fromSocket
  );

  // Définir le drapeau de pause
  isPostDetectionPaused = true;
  triggerEvent("detectionPaused", {});

  // Désactiver le post actif quand on passe en mode pause
  if (activePostRef.current) {
    // Envoyer un message de désactivation du post SEULEMENT si on n'est pas déjà en train
    // de traiter un événement socket (pour éviter les boucles)
    if (socket && !fromSocket) {
      try {
        console.log("[pausePostDetection] Emitting updateActivePost null");
        socket.emit("updateActivePost", null);
      } catch (error) {
        console.error(
          "[pausePostDetection] Error emitting updateActivePost:",
          error
        );
      }
    } else {
      console.log(
        "[pausePostDetection] Skipping socket emit as fromSocket =",
        fromSocket
      );
    }

    // Réinitialiser localement
    const oldPost = activePostRef.current;
    activePostRef.current = null;

    // Notifier du changement
    triggerEvent("activePostChanged", { post: null, previousPost: oldPost });
  }
};

// Fonction pour reprendre la détection de posts
export const resumePostDetection = () => {
  if (isPostDetectionPaused) {
    isPostDetectionPaused = false;
    triggerEvent("detectionResumed", {});
  }
};

// Initialiser la connexion socket
export const initSocketSync = () => {
  if (!socket) {
    try {
      socket = io(SOCKET_SERVER_URL);

      socket.on("connect", () => {
        // Socket connecté
        console.log(
          "[Socket] Connected successfully, ensuring post detection is active"
        );
        // S'assurer que la détection est active dès la connexion
        resumePostDetection();
      });

      socket.on("connect_error", (error) => {
        // Silencieux en cas d'erreur
      });

      // Écouter les mises à jour de post actif depuis d'autres clients
      socket.on("activePostUpdated", (post) => {
        processingSocketEvent = true;
        console.log("[activePostUpdated] Received:", post);

        // Si on est en mode pause, ignorer les mises à jour sauf si c'est un null (désactivation)
        if (isPostDetectionPaused && post !== null) {
          console.log(
            "[activePostUpdated] Ignoring non-null update while detection is paused"
          );
          processingSocketEvent = false;
          return;
        }

        // Vérifier si post est null
        if (post === null) {
          // Si le post est null, mettre à jour le activePostRef.current à null
          if (activePostRef.current !== null) {
            console.log(
              "[activePostUpdated] Setting activePostRef.current to null"
            );
            const previousPost = activePostRef.current;
            activePostRef.current = null;
            // Notifier tous les écouteurs du changement
            triggerEvent("activePostChanged", {
              post: null,
              previousPost,
            });
          }
          processingSocketEvent = false;
          return;
        }

        // Ne mettre à jour que si le post a changé
        if (
          !activePostRef.current ||
          activePostRef.current.postUID !== post.postUID
        ) {
          console.log(
            "[activePostUpdated] Updating activePostRef.current to:",
            post
          );
          const previousPost = activePostRef.current;
          activePostRef.current = post;
          // Notifier tous les écouteurs du changement
          triggerEvent("activePostChanged", {
            post,
            previousPost,
          });
        } else {
          console.log(
            "[activePostUpdated] No change needed for activePostRef.current"
          );
        }

        processingSocketEvent = false;
      });

      // Écouter les mises à jour de nœud actif
      socket.on("activeNodeUpdated", (data) => {
        console.log("[activeNodeUpdated] Received raw data:", data);

        // Extraction du nœud et du type d'événement
        const node = data?.node || null;
        const eventType =
          data?.eventType || (node ? "activation" : "deactivation");

        console.log("[activeNodeUpdated] Extracted node:", node);
        console.log("[activeNodeUpdated] Extracted eventType:", eventType);

        // Si un nœud est activé, mettre en pause la détection des posts
        if (node && eventType === "activation") {
          console.log(
            "[activeNodeUpdated] Activating node, calling pausePostDetection with fromSocket=true"
          );

          // Important: exposer explicitement le nœud actif globalement
          if (typeof window !== "undefined" && window.activeNodeRef) {
            window.activeNodeRef.current = node;
            console.log(
              "[activeNodeUpdated] Updated window.activeNodeRef.current:",
              window.activeNodeRef.current
            );
          }

          // Créer et déclencher un CustomEvent activeNodeChanged
          try {
            const customEvent = new CustomEvent("activeNodeChanged", {
              detail: node,
            });
            console.log(
              "[activeNodeUpdated] Dispatching CustomEvent with node details:",
              node
            );
            window.dispatchEvent(customEvent);
          } catch (error) {
            console.error(
              "[activeNodeUpdated] Error dispatching CustomEvent:",
              error
            );
          }

          pausePostDetection(true);
        } else if (eventType === "deactivation") {
          console.log(
            "[activeNodeUpdated] Deactivating node, calling resumePostDetection"
          );

          // Important: nettoyer la référence globale
          if (typeof window !== "undefined" && window.activeNodeRef) {
            window.activeNodeRef.current = null;
            console.log(
              "[activeNodeUpdated] Cleared window.activeNodeRef.current"
            );
          }

          // Déclencher un événement avec null
          try {
            const customEvent = new CustomEvent("activeNodeChanged", {
              detail: null,
            });
            console.log(
              "[activeNodeUpdated] Dispatching CustomEvent with null"
            );
            window.dispatchEvent(customEvent);
          } catch (error) {
            console.error(
              "[activeNodeUpdated] Error dispatching CustomEvent:",
              error
            );
          }

          resumePostDetection();
        }
      });
    } catch (error) {
      // Silencieux en cas d'erreur
    }
  }

  return socket;
};

// Mettre à jour le post actif et l'envoyer via socket
export const updateActivePost = (post) => {
  // Debug: Afficher l'état de la détection au moment de l'appel
  console.log(
    "[updateActivePost] State check - processingSocketEvent:",
    processingSocketEvent,
    "isPostDetectionPaused:",
    isPostDetectionPaused
  );

  // Si nous sommes déjà en train de traiter un événement socket, ne pas renvoyer
  if (processingSocketEvent) {
    console.log(
      "[updateActivePost] Skipping as we're processing a socket event"
    );
    return;
  }

  // Si la détection est en pause, ne rien faire
  if (isPostDetectionPaused) {
    console.log("[updateActivePost] Skipping as detection is paused");
    return;
  }

  console.log("[updateActivePost] Called with post:", post);

  // Cas spécial : réinitialisation avec null
  if (post === null) {
    if (activePostRef.current !== null) {
      console.log("[updateActivePost] Setting activePostRef.current to null");
      const previousPost = activePostRef.current;
      activePostRef.current = null;

      // Notifier tous les écouteurs du changement
      triggerEvent("activePostChanged", { post: null, previousPost });

      // Si le socket est initialisé, envoyer la réinitialisation
      if (socket) {
        console.log("[updateActivePost] Emitting updateActivePost null");
        socket.emit("updateActivePost", null);
      }
    }
    return;
  }

  // Vérifier que le post contient les données minimales nécessaires
  if (!post || !post.postUID) {
    return;
  }

  // Ne faire l'envoi que si le post a changé
  if (
    !activePostRef.current ||
    activePostRef.current.postUID !== post.postUID
  ) {
    const previousPost = activePostRef.current;
    activePostRef.current = post;

    // Notifier tous les écouteurs du changement
    triggerEvent("activePostChanged", { post, previousPost });

    // Si le socket est initialisé, envoyer la mise à jour
    if (socket) {
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
      };

      socket.emit("updateActivePost", postData);
    }
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
    initSocketSync();

    // Forcer l'état initial à actif pour permettre la détection des posts dès le démarrage
    resumePostDetection();

    // Vérifier l'état initial - si un nœud est déjà actif, mettre en pause
    // Cette vérification est commentée pour permettre la détection des posts dès le démarrage
    // if (isNodeActive()) {
    //   pausePostDetection();
    // }

    // S'abonner aux changements de nœud actif
    const handleNodeChange = (data) => {
      const { node, eventType } = data;

      if (eventType === "activation" && node) {
        pausePostDetection();
      } else if (eventType === "deactivation") {
        resumePostDetection();
      }
    };

    // Importer et utiliser addEventListener du module useNodeProximitySync
    import("../../Node/hooks/useNodeProximitySync").then((module) => {
      module.addEventListener("activeNodeChanged", handleNodeChange);
    });

    return () => {
      // Nettoyer l'écouteur
      import("../../Node/hooks/useNodeProximitySync").then((module) => {
        module.removeEventListener("activeNodeChanged", handleNodeChange);
      });
    };
  }, []);

  // Fonction de détection du post le plus proche exécutée à chaque frame
  useFrame(() => {
    // Si la détection est en pause ou pas de posts, ne rien faire
    if (isPostDetectionPaused || !posts || posts.length === 0) {
      // Ajouter un log périodique pour voir l'état (tous les 60 frames ~ 1 seconde)
      if (frameCountRef.current % 60 === 0) {
        console.log(
          "[useFrame] Detection paused or no posts. isPostDetectionPaused:",
          isPostDetectionPaused,
          "posts length:",
          posts?.length || 0
        );
      }
      frameCountRef.current += 1;
      return;
    }

    // Mettre à jour uniquement toutes les X frames pour optimiser les performances
    frameCountRef.current += 1;
    if (frameCountRef.current % UPDATE_INTERVAL !== 0) return;

    // Log périodique pour confirmer que la détection est active (tous les 60 frames ~ 1 seconde)
    if (frameCountRef.current % 60 === 0) {
      console.log(
        "[useFrame] Detection active. Processing",
        posts.length,
        "posts"
      );
    }

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

      // Calculer la distance entre le point cible et le post
      const distance = targetPosition.distanceTo(postPosition);

      // Mettre à jour le post le plus proche
      if (distance < minDistance) {
        minDistance = distance;
        nearestPost = post;
      }
    });

    // Si le post le plus proche a changé, le logger et mettre à jour la référence partagée
    if (
      nearestPost &&
      (!prevNearestPostRef.current ||
        prevNearestPostRef.current.postUID !== nearestPost.postUID)
    ) {
      prevNearestPostRef.current = nearestPost;

      // Mettre à jour la référence partagée et envoyer via socket
      updateActivePost(nearestPost);
    }
  });

  // Retourner la position cible et d'autres valeurs utiles
  return {
    targetPositionRef,
    isDetectionPaused: () => isPostDetectionPaused,
  };
};

export default useNearestPostDetection;

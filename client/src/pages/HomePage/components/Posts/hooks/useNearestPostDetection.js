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

// Initialiser la connexion socket
export const initSocketSync = () => {
  if (!socket) {
    try {
      socket = io(SOCKET_SERVER_URL);

      socket.on("connect", () => {
        // Socket connecté
      });

      socket.on("connect_error", (error) => {
        // Silencieux en cas d'erreur
      });

      // Écouter les mises à jour de post actif depuis d'autres clients
      socket.on("activePostUpdated", (post) => {
        // Ne mettre à jour que si le post a changé
        if (
          !activePostRef.current ||
          activePostRef.current.postUID !== post.postUID
        ) {
          activePostRef.current = post;
          // Notifier tous les écouteurs du changement
          triggerEvent("activePostChanged", post);
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
  // Vérifier que le post contient les données minimales nécessaires
  if (!post || !post.postUID) {
    return;
  }

  // Ne faire l'envoi que si le post a changé
  if (
    !activePostRef.current ||
    activePostRef.current.postUID !== post.postUID
  ) {
    activePostRef.current = post;

    // Notifier tous les écouteurs du changement
    triggerEvent("activePostChanged", post);

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
        impact: post.impact,
      };

      try {
        socket.emit("updateActivePost", postData);
      } catch (error) {
        // Silencieux en cas d'erreur
      }
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
  }, []);

  // Log initial pour vérifier les données reçues
  useEffect(() => {
    // Fonctionnalité conservée sans les logs
  }, [posts]);

  // Fonction de détection du post le plus proche exécutée à chaque frame
  useFrame(() => {
    if (!posts || posts.length === 0) {
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
  return { targetPositionRef };
};

export default useNearestPostDetection;

import { useState, useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { io } from "socket.io-client";
import { SOCKET_SERVER_URL } from "../../../../../config";
import { getInputManager } from "../../../utils/inputManager";

// Référence partagée pour le nœud actif en proximité
export const activeNodeRef = { current: null };

// Exposer globalement la référence pour faciliter le débogage et l'accès depuis d'autres fichiers
if (typeof window !== "undefined") {
  console.log("[useNodeProximitySync] Exposing activeNodeRef globally");
  window.activeNodeRef = activeNodeRef;
}

// Socket pour la synchronisation
let socket = null;

// Registre global pour suivre tous les nœuds et leurs distances
const nodesRegistry = {
  nodes: new Map(), // Map des nœuds avec leurs distances
  closestNode: null, // Référence au nœud le plus proche
  closestDistance: Infinity, // Distance du nœud le plus proche

  // Enregistrer un nœud avec sa distance
  registerNode: function (nodeId, node, distance) {
    this.nodes.set(nodeId, { node, distance });
    this.updateClosestNode();
  },

  // Supprimer un nœud du registre
  unregisterNode: function (nodeId) {
    this.nodes.delete(nodeId);
    this.updateClosestNode();
  },

  // Mettre à jour la distance d'un nœud
  updateNodeDistance: function (nodeId, distance) {
    const nodeEntry = this.nodes.get(nodeId);
    if (nodeEntry) {
      nodeEntry.distance = distance;
      this.updateClosestNode();
    }
  },

  // Déterminer le nœud le plus proche
  updateClosestNode: function () {
    let closestNode = null;
    let closestDistance = Infinity;

    // Parcourir tous les nœuds pour trouver le plus proche
    this.nodes.forEach((entry) => {
      // Ne considérer que les nœuds de type "character"
      if (
        entry.node &&
        entry.node.type === "character" &&
        entry.distance < closestDistance
      ) {
        closestDistance = entry.distance;
        closestNode = entry.node;
      }
    });

    // Mettre à jour le nœud le plus proche
    const hasChanged =
      (this.closestNode === null && closestNode !== null) ||
      (this.closestNode !== null && closestNode === null) ||
      (this.closestNode !== null &&
        closestNode !== null &&
        this.closestNode.id !== closestNode.id);

    this.closestNode = closestNode;
    this.closestDistance = closestDistance;

    // Si le nœud le plus proche a changé, mettre à jour via socket
    if (hasChanged) {
      updateActiveNode(closestNode);
    }
  },

  // Vérifier si un nœud est le plus proche
  isClosestNode: function (nodeId) {
    return this.closestNode && this.closestNode.id === nodeId;
  },
};

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
  // Appeler les callbacks locaux
  if (eventListeners[event]) {
    eventListeners[event].forEach((callback) => callback(data));
  }

  // Pour activeNodeChanged, déclencher également un événement global
  if (event === "activeNodeChanged") {
    try {
      // Créer un CustomEvent et le déclencher sur window
      const customEvent = new CustomEvent("activeNodeChanged", {
        detail: data.node, // Comme PostPage.jsx attend event.detail
      });
      window.dispatchEvent(customEvent);
    } catch (error) {
      console.error(
        "Erreur lors du déclenchement de l'événement global:",
        error
      );
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

      // Écouter les mises à jour de nœud actif depuis d'autres clients
      socket.on("activeNodeUpdated", (data) => {
        // Extraction du nœud et du type d'événement
        const node = data?.node || null;
        const eventType =
          data?.eventType || (node ? "activation" : "deactivation");

        // Ne mettre à jour que si le nœud a changé
        if (
          (!activeNodeRef.current && node) ||
          (activeNodeRef.current && !node) ||
          (activeNodeRef.current &&
            node &&
            activeNodeRef.current.id !== node.id)
        ) {
          console.log(
            "[useNodeProximitySync] Updating activeNodeRef.current from socket event:",
            node
          );
          activeNodeRef.current = node;

          // Mise à jour explicite de window.activeNodeRef
          if (typeof window !== "undefined") {
            window.activeNodeRef = activeNodeRef;
            console.log(
              "[useNodeProximitySync] Updated window.activeNodeRef:",
              window.activeNodeRef
            );
          }

          // Notifier tous les écouteurs du changement
          triggerEvent("activeNodeChanged", { node, eventType });

          // Créer et déclencher un CustomEvent sur window pour une meilleure propagation
          try {
            console.log(
              "[useNodeProximitySync] Dispatching CustomEvent activeNodeChanged with node:",
              node
            );
            const customEvent = new CustomEvent("activeNodeChanged", {
              detail: node,
            });
            window.dispatchEvent(customEvent);
          } catch (error) {
            console.error(
              "[useNodeProximitySync] Error dispatching CustomEvent:",
              error
            );
          }
        }
      });
    } catch (error) {
      // Silencieux en cas d'erreur
    }
  }

  return socket;
};

// Mettre à jour le nœud actif et l'envoyer via socket
export const updateActiveNode = (node) => {
  console.log("[updateActiveNode] Called with node:", node);

  // Vérifier si le nœud est de type "character" ou s'il s'agit d'une désactivation (node === null)
  if (node !== null && (!node.type || node.type !== "character")) {
    console.log(
      "[updateActiveNode] Node is not of type 'character', ignoring activation:",
      node
    );
    return;
  }

  // Vérifier que le nœud a changé ou qu'on passe de nœud à pas de nœud
  const hasChanged =
    (!activeNodeRef.current && node) ||
    (activeNodeRef.current && !node) ||
    (activeNodeRef.current && node && activeNodeRef.current.id !== node.id);

  if (hasChanged) {
    console.log(
      "[updateActiveNode] Node has changed. Previous:",
      activeNodeRef.current,
      "New:",
      node
    );

    // Déterminer si c'est une activation ou désactivation
    const isActivation = node !== null;
    const isPreviouslyActive = activeNodeRef.current !== null;
    const eventType = isActivation ? "activation" : "deactivation";

    // Mettre à jour la référence locale
    const previousNode = activeNodeRef.current;
    activeNodeRef.current = node;

    console.log(
      "[updateActiveNode] Updated activeNodeRef.current:",
      activeNodeRef.current
    );

    // Mettre à jour explicitement window.activeNodeRef si disponible
    if (typeof window !== "undefined") {
      window.activeNodeRef = activeNodeRef;
      console.log(
        "[updateActiveNode] Updated window.activeNodeRef:",
        window.activeNodeRef
      );
    }

    // Notifier tous les écouteurs du changement avec le type d'événement
    triggerEvent("activeNodeChanged", { node, eventType });

    // Créer et déclencher un CustomEvent sur window directement
    try {
      const customEvent = new CustomEvent("activeNodeChanged", {
        detail: node,
      });
      console.log(
        "[updateActiveNode] Dispatching CustomEvent activeNodeChanged with detail:",
        node
      );
      window.dispatchEvent(customEvent);
    } catch (error) {
      console.error("[updateActiveNode] Error dispatching CustomEvent:", error);
    }

    // Si le socket est initialisé, envoyer la mise à jour
    if (socket) {
      try {
        // S'il n'y a pas de nœud actif, envoyer un objet avec eventType="deactivation"
        if (!node) {
          socket.emit("updateActiveNode", {
            node: null,
            eventType: "deactivation",
            previousNodeId: isPreviouslyActive
              ? activeNodeRef.current?.id
              : null,
          });
        } else {
          // N'envoyer que les informations essentielles pour réduire la taille des données
          const nodeData = {
            node: {
              id: node.id,
              x: node.position ? node.position[0] : 0,
              y: node.position ? node.position[1] : 0,
              z: node.position ? node.position[2] : 0,
              // Autres propriétés importantes du nœud à transmettre
              label: node.label,
              type: node.type,
              name: node.name,
              isJoshua: node.isJoshua,
              description: node.description,
            },
            eventType: eventType,
            previousNodeId: isPreviouslyActive
              ? activeNodeRef.current?.id
              : null,
            timestamp: Date.now(),
          };

          socket.emit("updateActiveNode", nodeData);
        }
      } catch (error) {
        // Silencieux en cas d'erreur
      }
    }
  }
};

/**
 * Hook personnalisé pour détecter la proximité d'un nœud et synchroniser l'état via socket
 * @param {Object} options - Options de configuration
 * @param {Object} options.node - Le nœud à surveiller
 * @param {Object} options.meshRef - Référence à l'objet 3D du nœud (facultatif)
 * @param {Array|Object} options.position - Position du nœud [x,y,z] ou {x,y,z}
 * @param {number} options.threshold - Distance de seuil pour considérer le nœud comme proche (par défaut: 50)
 * @returns {boolean} - Indique si le nœud est en proximité
 */
const useNodeProximitySync = ({ node, meshRef, position, threshold = 25 }) => {
  const [isInProximity, setIsInProximity] = useState(false);
  const previousProximityState = useRef(false);
  const { camera } = useThree();
  const nodeId = node?.id;

  // Initialiser la connexion socket
  useEffect(() => {
    initSocketSync();

    // Nettoyer le registre lors du démontage du composant
    return () => {
      if (nodeId) {
        nodesRegistry.unregisterNode(nodeId);
      }
    };
  }, []);

  // Enregistrer/désenregistrer le nœud lorsque l'ID change
  useEffect(() => {
    // Nettoyer l'ancien ID si nécessaire
    if (previousProximityState.current && nodeId) {
      nodesRegistry.unregisterNode(nodeId);
    }

    // Réinitialiser l'état
    previousProximityState.current = false;
    setIsInProximity(false);
  }, [nodeId]);

  // Vérifier la proximité du nœud par rapport à la caméra
  useFrame(() => {
    if (!node || !nodeId) return;

    // Obtenir la position du nœud
    const nodePosition = new THREE.Vector3();

    // Si une référence à un mesh est fournie, utiliser sa position mondiale
    if (meshRef && meshRef.current) {
      meshRef.current.getWorldPosition(nodePosition);
    }
    // Sinon utiliser la position fournie directement
    else if (position) {
      if (Array.isArray(position)) {
        nodePosition.set(position[0], position[1], position[2]);
      } else {
        nodePosition.set(position.x || 0, position.y || 0, position.z || 0);
      }
    }

    // Position de la caméra
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);

    // Calculer la distance entre la caméra et le nœud
    const distance = cameraPosition.distanceTo(nodePosition);

    // Nœud en proximité si distance inférieure au seuil
    const newProximityState = distance < threshold;

    // Mettre à jour le registre avec la distance actuelle
    if (newProximityState) {
      // Si le nœud est en proximité, l'enregistrer avec sa distance
      nodesRegistry.registerNode(nodeId, node, distance);
    } else if (previousProximityState.current) {
      // Si le nœud n'est plus en proximité mais l'était avant, le supprimer du registre
      nodesRegistry.unregisterNode(nodeId);
    }

    // Mettre à jour l'état local de proximité
    if (newProximityState !== previousProximityState.current) {
      previousProximityState.current = newProximityState;
    }

    // Mettre à jour l'état local en fonction de si ce nœud est le plus proche
    const isClosest = newProximityState && nodesRegistry.isClosestNode(nodeId);
    if (isClosest !== isInProximity) {
      setIsInProximity(isClosest);
    }
  });

  // Dans le composant Node.jsx, mettre à jour la gestion d'événements
  useEffect(() => {
    // S'abonner aux changements du nœud actif
    const handleActiveNodeChange = (data) => {
      const { node, eventType } = data;

      // Si c'est ce nœud qui est activé ou désactivé
      if (node && node.id === nodeId) {
        setIsInProximity(eventType === "activation");
      } else if (isInProximity && eventType === "activation") {
        // Si un autre nœud est activé pendant que celui-ci était actif
        setIsInProximity(false);
      }
    };

    // Ajouter l'écouteur
    addEventListener("activeNodeChanged", handleActiveNodeChange);

    // Nettoyage à la destruction du composant
    return () => {
      removeEventListener("activeNodeChanged", handleActiveNodeChange);
    };
  }, [nodeId, isInProximity]);

  return isInProximity;
};

export default useNodeProximitySync;

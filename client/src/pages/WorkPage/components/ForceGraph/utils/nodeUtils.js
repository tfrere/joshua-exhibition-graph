import * as THREE from "three";
import { Node } from "../components/Node";
import { Link } from "../components/Link";

/**
 * Palette de couleurs pour les différents types de nœuds
 */
export const COLORS = {
  source: "#4ecdc4",
  joshua: "#ff6b6b",
  character: "#fab1a0",
  contact: "#74b9ff",
  background: "#000119",
  centralJoshua: "#FF6700", // Couleur orange vif pour le nœud central Joshua
  fbi: "#FFD700", // Couleur dorée pour les nœuds FBI
};

/**
 * Crée un objet THREE.js personnalisé pour représenter un nœud dans le graphe
 * @param {Object} node - Le nœud à représenter visuellement
 * @returns {THREE.Group} Un groupe THREE.js contenant la forme 3D et le texte du nœud
 */
export const createNodeObject = (node) => {
  const nodeObject = new Node(node);
  return nodeObject.getMesh();
};

/**
 * Crée un objet THREE.js pour représenter un lien entre deux nœuds
 * @param {Object} link - Les données du lien
 * @param {THREE.Vector3} source - Position du nœud source
 * @param {THREE.Vector3} target - Position du nœud cible
 * @returns {THREE.Object3D} Un objet THREE.js représentant le lien
 */
export const createLinkObject = (link, source, target) => {
  // Vérifier que les positions des nœuds sont définies

  // S'assurer que source et target sont des objets avec des coordonnées x, y, z
  const ensureValidPosition = (pos) => {
    if (!pos) {
      console.warn("Position undefined, using default");
      return { x: 0, y: 0, z: 0 };
    }

    // Si pos est un nœud avec fx, fy, fz (positions fixes), utiliser ces valeurs
    if (pos.fx !== undefined && typeof pos.fx === "number") {
      return {
        x: pos.fx,
        y: pos.fy,
        z: pos.fz || 0,
        ...pos, // Préserver les autres propriétés
      };
    }

    // Si pos est un nœud avec vx, vy, vz (vélocités), utiliser x, y, z
    if (pos.x !== undefined && typeof pos.x === "number") {
      return pos;
    }

    // Dernière option: pos est probablement un ID ou une référence non valide
    console.warn("Invalid position object:", pos);
    return {
      x: Math.random() * 10,
      y: Math.random() * 10,
      z: Math.random() * 10,
    };
  };

  const validSource = ensureValidPosition(source);
  const validTarget = ensureValidPosition(target);

  const linkObject = new Link(link, validSource, validTarget);
  return linkObject.getMesh();
};

/**
 * Met à jour la position d'un lien entre deux nœuds
 * @param {THREE.Object3D} linkObject - L'objet THREE.js à mettre à jour
 * @param {THREE.Vector3} source - Nouvelle position du nœud source
 * @param {THREE.Vector3} target - Nouvelle position du nœud cible
 */
export const updateLinkPosition = (linkObject, source, target) => {
  try {
    // Vérifier que les positions sont valides
    if (
      !source ||
      !target ||
      source.x === undefined ||
      target.x === undefined ||
      isNaN(source.x) ||
      isNaN(target.x)
    ) {
      console.warn(
        "Positions non valides pour la mise à jour du lien",
        source,
        target
      );
      return;
    }

    // Essayer de trouver la caméra dans la scène
    let camera = null;
    if (linkObject.parent && linkObject.parent.parent) {
      const scene = linkObject.parent;

      // Fonction récursive pour trouver la caméra dans la hiérarchie des objets
      const findCamera = (obj) => {
        if (!obj) return null;
        if (obj.isCamera) return obj;
        if (
          obj.type === "PerspectiveCamera" ||
          obj.type === "OrthographicCamera"
        )
          return obj;

        if (obj.children) {
          for (let child of obj.children) {
            const cam = findCamera(child);
            if (cam) return cam;
          }
        }
        return null;
      };

      // Chercher la caméra dans la scène
      camera = findCamera(scene);

      // Si on n'a pas trouvé la caméra, essayons de remonter plus haut dans la hiérarchie
      if (!camera) {
        let parent = scene.parent;
        while (parent && !camera) {
          camera = findCamera(parent);
          parent = parent.parent;
        }
      }
    }

    // Si l'objet linkObject contient une référence à l'instance Link, l'utiliser
    if (linkObject.userData && linkObject.userData.link) {
      const linkInstance = linkObject.userData.link;

      // Mettre à jour les positions de l'instance Link
      linkInstance.source = source;
      linkInstance.target = target;

      // Appeler la méthode updatePosition de l'instance avec la caméra
      linkInstance.updatePosition(source, target, camera);
      return;
    }

    // Fallback: mise à jour directe (ancienne méthode, sans offset)
    if (linkObject.userData && linkObject.userData.positions) {
      // Mettre à jour les positions de la ligne
      const positions = linkObject.userData.positions;
      positions[0] = source.x;
      positions[1] = source.y;
      positions[2] = source.z;
      positions[3] = target.x;
      positions[4] = target.y;
      positions[5] = target.z;

      // Indiquer que les positions ont été mises à jour
      linkObject.userData.line.geometry.attributes.position.needsUpdate = true;

      // Si le lien a un plan avec texture, mettre à jour sa position et orientation
      if (linkObject.userData.updatePlane) {
        linkObject.userData.updatePlane(source, target);
      }

      // Si le lien a du texte, mettre à jour sa position et orientation
      if (linkObject.userData.updateText) {
        linkObject.userData.updateText(source, target, camera);
      }
    }
  } catch (e) {
    console.warn("Erreur lors de la mise à jour de la position du lien:", e);
  }
};

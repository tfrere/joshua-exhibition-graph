import * as THREE from "three";
import { Node } from "../types/graph";

/**
 * Palette de couleurs pour les différents types de nœuds
 */
export const COLORS = {
  source: "#4ecdc4",
  joshua: "#ff6b6b",
  character: "#fab1a0",
  contact: "#74b9ff",
  background: "#000119",
  centralJoshua: "#ff0000", // Couleur pour le nœud central Joshua
};

/**
 * Crée un objet THREE.js personnalisé pour représenter un nœud dans le graphe
 * @param node - Le nœud à représenter visuellement
 * @returns Un groupe THREE.js contenant la forme 3D et le texte du nœud
 */
export const createNodeObject = (node: Node) => {
  const group = new THREE.Group();

  let geometry;
  let material;
  let mesh;

  if (node.type === "source") {
    geometry = new THREE.PlaneGeometry(15, 15);

    // Création d'un matériau avec texture pour les sources
    console.log("node.name", node.name);
    if (node.name) {
      // Création d'un loader de texture
      const textureLoader = new THREE.TextureLoader();

      // Matériau temporaire pendant le chargement
      material = new THREE.MeshBasicMaterial({
        color: COLORS.source,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      });

      // Chargement de l'image basée sur node.name
      textureLoader.load(
        // URL de l'image principale
        `/img/platforms/${node.name}.png`,

        // Callback de succès
        (texture) => {
          console.log(`Texture chargée pour ${node.name}`);
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;

          // Mettre à jour le matériau avec la texture chargée
          material.map = texture;
          material.needsUpdate = true;
          material.color.set(0xffffff); // Blanc pour ne pas affecter la couleur de l'image
        },

        // Callback de progression (optionnel)
        undefined,

        // Callback d'erreur - charger l'image par défaut
        (error) => {
          console.error(
            `Erreur de chargement pour ${node.name}, utilisation de _notfound.png`
          );

          // Charger l'image par défaut
          textureLoader.load(
            `/img/platforms/_notfound.png`,
            (defaultTexture) => {
              defaultTexture.minFilter = THREE.LinearFilter;
              defaultTexture.magFilter = THREE.LinearFilter;

              // Mettre à jour le matériau avec la texture par défaut
              material.map = defaultTexture;
              material.needsUpdate = true;
              material.color.set(0xffffff);
            },
            undefined,
            (defaultError) => {
              console.error(
                "Impossible de charger l'image par défaut _notfound.png"
              );
            }
          );
        }
      );
    } else {
      // Fallback si node.name n'est pas défini
      material = new THREE.MeshPhongMaterial({
        color: COLORS.source,
        opacity: 0.9,
        transparent: true,
        emissive: COLORS.source,
        emissiveIntensity: 0.3,
        side: THREE.DoubleSide,
      });
    }

    mesh = new THREE.Mesh(geometry, material);

    // Configuration pour que le plan soit toujours orienté face à la caméra
    mesh.onBeforeRender = function (
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      camera: THREE.Camera
    ) {
      mesh.quaternion.copy(camera.quaternion);
    };
  } else if (node.id === "central-joshua") {
    geometry = new THREE.IcosahedronGeometry(10); // Forme spéciale pour le nœud central
    material = new THREE.MeshPhongMaterial({
      color: COLORS.centralJoshua,
      opacity: 0.9,
      transparent: true,
      emissive: COLORS.centralJoshua,
      emissiveIntensity: 0.6,
    });
    mesh = new THREE.Mesh(geometry, material);
  } else {
    const isJoshuaNode = node.type === "character" && node.isJoshua === true;
    geometry = isJoshuaNode
      ? new THREE.BoxGeometry(8, 8, 8)
      : new THREE.SphereGeometry(node.type === "character" ? 5 : 3);

    material = new THREE.MeshPhongMaterial({
      color:
        node.type === "character"
          ? node.isJoshua
            ? COLORS.joshua
            : COLORS.character
          : COLORS.contact,
      opacity: 0.9,
      transparent: true,
      emissive:
        node.type === "character"
          ? node.isJoshua
            ? COLORS.joshua
            : COLORS.character
          : COLORS.contact,
      emissiveIntensity: node.isJoshua ? 0.4 : 0.3,
    });
    mesh = new THREE.Mesh(geometry, material);
  }

  group.add(mesh);

  const textGeometry = new THREE.PlaneGeometry(1, 1);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context) {
    canvas.width = 256;
    canvas.height = 64;
    context.fillStyle = "rgba(0,0,0,0)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font =
      node.type === "source" ? "bold 20px Arial" : "bold 24px Arial";
    context.textAlign = "center";
    context.fillStyle = "#FFFFFF";
    context.fillText(node.name, canvas.width / 2, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    });

    const text = new THREE.Mesh(textGeometry, textMaterial);
    text.scale.set(20, 5, 1);
    const textHeight =
      node.id === "central-joshua"
        ? 12
        : node.type === "source"
        ? 6
        : node.type === "character" && node.isJoshua === true
        ? 6
        : 8;
    text.position.set(0, textHeight, 0);
    text.renderOrder = 1;

    text.onBeforeRender = function (
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      camera: THREE.Camera
    ) {
      text.quaternion.copy(camera.quaternion);
    };

    group.add(text);
  }

  return group;
};

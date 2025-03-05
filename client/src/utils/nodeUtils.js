import * as THREE from "three";

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
 * @param {Object} node - Le nœud à représenter visuellement
 * @returns {THREE.Group} Un groupe THREE.js contenant la forme 3D et le texte du nœud
 */
export const createNodeObject = (node) => {
  const group = new THREE.Group();

  let geometry;
  let material;
  let mesh;

  if (node.type === "source") {
    geometry = new THREE.PlaneGeometry(15, 15);

    // Utiliser directement un matériau de couleur unie
    material = new THREE.MeshPhongMaterial({
      color: COLORS.source,
      opacity: 0.9,
      transparent: true,
      emissive: COLORS.source,
      emissiveIntensity: 0.3,
      side: THREE.DoubleSide,
    });

    mesh = new THREE.Mesh(geometry, material);

    // Essayer de charger une texture si node.name existe, mais sans bloquer le graphe
    if (node.name) {
      try {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
          `/img/platforms/platform-${node.name}.png`,
          (texture) => {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            // Remplacer le matériau existant par un matériau avec texture
            const texturedMaterial = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              opacity: 0.9,
              side: THREE.DoubleSide,
            });

            // Mettre à jour le mesh avec le nouveau matériau
            mesh.material.dispose();
            mesh.material = texturedMaterial;
          },
          undefined, // Progression
          () => {
            // Silencieusement échouer, garder le matériau de couleur unie
            // console.log(`Image non trouvée pour ${node.name}, utilisation de la couleur par défaut`);
          }
        );
      } catch (e) {
        // Ignorer les erreurs de chargement
      }
    }

    // Configuration pour que le plan soit toujours orienté face à la caméra
    mesh.onBeforeRender = function (renderer, scene, camera) {
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
  } else if (node.type === "character") {
    // Pour les personnages, utiliser une géométrie 3D de base
    const isJoshua = node.isJoshua === true;

    if (isJoshua) {
      geometry = new THREE.BoxGeometry(8, 8, 8);
    } else {
      geometry = new THREE.SphereGeometry(5);
    }

    material = new THREE.MeshPhongMaterial({
      color: isJoshua ? COLORS.joshua : COLORS.character,
      opacity: 0.9,
      transparent: true,
      emissive: isJoshua ? COLORS.joshua : COLORS.character,
      emissiveIntensity: isJoshua ? 0.4 : 0.3,
    });

    mesh = new THREE.Mesh(geometry, material);

    // Essayer de charger une texture pour le personnage si node.slug existe
    if (node.slug) {
      try {
        geometry = new THREE.PlaneGeometry(10, 10);
        const tempMesh = new THREE.Mesh(geometry, material);

        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
          `/img/characters/character-${node.slug}.png`,
          (texture) => {
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;

            // Créer un nouveau matériau avec la texture
            const texturedMaterial = new THREE.MeshBasicMaterial({
              map: texture,
              transparent: true,
              opacity: 0.9,
              side: THREE.DoubleSide,
            });

            // Remplacer le mesh existant
            group.remove(mesh);
            tempMesh.material = texturedMaterial;
            tempMesh.onBeforeRender = function (renderer, scene, camera) {
              tempMesh.quaternion.copy(camera.quaternion);
            };
            group.add(tempMesh);
            mesh = tempMesh;
          },
          undefined,
          () => {
            // Silencieusement échouer, garder le mesh 3D original
          }
        );
      } catch (e) {
        // Ignorer les erreurs de chargement
      }
    }
  } else {
    // Pour les autres types de nœuds (contact, etc.)
    geometry = new THREE.SphereGeometry(3);

    material = new THREE.MeshPhongMaterial({
      color: COLORS.contact,
      opacity: 0.9,
      transparent: true,
      emissive: COLORS.contact,
      emissiveIntensity: 0.3,
    });
    mesh = new THREE.Mesh(geometry, material);
  }

  group.add(mesh);

  // Create text mesh for displaying coordinates
  const textGeometry = new THREE.PlaneGeometry(1, 1);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context) {
    canvas.width = 256;
    canvas.height = 90; // Augmenté pour accommoder le nom + coordonnées
    context.fillStyle = "rgba(0,0,0,0)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font =
      node.type === "source" ? "bold 20px Arial" : "bold 24px Arial";
    context.textAlign = "center";
    context.fillStyle = "#FFFFFF";

    // Initial placeholder text (will be updated in render loop)
    context.fillText(node.name || "Sans nom", canvas.width / 2, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    });

    const text = new THREE.Mesh(textGeometry, textMaterial);
    text.scale.set(20, 7, 1); // Augmenté la hauteur pour accommoder plus de texte
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

    // Store canvas and context in user data for updates
    text.userData = {
      canvas,
      context,
      texture,
      lastUpdate: 0,
      nodeId: node.id,
      nodeName: node.name || "Sans nom",
    };

    // Optimiser les mises à jour du texte - limiter à 5 FPS
    const updateInterval = 200; // ms

    // Update text to show coordinates on each render
    text.onBeforeRender = function (renderer, scene, camera) {
      // Make text face camera
      text.quaternion.copy(camera.quaternion);

      // Limiter les mises à jour pour améliorer les performances
      const now = Date.now();
      if (now - text.userData.lastUpdate > updateInterval) {
        text.userData.lastUpdate = now;

        try {
          // Get parent position (node position)
          const position = group.position;

          // Clear canvas
          const ctx = text.userData.context;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "rgba(0,0,0,0)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw node name at the top
          ctx.font =
            node.type === "source" ? "bold 20px Arial" : "bold 18px Arial";
          ctx.textAlign = "center";
          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(text.userData.nodeName, canvas.width / 2, 25);

          // Draw coordinates below the name
          ctx.font = "bold 16px Arial";

          // Format coordinates with 2 decimal places
          ctx.fillText(`X: ${position.x.toFixed(1)}`, canvas.width / 2, 45);
          ctx.fillText(`Y: ${position.y.toFixed(1)}`, canvas.width / 2, 65);
          ctx.fillText(`Z: ${position.z.toFixed(1)}`, canvas.width / 2, 85);

          // Update texture
          text.userData.texture.needsUpdate = true;
        } catch (e) {
          // Ignorer les erreurs potentielles
        }
      }
    };

    group.add(text);
  }

  return group;
};

/**
 * Crée un objet THREE.js pour représenter un lien entre deux nœuds
 * @param {Object} link - Les données du lien
 * @param {THREE.Vector3} source - Position du nœud source
 * @param {THREE.Vector3} target - Position du nœud cible
 * @returns {THREE.Line} Un objet THREE.js Line représentant le lien
 */
export const createLinkObject = (link, source, target) => {
  // Création de la géométrie du lien (une ligne entre deux points)
  const geometry = new THREE.BufferGeometry();

  // Définir les positions des points de la ligne
  const positions = new Float32Array([
    source.x,
    source.y,
    source.z,
    target.x,
    target.y,
    target.z,
  ]);

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // Créer un matériau pour la ligne
  const material = new THREE.LineBasicMaterial({
    color: 0xaaaaaa,
    transparent: true,
    opacity: 0.5,
    linewidth: 1,
  });

  // Créer la ligne
  const line = new THREE.Line(geometry, material);

  // Si le lien a une valeur, on peut l'utiliser pour moduler l'opacité
  if (link.value) {
    material.opacity = Math.min(0.2 + link.value * 0.5, 0.8); // Moduler l'opacité en fonction de la valeur
  }

  return line;
};

/**
 * Met à jour la position d'un lien entre deux nœuds
 * @param {THREE.Line} linkObject - L'objet THREE.js Line à mettre à jour
 * @param {THREE.Vector3} source - Nouvelle position du nœud source
 * @param {THREE.Vector3} target - Nouvelle position du nœud cible
 */
export const updateLinkPosition = (linkObject, source, target) => {
  try {
    // Récupérer la géométrie de la ligne
    const positions = linkObject.geometry.attributes.position.array;

    // Mettre à jour les positions
    positions[0] = source.x;
    positions[1] = source.y;
    positions[2] = source.z;
    positions[3] = target.x;
    positions[4] = target.y;
    positions[5] = target.z;

    // Indiquer que les positions ont été mises à jour
    linkObject.geometry.attributes.position.needsUpdate = true;
  } catch (e) {
    // Ignorer les erreurs potentielles
  }
};

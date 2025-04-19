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
    geometry = new THREE.SphereGeometry(5); // Forme spéciale pour le nœud central
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
      emissiveIntensity: 0,
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
        ? 8
        : node.type === "character" && node.isJoshua === true
        ? 3
        : 3;
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

          // // Format coordinates with 2 decimal places
          // ctx.fillText(`X: ${position.x.toFixed(1)}`, canvas.width / 2, 45);
          // ctx.fillText(`Y: ${position.y.toFixed(1)}`, canvas.width / 2, 65);
          // ctx.fillText(`Z: ${position.z.toFixed(1)}`, canvas.width / 2, 85);

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
 * @returns {THREE.Object3D} Un objet THREE.js représentant le lien
 */
export const createLinkObject = (link, source, target) => {
  // Création d'un groupe pour contenir le lien
  const group = new THREE.Group();

  // Initialiser la géométrie avec des positions temporaires
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array([
    source.x,
    source.y,
    source.z,
    target.x,
    target.y,
    target.z,
  ]);
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  // Pour les liens simples, utiliser une ligne basique
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xaaaaaa,
    transparent: false,
    opacity: 1,
    linewidth: 10,
  });

  // Créer la ligne de base (toujours présente comme repère visuel)
  const line = new THREE.Line(geometry, lineMaterial);
  group.add(line);

  // Stocker une référence à la ligne dans le groupe pour les mises à jour
  group.userData = {
    line: line,
    positions: positions,
  };

  // Pour les liens Joshua ou certains types spécifiques, ajouter une texture sur un mesh
  if (
    link.type === "joshua-connection" ||
    link._relationType === "Joshua Identity" ||
    link.value > 1.5
  ) {
    // Création d'un plan pour la texture
    const planeGeometry = new THREE.PlaneGeometry(1, 1);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff5555,
      transparent: true,
      opacity: 1,
      side: THREE.FrontSide, // Seulement visible du côté avant
      depthWrite: false,
    });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    group.add(plane);

    // Stocker une référence au plan dans le groupe
    group.userData.plane = plane;

    // Essayer de charger une texture si disponible
    try {
      const textureLoader = new THREE.TextureLoader();
      const texturePath =
        link.type === "joshua-connection"
          ? "/img/links/joshua-link.png"
          : "/img/links/strong-link.png";

      textureLoader.load(
        texturePath,
        (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;

          // Mettre à jour le matériau avec la texture
          planeMaterial.map = texture;
          planeMaterial.needsUpdate = true;
        },
        undefined,
        (error) => {
          console.warn("Impossible de charger la texture pour le lien:", error);
        }
      );
    } catch (e) {
      console.warn("Erreur lors du chargement de la texture:", e);
    }

    // Fonction pour mettre à jour la position et l'orientation du plan
    group.userData.updatePlane = (source, target) => {
      // Calculer le vecteur direction entre source et target
      const direction = new THREE.Vector3()
        .subVectors(target, source)
        .normalize();

      // Positionner le plan au milieu du lien
      const mid = new THREE.Vector3()
        .addVectors(source, target)
        .multiplyScalar(0.5);
      plane.position.copy(mid);

      // Calculer la longueur du lien
      const length = new THREE.Vector3().subVectors(target, source).length();

      // Redimensionner le plan pour qu'il s'adapte à la longueur du lien
      plane.scale.set(length * 0.8, length * 0.2, 1);

      // Orienter le plan le long du lien
      plane.lookAt(target);
    };

    // Initialiser la position et l'orientation du plan
    group.userData.updatePlane(
      new THREE.Vector3(source.x, source.y, source.z),
      new THREE.Vector3(target.x, target.y, target.z)
    );
  }

  return group;
};

/**
 * Met à jour la position d'un lien entre deux nœuds
 * @param {THREE.Object3D} linkObject - L'objet THREE.js à mettre à jour
 * @param {THREE.Vector3} source - Nouvelle position du nœud source
 * @param {THREE.Vector3} target - Nouvelle position du nœud cible
 */
export const updateLinkPosition = (linkObject, source, target) => {
  try {
    console.log("updateLinkPosition - source:", source, "target:", target);

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

    // Si l'objet linkObject contient une référence à l'instance Link, l'utiliser
    if (linkObject.userData && linkObject.userData.link) {
      const linkInstance = linkObject.userData.link;

      // Mettre à jour les positions de l'instance Link
      linkInstance.source = source;
      linkInstance.target = target;

      // Appeler la méthode updatePosition de l'instance
      linkInstance.updatePosition(source, target);
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
    }
  } catch (e) {
    console.warn("Erreur lors de la mise à jour de la position du lien:", e);
  }
};

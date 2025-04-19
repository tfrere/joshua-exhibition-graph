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
  centralJoshua: "#FF6700",
  fbi: "#FFD700",
};

/**
 * Crée un objet THREE.js personnalisé pour représenter un nœud dans le graphe
 */
export class Node {
  constructor(node) {
    this.node = node;
    this.group = new THREE.Group();
    this.createMesh();
    this.createLabel();
  }

  loadSvgTexture(svgPath, mesh, fallbackSvg = "default.svg") {
    try {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        `/img/${svgPath}`,
        (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;

          const texturedMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
            depthWrite: false,
          });

          if (mesh.material) {
            mesh.material.dispose();
          }
          mesh.material = texturedMaterial;
        },
        undefined,
        () => {
          // Si le chargement échoue, essayer avec le SVG par défaut
          if (svgPath !== fallbackSvg) {
            this.loadSvgTexture(fallbackSvg, mesh);
          }
        }
      );
    } catch (e) {
      // Si une erreur se produit, essayer avec le SVG par défaut
      if (svgPath !== fallbackSvg) {
        this.loadSvgTexture(fallbackSvg, mesh);
      }
    }
  }

  createMesh() {
    if (this.node.id === "central_joshua") {
      this.createCentralJoshuaMesh();
    } else if (this.node.type === "source" || this.node.type === "platform") {
      this.createSourceMesh();
    } else if (this.node.type === "character") {
      this.createCharacterMesh();
    } else {
      this.createDefaultMesh();
    }
  }

  createCentralJoshuaMesh() {
    const geometry = new THREE.PlaneGeometry(20, 20);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    this.group.add(mesh);

    this.loadSvgTexture("joshua-goldberg.svg", mesh);

    mesh.onBeforeRender = (renderer, scene, camera) => {
      mesh.quaternion.copy(camera.quaternion);
    };
  }

  createSourceMesh() {
    const geometry = new THREE.PlaneGeometry(20, 20);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    this.group.add(mesh);

    // Essayer de charger le SVG spécifique à la plateforme
    if (this.node.name) {
      // Enlever le préfixe "platform_" si présent dans l'ID
      let platformName = this.node.name.toLowerCase();

      if (this.node.id && this.node.id.startsWith("platform_")) {
        platformName = this.node.id.replace("platform_", "").split("_")[0];
      }

      // Nettoyer le nom de la plateforme
      platformName = platformName.replace(/\s+/g, "-");
      this.loadSvgTexture(`${platformName}.svg`, mesh, "default.svg");
    } else {
      this.loadSvgTexture("default.svg", mesh);
    }

    mesh.onBeforeRender = (renderer, scene, camera) => {
      mesh.quaternion.copy(camera.quaternion);
    };
  }

  createCharacterMesh() {
    // Taille standard pour tous les nœuds, sans distinction
    const geometry = new THREE.PlaneGeometry(20, 20);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    this.group.add(mesh);

    const isFBI =
      this.node.name?.toLowerCase().includes("fbi") ||
      this.node.id?.toLowerCase().includes("fbi");
    const isJoshua = this.node.isJoshua === true;

    if (isFBI) {
      this.loadSvgTexture("fbi.svg", mesh);
    } else if (!isJoshua) {
      this.loadSvgTexture("journalist.svg", mesh);
    } else {
      this.loadSvgTexture("character.svg", mesh);
    }

    mesh.onBeforeRender = (renderer, scene, camera) => {
      mesh.quaternion.copy(camera.quaternion);
    };
  }

  createDefaultMesh() {
    const geometry = new THREE.PlaneGeometry(20, 20);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    this.group.add(mesh);

    this.loadSvgTexture("default.svg", mesh);

    mesh.onBeforeRender = (renderer, scene, camera) => {
      mesh.quaternion.copy(camera.quaternion);
    };
  }

  createLabel() {
    const textGeometry = new THREE.PlaneGeometry(1, 1);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) return;

    canvas.width = 512;
    canvas.height = 400;

    const texture = new THREE.CanvasTexture(canvas);
    const textMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    });

    const text = new THREE.Mesh(textGeometry, textMaterial);

    // Ajuster la taille du plan en fonction de si c'est une origine de cluster
    if (this.node.isClusterOrigin) {
      // Pour les origines de cluster, agrandir la géométrie pour accommoder un texte plus grand
      text.scale.set(60, 42, 1); // 1.5x la taille normale (40*1.5, 28*1.5)
    } else {
      // Taille normale
      text.scale.set(40, 28, 1);
    }

    const textHeight = this.getTextHeight();
    text.position.set(0, textHeight, 0);
    text.renderOrder = 1;

    text.userData = {
      canvas,
      context,
      texture,
      lastUpdate: 0,
      nodeId: this.node.id,
      nodeName: this.node.name || this.node.id || "Sans nom",
    };

    this.setupLabelUpdates(text);
    this.group.add(text);
  }

  getTextHeight() {
    if (this.node.id === "central_joshua") return 16;
    if (this.node.type === "source") return 12;
    if (this.node.isClusterOrigin) return 15; // Positions plus haute pour les origines de cluster
    if (this.node.type === "character" && this.node.isJoshua === true) return 6;
    return 6;
  }

  setupLabelUpdates(text) {
    const updateInterval = 200; // ms

    text.onBeforeRender = (renderer, scene, camera) => {
      text.quaternion.copy(camera.quaternion);

      const now = Date.now();
      if (now - text.userData.lastUpdate > updateInterval) {
        text.userData.lastUpdate = now;
        this.updateLabel(text);
      }
    };
  }

  updateLabel(text) {
    try {
      const { canvas, context, texture } = text.userData;

      // Pour les origines de cluster, utiliser un canvas plus grand
      if (this.node.isClusterOrigin && canvas.width < 768) {
        canvas.width = 768; // 1.5x de la taille standard (512*1.5)
        canvas.height = 600; // 1.5x de la taille standard (400*1.5)
      }

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(0,0,0,0)";
      context.fillRect(0, 0, canvas.width, canvas.height);

      // Set font based on node type
      context.font = this.getLabelFont();
      context.textAlign = "center";
      context.fillStyle = "#FFFFFF";

      // Positionner le texte en fonction de la taille du canvas
      const yPosition = this.node.isClusterOrigin ? 100 : 100;

      // Draw node name
      context.fillText(text.userData.nodeName, canvas.width / 2, yPosition);

      texture.needsUpdate = true;
    } catch (e) {
      console.error("Erreur lors de la mise à jour du label:", e);
    }
  }

  getLabelFont() {
    // Si le nœud est marqué comme origine de cluster, augmenter sa taille de texte par 1.5
    if (this.node.isClusterOrigin) {
      if (this.node.type === "character") {
        // Pour les personnages, la taille de base est déjà basée sur textSize
        return `bold ${Math.round(
          48 * 1.5 * (this.node.textSize || 1)
        )}px Arial`;
      } else {
        // Pour les autres types, multiplier simplement la taille par 1.5
        return "bold 72px Arial"; // 48 * 1.5
      }
    }

    // Comportement par défaut pour les nœuds non-origines
    if (this.node.type === "source") {
      return "bold 48px Arial";
    }
    if (this.node.type === "character") {
      return `bold ${Math.round(48 * (this.node.textSize || 1))}px Arial`;
    }
    return "bold 48px Arial";
  }

  getMesh() {
    return this.group;
  }
}

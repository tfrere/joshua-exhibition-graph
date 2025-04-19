import * as THREE from "three";

/**
 * Classe représentant un lien entre deux nœuds dans le graphe
 */
export class Link {
  constructor(link, source, target) {
    this.link = link;
    this.source = source;
    this.target = target;
    this.group = new THREE.Group();
    this.offsetDistance = 7.5; // Augmentation de la distance d'offset pour une meilleure visibilité
    this.arrowSize = 2.0; // Taille de la flèche réduite
    this.arrowAngle = Math.PI / 4; // Angle de 45 degrés pour les branches de la flèche
    this.linkRadius = 0.1; // Rayon du tube représentant le lien
    this.createMesh();
  }

  createMesh() {
    // Vérifier que les positions des nœuds sont correctes
    this.ensureNodePositions();

    // Calculer les positions avec offset
    const { startPoint, endPoint } = this.calculateOffsetPoints(
      new THREE.Vector3(this.source.x, this.source.y, this.source.z),
      new THREE.Vector3(this.target.x, this.target.y, this.target.z)
    );

    // Créer un tube pour le lien au lieu d'une simple ligne
    const path = new THREE.LineCurve3(startPoint, endPoint);
    const tubeGeometry = new THREE.TubeGeometry(
      path,
      1,
      this.linkRadius,
      8,
      false
    );

    const tubeMaterial = new THREE.MeshBasicMaterial({
      color: 0xaaaaaa,
      transparent: true,
      opacity: 0.8,
      depthTest: true, // Activer le test de profondeur pour les liens
    });

    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    this.group.add(tube);

    // Stocker les références pour les mises à jour
    this.group.userData = {
      tube,
      startPoint: startPoint.clone(),
      endPoint: endPoint.clone(),
      link: this, // Stocker une référence à cette instance
    };

    // Ajouter une texture si c'est un lien spécial
    if (this.isSpecialLink()) {
      this.addTexturePlane();
    }

    // Ajouter une flèche au bout du lien (en blanc)
    this.addArrow(startPoint, endPoint, 0xffffff);

    // Ajouter le texte du type de relation s'il existe
    if (this.link.relationType || this.link._relationType) {
      this.addRelationText(startPoint, endPoint);
    }
  }

  // S'assure que les nœuds source et cible ont des coordonnées valides
  ensureNodePositions() {
    // Vérifier si les positions sont des nombres valides
    const validateCoord = (coord) => typeof coord === "number" && !isNaN(coord);

    // Si source.x n'est pas un nombre valide mais source est un objet avec x
    if (
      !validateCoord(this.source.x) &&
      typeof this.source === "object" &&
      validateCoord(this.source.fx)
    ) {
      this.source.x = this.source.fx;
      this.source.y = this.source.fy;
      this.source.z = this.source.fz || 0;
    }

    // Si target.x n'est pas un nombre valide mais target est un objet avec x
    if (
      !validateCoord(this.target.x) &&
      typeof this.target === "object" &&
      validateCoord(this.target.fx)
    ) {
      this.target.x = this.target.fx;
      this.target.y = this.target.fy;
      this.target.z = this.target.fz || 0;
    }

    // Utiliser des valeurs par défaut si toujours pas valides
    if (!validateCoord(this.source.x)) {
      console.warn(
        "Source node position is invalid, using default position",
        this.source
      );
      this.source.x = 0;
      this.source.y = 0;
      this.source.z = 0;
    }

    if (!validateCoord(this.target.x)) {
      console.warn(
        "Target node position is invalid, using default position",
        this.target
      );
      this.target.x = 10;
      this.target.y = 10;
      this.target.z = 10;
    }
  }

  // Calcule les points de début et de fin avec offset
  calculateOffsetPoints(sourcePoint, targetPoint) {
    // Calculer la direction du vecteur
    const direction = new THREE.Vector3()
      .subVectors(targetPoint, sourcePoint)
      .normalize();

    // Calculer les points avec offset
    const startPoint = new THREE.Vector3()
      .copy(sourcePoint)
      .addScaledVector(direction, this.offsetDistance);

    const endPoint = new THREE.Vector3()
      .copy(targetPoint)
      .addScaledVector(direction, -this.offsetDistance);

    return { startPoint, endPoint };
  }

  isSpecialLink() {
    return (
      this.link.type === "joshua-connection" ||
      this.link._relationType === "Joshua Identity" ||
      this.link.value > 1.5
    );
  }

  // Ajoute le texte du type de relation au lien
  addRelationText(startPoint, endPoint) {
    try {
      // Déterminer le texte à afficher (relationType ou _relationType)
      const relationText =
        this.link.relationType || this.link._relationType || "";
      if (!relationText) return;

      // Créer un canvas pour le texte
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = 256;
      canvas.height = 64;

      // Configurer le style du texte
      context.font = "bold 24px Arial";

      // Calculer la largeur du texte pour ajuster le fond
      const textMetrics = context.measureText(relationText);
      const textWidth = textMetrics.width;

      // Dessiner un fond semi-transparent arrondi
      context.fillStyle = "rgba(0, 0, 0, 0.6)";

      // Utiliser une méthode compatible avec tous les navigateurs pour dessiner un rectangle arrondi
      const rectX = (canvas.width - textWidth - 20) / 2;
      const rectY = 10;
      const rectWidth = textWidth + 20;
      const rectHeight = 44;
      const radius = 8;

      // Fonction de dessin d'un rectangle arrondi compatible
      context.beginPath();
      context.moveTo(rectX + radius, rectY);
      context.lineTo(rectX + rectWidth - radius, rectY);
      context.quadraticCurveTo(
        rectX + rectWidth,
        rectY,
        rectX + rectWidth,
        rectY + radius
      );
      context.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
      context.quadraticCurveTo(
        rectX + rectWidth,
        rectY + rectHeight,
        rectX + rectWidth - radius,
        rectY + rectHeight
      );
      context.lineTo(rectX + radius, rectY + rectHeight);
      context.quadraticCurveTo(
        rectX,
        rectY + rectHeight,
        rectX,
        rectY + rectHeight - radius
      );
      context.lineTo(rectX, rectY + radius);
      context.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
      context.closePath();
      context.fill();

      // Dessiner le texte sur ce fond
      context.fillStyle = "#FFFFFF";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(relationText, canvas.width / 2, canvas.height / 2);

      // Créer une texture à partir du canvas
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      // Créer le matériau pour le plan de texte
      const textMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      // Créer un plan pour afficher le texte avec une taille plus appropriée
      const linkLength = startPoint.distanceTo(endPoint);
      const textWidth3D = Math.min(linkLength * 0.6, 10); // Limiter la largeur à 60% de la longueur du lien, max 10 unités
      const textHeight3D = textWidth3D * (canvas.height / canvas.width); // Conserver le ratio

      const textGeometry = new THREE.PlaneGeometry(textWidth3D, textHeight3D);
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);

      // Positionner le texte au milieu du lien
      const midPoint = new THREE.Vector3()
        .addVectors(startPoint, endPoint)
        .multiplyScalar(0.5);
      textMesh.position.copy(midPoint);

      // Faire en sorte que le texte regarde toujours la caméra tout en étant aligné avec le lien
      const textContainer = new THREE.Group();
      textContainer.add(textMesh);
      this.group.add(textContainer);

      // Soulever légèrement le texte au-dessus du lien pour mieux le distinguer
      textContainer.translateY(0.5);

      // Stocker les références pour la mise à jour
      this.group.userData.textContainer = textContainer;
      this.group.userData.textMesh = textMesh;
      this.group.userData.relationText = relationText;

      // Configurer la fonction de mise à jour pour le texte
      this.setupTextUpdates(textContainer, textMesh);
    } catch (e) {
      console.warn("Erreur lors de la création du texte de relation:", e);
    }
  }

  // Configure les mises à jour du texte de relation
  setupTextUpdates(textContainer, textMesh) {
    this.group.userData.updateText = (source, target, camera) => {
      try {
        if (!textContainer || !textMesh) return;

        // Calculer les points avec offset
        const { startPoint, endPoint } = this.calculateOffsetPoints(
          source,
          target
        );

        // Positionner le texte au milieu du lien
        const midPoint = new THREE.Vector3()
          .addVectors(startPoint, endPoint)
          .multiplyScalar(0.5);
        textContainer.position.copy(midPoint);

        // Déterminer l'orientation du lien
        const linkDirection = new THREE.Vector3()
          .subVectors(endPoint, startPoint)
          .normalize();

        // Calculer la rotation pour que le plan soit parallèle au lien
        // mais que le texte soit toujours face à la caméra
        if (camera) {
          // Faire en sorte que le texte soit toujours face à la caméra
          textContainer.lookAt(camera.position);

          // Mais aussi aligné avec la direction du lien
          // Nous calculons l'angle entre la direction du lien et l'axe X du monde
          const angle = Math.atan2(linkDirection.z, linkDirection.x);
          textContainer.rotation.y = angle;
        }
      } catch (e) {
        console.warn("Erreur lors de la mise à jour du texte de relation:", e);
      }
    };
  }

  addTexturePlane() {
    const planeGeometry = new THREE.PlaneGeometry(1, 1);
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff5555,
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    this.group.add(plane);
    this.group.userData.plane = plane;

    // Charger la texture appropriée
    this.loadTexture(planeMaterial);

    // Configurer la mise à jour du plan
    this.setupPlaneUpdates(plane);
  }

  loadTexture(material) {
    try {
      const textureLoader = new THREE.TextureLoader();
      const texturePath =
        this.link.type === "joshua-connection"
          ? "/img/links/joshua-link.png"
          : "/img/links/strong-link.png";

      textureLoader.load(
        texturePath,
        (texture) => {
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          material.map = texture;
          material.needsUpdate = true;
        },
        undefined,
        (error) => {
          console.warn("Impossible de charger la texture pour le lien:", error);
        }
      );
    } catch (e) {
      console.warn("Erreur lors du chargement de la texture:", e);
    }
  }

  setupPlaneUpdates(plane) {
    this.group.userData.updatePlane = (source, target) => {
      // Calculer les points avec offset
      const { startPoint, endPoint } = this.calculateOffsetPoints(
        source,
        target
      );

      const direction = new THREE.Vector3()
        .subVectors(endPoint, startPoint)
        .normalize();

      const mid = new THREE.Vector3()
        .addVectors(startPoint, endPoint)
        .multiplyScalar(0.5);
      plane.position.copy(mid);

      const length = new THREE.Vector3()
        .subVectors(endPoint, startPoint)
        .length();
      plane.scale.set(length * 0.8, length * 0.2, 1);
      plane.lookAt(endPoint);
    };

    // Position initiale
    this.group.userData.updatePlane(
      new THREE.Vector3(this.source.x, this.source.y, this.source.z),
      new THREE.Vector3(this.target.x, this.target.y, this.target.z)
    );
  }

  // Ajoute une flèche au bout du lien
  addArrow(startPoint, endPoint, color) {
    // Direction du lien
    const direction = new THREE.Vector3()
      .subVectors(endPoint, startPoint)
      .normalize();

    // On commence par trouver un vecteur perpendiculaire
    const up = new THREE.Vector3(0, 1, 0);
    const perpendicular = new THREE.Vector3()
      .crossVectors(direction, up)
      .normalize();

    // Si le lien est presque vertical, utiliser un autre vecteur de référence
    if (perpendicular.length() < 0.1) {
      perpendicular.set(1, 0, 0);
    }

    // Utiliser des LineSegments2 pour les flèches qui sont visibles sous tous les angles
    // Importation dynamique de la bibliothèque de lignes épaisses
    try {
      // Créer une simple approche alternative avec deux MeshLine
      // Au lieu d'utiliser LineSegments qui peut disparaître sous certains angles

      // Première branche de la flèche
      const branch1Dir = new THREE.Vector3().copy(direction).negate();
      branch1Dir.applyAxisAngle(perpendicular, this.arrowAngle);

      const branch1End = new THREE.Vector3()
        .copy(endPoint)
        .addScaledVector(branch1Dir, this.arrowSize);

      // Deuxième branche de la flèche
      const branch2Dir = new THREE.Vector3().copy(direction).negate();
      branch2Dir.applyAxisAngle(perpendicular, -this.arrowAngle);

      const branch2End = new THREE.Vector3()
        .copy(endPoint)
        .addScaledVector(branch2Dir, this.arrowSize);

      // Créer des cylindres fins au lieu de lignes pour les branches
      const cylinderGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 6);

      // Pour que le cylindre soit aligné correctement, nous devons le faire pointer le long de l'axe Y
      cylinderGeometry.rotateX(Math.PI / 2);

      const cylinderMaterial = new THREE.MeshBasicMaterial({
        color: color,
        flatShading: true,
      });

      // Créer le groupe pour contenir les branches
      const arrowGroup = new THREE.Group();

      // Première branche
      const branch1Cylinder = new THREE.Mesh(
        cylinderGeometry,
        cylinderMaterial
      );
      // Positionner le cylindre au milieu entre endPoint et branch1End
      branch1Cylinder.position.copy(
        endPoint.clone().add(branch1End).multiplyScalar(0.5)
      );
      // Orienter le cylindre selon la direction de branch1Dir
      branch1Cylinder.lookAt(branch1End);
      // Mettre à l'échelle le cylindre pour qu'il ait la bonne longueur
      const distance1 = endPoint.distanceTo(branch1End);
      branch1Cylinder.scale.set(1, 1, distance1);
      arrowGroup.add(branch1Cylinder);

      // Deuxième branche
      const branch2Cylinder = new THREE.Mesh(
        cylinderGeometry,
        cylinderMaterial
      );
      // Positionner le cylindre au milieu entre endPoint et branch2End
      branch2Cylinder.position.copy(
        endPoint.clone().add(branch2End).multiplyScalar(0.5)
      );
      // Orienter le cylindre selon la direction de branch2Dir
      branch2Cylinder.lookAt(branch2End);
      // Mettre à l'échelle le cylindre pour qu'il ait la bonne longueur
      const distance2 = endPoint.distanceTo(branch2End);
      branch2Cylinder.scale.set(1, 1, distance2);
      arrowGroup.add(branch2Cylinder);

      // Ajouter le groupe de flèches au groupe principal
      this.group.add(arrowGroup);

      // Stocker les références pour la mise à jour
      this.group.userData.arrowGroup = arrowGroup;
      this.group.userData.branch1Cylinder = branch1Cylinder;
      this.group.userData.branch2Cylinder = branch2Cylinder;
    } catch (e) {
      console.warn("Erreur lors de la création des flèches:", e);
    }
  }

  updatePosition(source, target, camera) {
    try {
      // Mettre à jour les positions source et target
      this.source = source;
      this.target = target;

      // Calculer les points avec offset
      const { startPoint, endPoint } = this.calculateOffsetPoints(
        source,
        target
      );

      // Mettre à jour le tube (lien)
      if (this.group.userData.tube) {
        this.group.remove(this.group.userData.tube);

        const path = new THREE.LineCurve3(startPoint, endPoint);
        const tubeGeometry = new THREE.TubeGeometry(
          path,
          1,
          this.linkRadius,
          8,
          false
        );

        const tubeMaterial = new THREE.MeshBasicMaterial({
          color: 0xaaaaaa,
          transparent: true,
          opacity: 0.8,
          depthTest: true,
        });

        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        this.group.add(tube);
        this.group.userData.tube = tube;
      }

      // Mettre à jour les flèches (cylindres)
      if (
        this.group.userData.arrowGroup &&
        this.group.userData.branch1Cylinder &&
        this.group.userData.branch2Cylinder
      ) {
        // Direction du lien
        const direction = new THREE.Vector3()
          .subVectors(endPoint, startPoint)
          .normalize();

        // Trouver un vecteur perpendiculaire
        const up = new THREE.Vector3(0, 1, 0);
        const perpendicular = new THREE.Vector3()
          .crossVectors(direction, up)
          .normalize();

        // Si le lien est presque vertical, utiliser un autre vecteur de référence
        if (perpendicular.length() < 0.1) {
          perpendicular.set(1, 0, 0);
        }

        // Première branche de la flèche
        const branch1Dir = new THREE.Vector3().copy(direction).negate();
        branch1Dir.applyAxisAngle(perpendicular, this.arrowAngle);

        const branch1End = new THREE.Vector3()
          .copy(endPoint)
          .addScaledVector(branch1Dir, this.arrowSize);

        // Deuxième branche de la flèche
        const branch2Dir = new THREE.Vector3().copy(direction).negate();
        branch2Dir.applyAxisAngle(perpendicular, -this.arrowAngle);

        const branch2End = new THREE.Vector3()
          .copy(endPoint)
          .addScaledVector(branch2Dir, this.arrowSize);

        // Mise à jour de la première branche
        const branch1Cylinder = this.group.userData.branch1Cylinder;
        branch1Cylinder.position.copy(
          endPoint.clone().add(branch1End).multiplyScalar(0.5)
        );
        branch1Cylinder.lookAt(branch1End);
        const distance1 = endPoint.distanceTo(branch1End);
        branch1Cylinder.scale.set(1, 1, distance1);

        // Mise à jour de la deuxième branche
        const branch2Cylinder = this.group.userData.branch2Cylinder;
        branch2Cylinder.position.copy(
          endPoint.clone().add(branch2End).multiplyScalar(0.5)
        );
        branch2Cylinder.lookAt(branch2End);
        const distance2 = endPoint.distanceTo(branch2End);
        branch2Cylinder.scale.set(1, 1, distance1);
      }

      // Mettre à jour le plan de texture si présent
      if (this.group.userData.updatePlane) {
        this.group.userData.updatePlane(source, target);
      }

      // Mettre à jour le texte de relation si présent
      if (this.group.userData.updateText) {
        // Utiliser directement la caméra passée comme paramètre
        this.group.userData.updateText(source, target, camera);
      }
    } catch (e) {
      console.warn("Erreur lors de la mise à jour de la position du lien:", e);
    }
  }

  getMesh() {
    return this.group;
  }
}

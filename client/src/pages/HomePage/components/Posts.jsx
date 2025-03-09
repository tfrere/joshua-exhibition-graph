import { useRef, useMemo, useState, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { activePostRef, initSocketSync } from "./activePostRef";

// Type de données pour les posts (pour référence)
/**
 * @typedef {Object} Post
 * @property {string} id - ID unique du post
 * @property {number} postUID - UID unique du post
 * @property {string} slug - Slug du post
 * @property {string} content - Contenu du post
 *
 * Format 1: Coordonnées directement au niveau racine
 * @property {number} [x] - Position X
 * @property {number} [y] - Position Y
 * @property {number} [z] - Position Z
 *
 * Format 2: Coordonnées dans un objet imbriqué
 * @property {Object} [coordinates] - Coordonnées 3D du post
 * @property {number} [coordinates.x] - Position X
 * @property {number} [coordinates.y] - Position Y
 * @property {number} [coordinates.z] - Position Z
 *
 * @property {Array} color - Couleur RGB du post
 * @property {number} [impact] - Valeur d'impact du post (1-1000)
 * @property {boolean} [isJoshuaCharacter] - Indique si le post appartient à un personnage Joshua
 */

const SIZE = 1;
const ACTIVE_POST_SIZE = 35; // Taille du post actif - augmentée pour être plus visible
const MIN_IMPACT_SIZE = 3;
const MAX_IMPACT_SIZE = 8;
const USE_IMPACT_SIZE = true;
const ACTIVE_POST_COLOR = [1.0, 0, 0]; // Couleur rouge vif pour le post actif
const POST_ACTIVATION_DURATION = 1.0; // Durée de la transition en secondes
const PROXIMITY_THRESHOLD = 100.0; // Distance à partir de laquelle les points commencent à réduire (défaut: 100.0)
const MIN_DISTANCE = 10.0; // Distance à laquelle les points disparaissent complètement (défaut: 20.0)

// Constantes pour l'animation
const ANIMATION_AMPLITUDE = 1.5; // Amplitude maximale du mouvement en unités (réduite pour un effet plus subtil)
const ANIMATION_SPEED = 0.5; // Vitesse de l'animation
const EXPLOSION_DURATION = 3.0; // Durée de l'explosion initiale en secondes
const EXPLOSION_STAGGER = 0.2; // Décalage temporel entre les particules (0-1)
const EXPLOSION_PATH_VARIATION = 0.25; // Variation des trajectoires durant l'explosion (réduite pour moins de mouvement latéral)
const SIZE_VARIATION_FACTOR = 3.0; // Facteur de variation de la taille pendant l'explosion
const EXPLOSION_ARC_FACTOR = 0; // Facteur pour l'amplitude des arcs durant l'explosion
const IDLE_MOVEMENT_SPEED_VARIATION = 0.4; // Variation de la vitesse du mouvement permanent (0-1)
const IDLE_MOVEMENT_MAX_DISTANCE = 15; // Distance maximale (en unités) que les points peuvent s'éloigner de leur position d'origine
const TRANSITION_DURATION = 1.0; // Durée de la transition (en secondes) entre l'explosion et l'oscillation permanente

// Fonction d'easing cubique pour une sortie douce sans rebond
function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

// Fonction d'easing exponentielle pour un effet d'explosion plus dynamique
function easeOutExpo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

// Vertex shader qui utilise l'attribut size pour les points
const vertexShader = `
  attribute float size;
  varying vec3 vColor;
  
  uniform float proximityThreshold;
  uniform float minDistance;
  
  void main() {
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    // Distance from camera to point
    float distance = -mvPosition.z;
    
    // Calculate scale factor based on distance
    float scaleFactor = 1.0;
    
    if (distance < proximityThreshold) {
      // Calculate scale factor: 1.0 at threshold, 0.0 at minDistance
      scaleFactor = smoothstep(minDistance, proximityThreshold, distance);
    }
    
    // Apply scale factor to point size
    gl_PointSize = size * (300.0 / distance) * scaleFactor;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

// Fragment shader pour les points avec une texture circulaire
const fragmentShader = `
  uniform sampler2D pointTexture;
  varying vec3 vColor;
  
  void main() {
    gl_FragColor = vec4(vColor, 1.0) * texture2D(pointTexture, gl_PointCoord);
  }
`;

/**
 * Composant pour le rendu ultra-optimisé des posts
 * @param {Object} props - Propriétés du composant
 * @param {Array} props.data - Données des posts
 * @param {number} [props.proximityThreshold=100.0] - Distance à partir de laquelle les points commencent à réduire (défaut: 100.0)
 * @param {number} [props.minDistance=20.0] - Distance à laquelle les points disparaissent complètement (défaut: 20.0)
 * @param {number} [props.animationAmplitude=ANIMATION_AMPLITUDE] - Amplitude du mouvement aléatoire des points (défaut: 1.5)
 * @param {number} [props.animationSpeed=ANIMATION_SPEED] - Vitesse de l'animation des points (défaut: 0.5)
 * @param {number} [props.sizeVariationFactor=SIZE_VARIATION_FACTOR] - Facteur de variation de la taille des points pendant l'explosion (défaut: 3.0)
 * @param {number} [props.explosionDuration=EXPLOSION_DURATION] - Durée totale de l'animation d'explosion en secondes (défaut: 3.0)
 * @param {number} [props.explosionStagger=EXPLOSION_STAGGER] - Décalage temporel entre les particules (0-1) (défaut: 0.2)
 * @param {number} [props.explosionPathVariation=EXPLOSION_PATH_VARIATION] - Variation des trajectoires durant l'explosion (défaut: 0.25)
 * @param {number} [props.explosionArcFactor=EXPLOSION_ARC_FACTOR] - Facteur pour l'amplitude des arcs durant l'explosion (défaut: 0)
 * @param {number} [props.idleMovementSpeedVariation=IDLE_MOVEMENT_SPEED_VARIATION] - Variation de la vitesse du mouvement permanent (défaut: 0.4)
 * @param {number} [props.idleMovementMaxDistance=IDLE_MOVEMENT_MAX_DISTANCE] - Distance maximale (en unités) que les points peuvent s'éloigner de leur position d'origine (défaut: 15)
 * @param {number} [props.transitionDuration=TRANSITION_DURATION] - Durée de la transition entre l'explosion et l'oscillation (défaut: 1.0)
 * @param {number} [props.activationDuration=POST_ACTIVATION_DURATION] - Durée de la transition en secondes (défaut: 1.0)
 */
export function Posts({
  data,
  proximityThreshold = PROXIMITY_THRESHOLD,
  minDistance = MIN_DISTANCE,
  animationAmplitude = ANIMATION_AMPLITUDE,
  animationSpeed = ANIMATION_SPEED,
  sizeVariationFactor = SIZE_VARIATION_FACTOR,
  explosionDuration = EXPLOSION_DURATION,
  explosionStagger = EXPLOSION_STAGGER,
  explosionPathVariation = EXPLOSION_PATH_VARIATION,
  explosionArcFactor = EXPLOSION_ARC_FACTOR,
  idleMovementSpeedVariation = IDLE_MOVEMENT_SPEED_VARIATION,
  idleMovementMaxDistance = IDLE_MOVEMENT_MAX_DISTANCE,
  transitionDuration = TRANSITION_DURATION,
  activationDuration = POST_ACTIVATION_DURATION,
}) {
  const pointsRef = useRef();
  const { camera } = useThree();

  // On va suivre le post actif
  const [activePostUID, setActivePostUID] = useState(null);
  // État précédent pour détecter les changements
  const prevActivePostUIDRef = useRef(null);

  // Références pour stocker les positions originales des points
  const originalPositions = useRef([]);
  // Référence pour stocker les tailles originales
  const originalSizes = useRef([]);
  // Référence pour stocker les couleurs originales
  const originalColors = useRef([]);

  // Références pour l'animation de transition du post actif
  const transitionProgressRef = useRef({}); // Progrès de transition pour chaque post
  const activationTimeRef = useRef({}); // Temps de début de transition pour chaque post
  const prevActivePostRef = useRef(null); // Post précédemment actif

  // Référence pour le temps d'animation
  const timeRef = useRef(0);

  // Référence pour suivre l'animation d'explosion
  const explosionProgressRef = useRef(0);
  const explosionCompleteRef = useRef(false);

  // Référence pour stocker les fréquences uniques de chaque point
  const pointFrequenciesRef = useRef([]);

  // Référence pour le temps écoulé depuis la fin de l'explosion
  const postExplosionTimeRef = useRef(0);

  // Initialiser la connexion socket
  useEffect(() => {
    initSocketSync();

    // Réinitialiser l'état d'explosion à chaque nouveau rendu du composant
    explosionProgressRef.current = 0;
    explosionCompleteRef.current = false;
    timeRef.current = 0;
  }, [data]);

  // Surveiller les changements de activePostRef pour mettre à jour le post actif
  useFrame(() => {
    const newPostUID = activePostRef.current
      ? activePostRef.current.postUID
      : null;
    if (newPostUID !== activePostUID) {
      console.log("UID du post actif mis à jour:", newPostUID);

      // Stocker l'ancien post actif
      prevActivePostRef.current = activePostUID;

      // Pour chaque post, initialiser l'état de transition si nécessaire
      if (data) {
        data.forEach((post) => {
          const postUID = post.postUID;

          // Si c'est le nouveau post actif et qu'il n'était pas actif avant
          if (
            postUID === newPostUID &&
            postUID !== prevActivePostUIDRef.current
          ) {
            // Démarrer l'animation d'activation
            transitionProgressRef.current[postUID] = 0; // Commencer à 0
            activationTimeRef.current[postUID] = timeRef.current; // Mémoriser le temps de départ
          }
          // Si c'était le post actif et qu'il ne l'est plus
          else if (
            postUID === prevActivePostUIDRef.current &&
            postUID !== newPostUID
          ) {
            // Démarrer l'animation de désactivation
            transitionProgressRef.current[postUID] = 1; // Commencer à 1 (complètement actif)
            activationTimeRef.current[postUID] = timeRef.current; // Mémoriser le temps de départ
          }
        });
      }

      // Mettre à jour la référence pour la prochaine fois
      prevActivePostUIDRef.current = newPostUID;
      setActivePostUID(newPostUID);
    }
  });

  // Initialiser les fréquences uniques pour chaque point
  useEffect(() => {
    if (data && data.length > 0) {
      // Créer des fréquences uniques pour chaque point
      const frequencies = [];
      for (let i = 0; i < data.length; i++) {
        // Générer 6 valeurs aléatoires différentes pour chaque point (2 par dimension x,y,z)
        frequencies.push({
          x1: 0.3 + Math.random() * idleMovementSpeedVariation,
          x2: 0.2 + Math.random() * idleMovementSpeedVariation,
          y1: 0.2 + Math.random() * idleMovementSpeedVariation,
          y2: 0.4 + Math.random() * idleMovementSpeedVariation,
          z1: 0.5 + Math.random() * idleMovementSpeedVariation,
          z2: 0.3 + Math.random() * idleMovementSpeedVariation,
          phaseX: Math.random() * Math.PI * 2,
          phaseY: Math.random() * Math.PI * 2,
          phaseZ: Math.random() * Math.PI * 2,
        });
      }
      pointFrequenciesRef.current = frequencies;
    }
  }, [data, idleMovementSpeedVariation]);

  // Animation des points
  useFrame((state, delta) => {
    // Mettre à jour le temps global
    timeRef.current += delta;

    // Si on a pas encore finit l'explosion
    if (!explosionCompleteRef.current) {
      // Mettre à jour le progrès de l'explosion
      explosionProgressRef.current += delta / explosionDuration;

      // Vérifier si l'explosion est terminée
      if (explosionProgressRef.current >= 1.0) {
        explosionProgressRef.current = 1.0;
        explosionCompleteRef.current = true;
        // Réinitialiser le compteur post-explosion
        postExplosionTimeRef.current = 0;
      }
    } else {
      // Incrémenter le temps pour l'animation et le temps post-explosion
      postExplosionTimeRef.current += delta;
    }

    // Animer les points et gérer les transitions d'activation
    if (
      pointsRef.current &&
      pointsRef.current.geometry &&
      pointsRef.current.geometry.attributes.position &&
      originalPositions.current.length > 0
    ) {
      const positions = pointsRef.current.geometry.attributes.position.array;
      const colors = pointsRef.current.geometry.attributes.color.array;
      const sizes = pointsRef.current.geometry.attributes.size.array;

      for (let i = 0; i < positions.length / 3; i++) {
        const post = data[i];
        if (!post || !post.postUID) continue;

        const postUID = post.postUID;
        const index = i; // Index pour l'animation

        // Récupérer les fréquences d'animation pour ce point
        const frequencies = pointFrequenciesRef.current[index] || {
          x1: 0.5,
          x2: 0.3,
          y1: 0.4,
          y2: 0.5,
          z1: 0.6,
          z2: 0.2,
          phaseX: 0,
          phaseY: 0,
          phaseZ: 0,
        };

        // Position du point dans le tableau
        const posIndex = i * 3;

        // Si l'explosion est complète, animer les mouvements oscillants
        if (explosionCompleteRef.current) {
          // Calculer les déplacements pour chaque axe
          const moveX =
            Math.sin(timeRef.current * frequencies.x1 + frequencies.phaseX) *
              animationAmplitude *
              0.5 +
            Math.sin(timeRef.current * frequencies.x2 + index) *
              animationAmplitude *
              0.2;

          const moveY =
            Math.cos(timeRef.current * frequencies.y1 + frequencies.phaseY) *
              animationAmplitude *
              0.5 +
            Math.cos(timeRef.current * frequencies.y2 + index * 2) *
              animationAmplitude *
              0.3;

          const moveZ =
            Math.sin(timeRef.current * frequencies.z1 + frequencies.phaseZ) *
              animationAmplitude *
              0.4 +
            Math.sin(timeRef.current * frequencies.z2 + index * 1.5) *
              animationAmplitude *
              0.25;

          // Calculer le facteur de transition (0 à 1) pour une entrée en douceur
          const transitionFactor = Math.min(
            1.0,
            postExplosionTimeRef.current / transitionDuration
          );

          // Limiter le déplacement à la distance maximale configurée
          // Calculer la distance totale par rapport à la position d'origine
          const totalDistance = Math.sqrt(
            moveX * moveX + moveY * moveY + moveZ * moveZ
          );

          if (totalDistance > idleMovementMaxDistance) {
            // Facteur de réduction pour ramener le mouvement dans les limites
            const scaleFactor = idleMovementMaxDistance / totalDistance;

            // Appliquer le mouvement avec la limite et la transition progressive
            positions[posIndex] =
              originalPositions.current[posIndex] +
              moveX * scaleFactor * transitionFactor;
            positions[posIndex + 1] =
              originalPositions.current[posIndex + 1] +
              moveY * scaleFactor * transitionFactor;
            positions[posIndex + 2] =
              originalPositions.current[posIndex + 2] +
              moveZ * scaleFactor * transitionFactor;
          } else {
            // Appliquer le mouvement tel quel s'il est dans les limites, avec la transition
            positions[posIndex] =
              originalPositions.current[posIndex] + moveX * transitionFactor;
            positions[posIndex + 1] =
              originalPositions.current[posIndex + 1] +
              moveY * transitionFactor;
            positions[posIndex + 2] =
              originalPositions.current[posIndex + 2] +
              moveZ * transitionFactor;
          }
        } else if (explosionProgressRef.current > 0) {
          // Code pour gérer l'explosion initiale
          // Créer un décalage unique pour chaque point basé sur son index
          const indexOffset =
            (Math.sin(index * 0.1) * 0.5 + 0.5) * explosionStagger;
          const individualProgress = Math.min(
            1.0,
            (explosionProgressRef.current - indexOffset) / (1.0 - indexOffset)
          );

          // N'animer que si le progrès individuel est positif
          if (individualProgress > 0) {
            // Utiliser uniquement des fonctions d'easing sans rebond
            const easedProgress =
              index % 2 === 0
                ? easeOutExpo(individualProgress)
                : easeOutCubic(individualProgress);

            // Calculer une trajectoire légèrement courbée pendant l'explosion
            const curveFactorX = Math.sin(index * 0.3) * explosionPathVariation;
            const curveFactorY = Math.cos(index * 0.5) * explosionPathVariation;
            const curveFactorZ = Math.sin(index * 0.7) * explosionPathVariation;

            // Courbe plus douce, avec moins d'amplitude au milieu
            const arcFactor =
              Math.sin(individualProgress * Math.PI) * explosionArcFactor;

            // Calculer la position avec la courbe
            positions[posIndex] =
              originalPositions.current[posIndex] * easedProgress +
              curveFactorX *
                arcFactor *
                Math.abs(originalPositions.current[posIndex]);
            positions[posIndex + 1] =
              originalPositions.current[posIndex + 1] * easedProgress +
              curveFactorY *
                arcFactor *
                Math.abs(originalPositions.current[posIndex + 1]);
            positions[posIndex + 2] =
              originalPositions.current[posIndex + 2] * easedProgress +
              curveFactorZ *
                arcFactor *
                Math.abs(originalPositions.current[posIndex + 2]);

            // Effet de taille pendant l'explosion
            const sizeFactor =
              1.0 + (1.0 - easedProgress) * sizeVariationFactor;
            // Ne pas écraser la taille si c'est un post actif animé
            if (!(postUID in transitionProgressRef.current)) {
              sizes[i] = originalSizes.current[i] * sizeFactor;
            }
          } else {
            // Garder le point à la position 0 s'il n'a pas encore commencé à exploser
            positions[posIndex] = 0;
            positions[posIndex + 1] = 0;
            positions[posIndex + 2] = 0;

            // Taille minimum avant l'explosion
            if (!(postUID in transitionProgressRef.current)) {
              sizes[i] = originalSizes.current[i] * 0.5;
            }
          }
        }

        // Gérer l'animation de transition pour ce post
        if (postUID in transitionProgressRef.current) {
          const isActivating = postUID === activePostUID;
          const startTime = activationTimeRef.current[postUID] || 0;
          const elapsedTime = timeRef.current - startTime;
          const progress = Math.min(1, elapsedTime / activationDuration);

          // Mettre à jour le progrès en fonction de la direction (activation ou désactivation)
          if (isActivating) {
            transitionProgressRef.current[postUID] = progress;
          } else {
            transitionProgressRef.current[postUID] = 1 - progress;
          }

          // Si l'animation est terminée et que c'est une désactivation, supprimer l'entrée
          if (progress >= 1 && !isActivating) {
            delete transitionProgressRef.current[postUID];
            delete activationTimeRef.current[postUID];
          }

          // Appliquer l'effet d'easing pour une animation plus fluide
          const easedProgress = easeOutCubic(
            transitionProgressRef.current[postUID]
          );

          // Interpoler la taille entre la normale et la taille active
          let normalSize = originalSizes.current[i];
          const targetSize = isActivating ? ACTIVE_POST_SIZE : normalSize;
          sizes[i] = normalSize + (targetSize - normalSize) * easedProgress;

          // Interpoler la couleur entre la normale et la couleur active
          const colorIndex = i * 3;
          const originalR = originalColors.current[colorIndex];
          const originalG = originalColors.current[colorIndex + 1];
          const originalB = originalColors.current[colorIndex + 2];

          colors[colorIndex] =
            originalR + (ACTIVE_POST_COLOR[0] - originalR) * easedProgress;
          colors[colorIndex + 1] =
            originalG + (ACTIVE_POST_COLOR[1] - originalG) * easedProgress;
          colors[colorIndex + 2] =
            originalB + (ACTIVE_POST_COLOR[2] - originalB) * easedProgress;
        }
      }

      // Indiquer que les attributs ont changé
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
      pointsRef.current.geometry.attributes.size.needsUpdate = true;
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  // Créer la texture pour les particules
  const pointTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.6, "rgba(0,0,0,.6)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Créer les géométries et matériaux pour tous les points
  const [geometry, material] = useMemo(() => {
    if (!data || data.length === 0) return [null, null];

    // Récupérer le slug du nœud actif pour le logging uniquement
    const currentActivePostUID = activePostUID;

    // Créer les positions, couleurs et tailles pour tous les points
    const positions = [];
    const colors = [];
    const sizes = [];

    // Pour chaque post, ajouter à la géométrie unique
    data.forEach((post) => {
      if (!post) return;

      // Déterminer la position
      let x = 0,
        y = 0,
        z = 0;
      // Format 1: Coordonnées directement au niveau racine
      if (
        post.x !== undefined &&
        post.y !== undefined &&
        post.z !== undefined
      ) {
        x = post.x;
        y = post.y;
        z = post.z;
      }
      // Format 2: Coordonnées dans un objet 'coordinates'
      else if (post.coordinates && post.coordinates.x !== undefined) {
        x = post.coordinates.x;
        y = post.coordinates.y;
        z = post.coordinates.z;
      } else {
        console.warn(
          `Post ${post.id} a des coordonnées manquantes ou invalides.`
        );
        return;
      }

      // Vérifier si ce post est le post actif
      const isActivePost = post.postUID === currentActivePostUID;

      // Déterminer la couleur - toujours utiliser la couleur originale ici
      // L'animation de couleur sera gérée dans useFrame
      const r = post.color && post.color.length >= 3 ? post.color[0] : 1.0;
      const g = post.color && post.color.length >= 3 ? post.color[1] : 1.0;
      const b = post.color && post.color.length >= 3 ? post.color[2] : 1.0;

      // Déterminer la taille - toujours utiliser la taille normale ici
      // L'animation de taille sera gérée dans useFrame
      let size;

      if (
        USE_IMPACT_SIZE &&
        post.impact !== undefined &&
        !isNaN(post.impact) &&
        post.impact > 0
      ) {
        // Limiter l'impact entre 1 et 500
        const impactValue = Math.max(1, Math.min(500, post.impact));
        // Conversion logarithmique de l'impact en taille
        const normalizedImpact = Math.log(impactValue) / Math.log(500);
        // Mise à l'échelle entre MIN_IMPACT_SIZE et MAX_IMPACT_SIZE
        size =
          MIN_IMPACT_SIZE +
          normalizedImpact * (MAX_IMPACT_SIZE - MIN_IMPACT_SIZE);
      } else {
        // Taille standard
        size = SIZE;
      }

      // Ajouter ce point aux tableaux
      positions.push(x, y, z);
      colors.push(r, g, b);
      sizes.push(size);

      if (isActivePost) {
        console.log(
          `Post actif ajouté aux points: position=(${x}, ${y}, ${z}), taille initiale=${size}`
        );

        // Initialiser l'état de transition pour le post actif
        transitionProgressRef.current[post.postUID] = 0;
        activationTimeRef.current[post.postUID] = 0;
      }
    });

    // Si nous avons un nœud actif, logger le nombre de posts correspondants
    if (currentActivePostUID) {
      const matchingCount = data.filter(
        (post) => post && post.postUID === currentActivePostUID
      ).length;
      console.log(
        `Posts correspondant au UID "${currentActivePostUID}": ${matchingCount}/${data.length}`
      );
    }

    // Créer une seule géométrie pour tous les points
    const geo = new THREE.BufferGeometry();
    if (positions.length > 0) {
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3)
      );
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geo.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1));

      // Sauvegarder les positions, couleurs et tailles originales pour l'animation
      originalPositions.current = [...positions];
      originalColors.current = [...colors];
      originalSizes.current = [...sizes];
    }

    // Créer un matériau de shader personnalisé pour les points
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        pointTexture: { value: pointTexture },
        proximityThreshold: { value: proximityThreshold },
        minDistance: { value: minDistance },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      vertexColors: true,
    });

    return [geo, mat];
  }, [data, pointTexture, proximityThreshold, minDistance, activePostUID]);

  // Ne rien afficher si pas de données
  if (!data || data.length === 0 || !material) {
    return null;
  }

  return (
    <>
      {/* Tous les points avec la même opacité */}
      {geometry && geometry.attributes.position && (
        <points ref={pointsRef} geometry={geometry} material={material} />
      )}
    </>
  );
}

export default Posts;

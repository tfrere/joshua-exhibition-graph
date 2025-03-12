import { useRef, useMemo, useState, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import useNearestPostDetection, {
  activePostRef,
  initSocketSync,
} from "./hooks/useNearestPostDetection";
import PostActivationEffect from "./effects/PostActivationEffect";
import PulseEffect from "./effects/PulseEffect";

// Import des renderers
import { SphereRenderer, BillboardRenderer } from "./renderers";

// Import des constantes et fonctions utilitaires
import {
  SIZE,
  ACTIVE_POST_SIZE,
  MIN_IMPACT_SIZE,
  MAX_IMPACT_SIZE,
  USE_IMPACT_SIZE,
  ACTIVE_POST_COLOR,
  POST_ACTIVATION_DURATION,
  MIN_SIZE_DURING_TRANSITION,
  SPHERE_SEGMENTS,
  ANIMATION_AMPLITUDE,
  ANIMATION_SPEED,
  EXPLOSION_DURATION,
  EXPLOSION_STAGGER,
  EXPLOSION_PATH_VARIATION,
  SIZE_VARIATION_FACTOR,
  EXPLOSION_ARC_FACTOR,
  IDLE_MOVEMENT_SPEED_VARIATION,
  IDLE_MOVEMENT_MAX_DISTANCE,
  TRANSITION_DURATION,
  PROXIMITY_THRESHOLD,
  MIN_DISTANCE,
  // Nouvelles constantes pour l'effet d'activation
  ACTIVATION_EFFECT_DURATION,
  ACTIVATION_EFFECT_MAX_SIZE,
  ACTIVATION_EFFECT_START_SIZE,
  ACTIVATION_EFFECT_COLOR,
  ACTIVATION_EFFECT_OPACITY,
  ACTIVATION_EFFECT_RINGS,
  ACTIVATION_EFFECT_RING_DELAY,
} from "./utils/constants";

import {
  easeOutCubic,
  easeOutExpo,
  calculateOscillationPositions,
  calculateExplosionPositions,
  calculateTransitionValues,
  calculateGradientColorByDistance,
} from "./utils/animationUtils";

// ----------------------------------------------------------------------------------
// Types et documentation
// ----------------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------------
// Composant principal Posts
// ----------------------------------------------------------------------------------
/**
 * Composant pour le rendu ultra-optimisé des posts en utilisant instancedMesh
 * @param {Object} props - Propriétés du composant
 * @param {Array} props.data - Données des posts
 * @param {string} [props.renderer="sphere"] - Type de renderer à utiliser ('sphere' ou 'billboard')
 * @param {number} [props.proximityThreshold=100.0] - Distance à partir de laquelle les points commencent à réduire
 * @param {number} [props.minDistance=20.0] - Distance à laquelle les points disparaissent complètement
 * @param {number} [props.animationAmplitude=ANIMATION_AMPLITUDE] - Amplitude du mouvement aléatoire des points
 * @param {number} [props.animationSpeed=ANIMATION_SPEED] - Vitesse de l'animation des points
 * @param {number} [props.sizeVariationFactor=SIZE_VARIATION_FACTOR] - Facteur de variation de la taille pendant l'explosion
 * @param {number} [props.explosionDuration=EXPLOSION_DURATION] - Durée totale de l'animation d'explosion en secondes
 * @param {number} [props.explosionStagger=EXPLOSION_STAGGER] - Décalage temporel entre les particules (0-1)
 * @param {number} [props.explosionPathVariation=EXPLOSION_PATH_VARIATION] - Variation des trajectoires durant l'explosion
 * @param {number} [props.explosionArcFactor=EXPLOSION_ARC_FACTOR] - Facteur pour l'amplitude des arcs durant l'explosion
 * @param {number} [props.idleMovementSpeedVariation=IDLE_MOVEMENT_SPEED_VARIATION] - Variation de la vitesse du mouvement permanent
 * @param {number} [props.idleMovementMaxDistance=IDLE_MOVEMENT_MAX_DISTANCE] - Distance maximale que les points peuvent s'éloigner
 * @param {number} [props.transitionDuration=TRANSITION_DURATION] - Durée de la transition entre l'explosion et l'oscillation
 * @param {number} [props.activationDuration=POST_ACTIVATION_DURATION] - Durée de la transition en secondes
 *
 */
export function Posts({
  data,
  renderer = "sphere",
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
  // ----------------------------------------------------------------------------------
  // Références et état
  // ----------------------------------------------------------------------------------
  // Références pour les instances et la caméra
  const meshRef = useRef();
  const { camera } = useThree();

  // Utilisation du hook personnalisé pour la détection du post le plus proche
  // Ce hook remplace la logique d'activation manuelle des posts basée sur la caméra
  const { targetPositionRef } = useNearestPostDetection(data);

  // État pour le post actif
  const [activePostUID, setActivePostUID] = useState(null);
  const prevActivePostUIDRef = useRef(null);
  const prevActivePostRef = useRef(null);

  // Nouvel état pour suivre les effets d'activation actifs
  const [activationEffects, setActivationEffects] = useState([]);

  // Références pour l'animation
  const originalPositions = useRef([]); // Positions originales des points
  const originalSizes = useRef([]); // Tailles originales
  const originalColors = useRef([]); // Couleurs originales
  const tempObject = useMemo(() => new THREE.Object3D(), []); // Objet temporaire pour manipuler chaque instance
  const postIndexMap = useRef(new Map()); // Map pour associer postUID à index

  // Références pour les transitions
  const transitionProgressRef = useRef({}); // Progrès de transition pour chaque post
  const activationTimeRef = useRef({}); // Temps de début de transition pour chaque post

  // Références pour l'animation générale
  const timeRef = useRef(0);
  const explosionProgressRef = useRef(0);
  const explosionCompleteRef = useRef(false);
  const pointFrequenciesRef = useRef([]); // Fréquences uniques pour chaque point
  const postExplosionTimeRef = useRef(0); // Temps écoulé depuis la fin de l'explosion
  const frameCountRef = useRef(0); // Compteur de frames pour les logs
  const matrixRef = useRef([]); // Référence aux matrices de transformation des instances

  // ----------------------------------------------------------------------------------
  // Initialisation
  // ----------------------------------------------------------------------------------
  // Initialiser la connexion socket et réinitialiser l'état d'explosion
  useEffect(() => {
    initSocketSync();
    explosionProgressRef.current = 0;
    explosionCompleteRef.current = false;
    timeRef.current = 0;
  }, [data]);

  // Initialiser les fréquences uniques pour chaque point
  useEffect(() => {
    if (data && data.length > 0) {
      const frequencies = [];
      for (let i = 0; i < data.length; i++) {
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

  // Remplir le postIndexMap une fois lors du chargement
  useEffect(() => {
    if (data && data.length) {
      postIndexMap.current.clear();
      data.forEach((post, index) => {
        if (post && post.postUID) {
          postIndexMap.current.set(post.postUID, index);
        }
      });
    }
  }, [data]);

  // ----------------------------------------------------------------------------------
  // Gestion du post actif
  // ----------------------------------------------------------------------------------
  // Surveiller les changements de activePostRef pour mettre à jour le post actif
  useFrame(() => {
    const newPostUID = activePostRef.current
      ? activePostRef.current.postUID
      : null;
    if (newPostUID !== activePostUID) {
      // Si un nouveau post est activé, déclencher l'effet d'activation
      if (newPostUID) {
        // Jouer le son de toucher

        const postIndex = data.findIndex(
          (post) => post && post.postUID === newPostUID
        );
        if (postIndex !== -1) {
          const post = data[postIndex];
          let postPosition;

          // Récupérer la position actuelle du post depuis la matrice
          if (
            meshRef.current &&
            matrixRef.current &&
            matrixRef.current[postIndex]
          ) {
            // Extraire la position directement de la matrice de transformation
            const matrix = matrixRef.current[postIndex];
            const position = new THREE.Vector3();
            position.setFromMatrixPosition(matrix);
            postPosition = [position.x, position.y, position.z];
          }
          // Fallback si la matrice n'est pas disponible
          else if (
            post.x !== undefined &&
            post.y !== undefined &&
            post.z !== undefined
          ) {
            postPosition = [post.x, post.y, post.z];
          } else if (post.coordinates && post.coordinates.x !== undefined) {
            postPosition = [
              post.coordinates.x,
              post.coordinates.y,
              post.coordinates.z,
            ];
          } else {
            postPosition = [0, 0, 0];
          }

          // Créer un nouvel effet avec un ID unique
          const newEffect = {
            id: `effect-${Date.now()}-${Math.random()}`,
            position: postPosition,
            timestamp: Date.now(),
          };

          // Ajouter ce nouvel effet à la liste
          setActivationEffects((prev) => [...prev, newEffect]);
        }
      }

      // Stocker l'ancien post actif
      const oldPostUID = activePostUID;

      // Si l'ancien post était activé et est encore en transition, on le termine proprement
      if (oldPostUID && oldPostUID in transitionProgressRef.current) {
        // Commencer la désactivation depuis l'état actuel
        activationTimeRef.current[oldPostUID] = timeRef.current;
      }

      // Si le nouveau post est déjà en transition, on vérifie s'il faut inverser la direction
      if (newPostUID && newPostUID in transitionProgressRef.current) {
        const currentProgress = transitionProgressRef.current[newPostUID];
        if (currentProgress < 1.0) {
          // La transition est déjà en cours, on ne fait rien (elle continuera naturellement)
        } else {
          // La transition est terminée, mais dans le mauvais sens (désactivation), on réinitialise
          transitionProgressRef.current[newPostUID] = 0.0;
          activationTimeRef.current[newPostUID] = timeRef.current;
        }
      } else if (newPostUID) {
        // Nouveau post actif, commencer une nouvelle transition
        transitionProgressRef.current[newPostUID] = 0.0;
        activationTimeRef.current[newPostUID] = timeRef.current;
      }

      // Mettre à jour la référence pour la prochaine fois
      prevActivePostUIDRef.current = activePostUID;
      setActivePostUID(newPostUID);
    }
  });

  // Supprimer les effets d'activation terminés après un certain temps
  useEffect(() => {
    if (activationEffects.length > 0) {
      const duration =
        ACTIVATION_EFFECT_DURATION * 1000 * (ACTIVATION_EFFECT_RINGS + 1); // Durée totale en ms
      const timeoutId = setTimeout(() => {
        // Supprimer les effets plus anciens que la durée totale
        const now = Date.now();
        setActivationEffects((prev) =>
          prev.filter((effect) => now - effect.timestamp < duration)
        );
      }, duration);

      return () => clearTimeout(timeoutId);
    }
  }, [activationEffects]);

  // ----------------------------------------------------------------------------------
  // Animation principale
  // ----------------------------------------------------------------------------------
  useFrame((state, delta) => {
    if (!data || !data.length || !meshRef.current) return;

    // Mettre à jour le temps global et les compteurs
    timeRef.current += delta;
    frameCountRef.current++;

    // Gestion de l'explosion initiale
    updateExplosionProgress(delta);

    // Log périodique pour vérifier l'état des posts actifs
    logActivePostStatus();

    // Traiter chaque post et mettre à jour ses attributs
    let changedInstances = updatePostInstances();

    // Ne mettre à jour les buffers que si nécessaire
    if (changedInstances) {
      meshRef.current.instanceMatrix.needsUpdate = true;
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  // ----------------------------------------------------------------------------------
  // Fonctions d'animation
  // ----------------------------------------------------------------------------------
  // Mise à jour du progrès de l'explosion
  function updateExplosionProgress(delta) {
    if (!explosionCompleteRef.current) {
      // Mettre à jour le progrès de l'explosion
      explosionProgressRef.current += delta / explosionDuration;

      // Vérifier si l'explosion est terminée
      if (explosionProgressRef.current >= 1.0) {
        explosionProgressRef.current = 1.0;
        explosionCompleteRef.current = true;
        postExplosionTimeRef.current = 0;
      }
    } else {
      // Incrémenter le temps depuis la fin de l'explosion
      postExplosionTimeRef.current += delta;
    }
  }

  // Affichage des logs périodiques sur l'état du post actif
  function logActivePostStatus() {
    if (frameCountRef.current % 60 === 0 && activePostUID) {
      const activeIndex = data.findIndex(
        (post) => post && post.postUID === activePostUID
      );
      if (activeIndex !== -1) {
        const isInTransition = activePostUID in transitionProgressRef.current;
        const transitionProgress = isInTransition
          ? transitionProgressRef.current[activePostUID]
          : "N/A";
      }
    }
  }

  // Mise à jour des instances pour chaque post
  function updatePostInstances() {
    let changedInstances = false;

    // Calculer la position de la caméra pour la proximité
    const cameraPosition = camera.position.clone();

    // Parcourir chaque post et mettre à jour sa position et sa taille
    for (let i = 0; i < data.length; i++) {
      const post = data[i];
      if (!post || !post.postUID) continue;

      const postUID = post.postUID;

      // Déterminer si ce post est actif
      const isActive = postUID === activePostUID;

      // Valeurs de base
      const baseSize = originalSizes.current[i] || SIZE;
      const baseX = originalPositions.current[i * 3] || 0;
      const baseY = originalPositions.current[i * 3 + 1] || 0;
      const baseZ = originalPositions.current[i * 3 + 2] || 0;

      // Créer un vecteur pour la position du post
      const postPosition = new THREE.Vector3(baseX, baseY, baseZ);

      // Calculer la distance entre la caméra et le post
      const distanceToCamera = cameraPosition.distanceTo(postPosition);

      // Calculer le facteur de proximité (1 = pleine taille, 0 = invisible)
      let proximityFactor = 1.0;

      if (distanceToCamera < proximityThreshold) {
        // Calculer le facteur de proximité entre 0 et 1
        proximityFactor = Math.max(
          0,
          (distanceToCamera - minDistance) / (proximityThreshold - minDistance)
        );
      }

      // Valeurs finales à appliquer
      let finalX = baseX,
        finalY = baseY,
        finalZ = baseZ;
      let finalSize = baseSize;
      let finalR = originalColors.current[i * 3] || 1;
      let finalG = originalColors.current[i * 3 + 1] || 1;
      let finalB = originalColors.current[i * 3 + 2] || 1;

      // Appliquer les animations selon l'état
      if (explosionCompleteRef.current) {
        // Animation d'oscillation après l'explosion
        const oscResult = applyOscillationAnimation(i, baseX, baseY, baseZ);
        finalX = oscResult.finalX;
        finalY = oscResult.finalY;
        finalZ = oscResult.finalZ;
      } else if (explosionProgressRef.current > 0) {
        // Animation d'explosion initiale
        const expResult = applyExplosionAnimation(
          i,
          baseX,
          baseY,
          baseZ,
          baseSize,
          postUID
        );
        finalX = expResult.finalX;
        finalY = expResult.finalY;
        finalZ = expResult.finalZ;
        finalSize = expResult.finalSize;
      }

      // Animation de transition pour les posts actifs ou en désactivation
      if (postUID in transitionProgressRef.current) {
        const animResult = applyTransitionAnimation(
          i,
          baseSize,
          finalSize,
          finalR,
          finalG,
          finalB,
          isActive,
          postUID
        );
        finalSize = animResult.finalSize;
        finalR = animResult.finalR;
        finalG = animResult.finalG;
        finalB = animResult.finalB;
        changedInstances = true;
      }
      // S'assurer que les posts actifs qui ne sont pas en transition sont bien affichés à la taille active
      else if (isActive) {
        // Initialiser une nouvelle transition pour ce post
        // au lieu d'appliquer directement la taille active
        transitionProgressRef.current[postUID] = 0.0;
        activationTimeRef.current[postUID] = timeRef.current;

        // Utiliser les valeurs actuelles pour cette frame
        // La prochaine frame utilisera la transition
        changedInstances = true;
      }

      // Appliquer le facteur de proximité à la taille finale (sauf pour les posts actifs)
      if (!isActive && postUID in transitionProgressRef.current === false) {
        finalSize *= proximityFactor;
      }

      // Ne pas rendre le post s'il est complètement invisible à cause de la proximité
      if (proximityFactor <= 0 && !isActive) {
        finalSize = 0;
      }

      // Appliquer les transformations à l'objet 3D
      applyTransformations(
        i,
        finalX,
        finalY,
        finalZ,
        finalSize,
        finalR,
        finalG,
        finalB,
        postUID
      );

      changedInstances = true;
    }

    return changedInstances;
  }

  // Animation d'oscillation pour les posts après l'explosion
  function applyOscillationAnimation(index, baseX, baseY, baseZ) {
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

    return calculateOscillationPositions({
      timeValue: timeRef.current,
      index,
      baseX,
      baseY,
      baseZ,
      frequencies,
      amplitude: animationAmplitude,
      transitionFactor: Math.min(
        1.0,
        postExplosionTimeRef.current / transitionDuration
      ),
      maxDistance: idleMovementMaxDistance,
    });
  }

  // Animation d'explosion initiale
  function applyExplosionAnimation(
    index,
    baseX,
    baseY,
    baseZ,
    baseSize,
    postUID
  ) {
    return calculateExplosionPositions({
      index,
      baseX,
      baseY,
      baseZ,
      baseSize,
      isInTransition: postUID in transitionProgressRef.current,
      progress: explosionProgressRef.current,
      stagger: explosionStagger,
      pathVariation: explosionPathVariation,
      arcFactor: explosionArcFactor,
      sizeVariationFactor,
    });
  }

  // Animation de transition d'activation/désactivation
  function applyTransitionAnimation(
    index,
    baseSize,
    finalSize,
    finalR,
    finalG,
    finalB,
    isActive,
    postUID
  ) {
    // Calcul du progrès de transition
    const startTime = activationTimeRef.current[postUID];
    const elapsedTime = timeRef.current - startTime;
    let progress = Math.min(1.0, elapsedTime / activationDuration);

    // Si c'est une désactivation, inverser le progrès
    const isActivation = isActive;
    if (!isActivation) {
      progress = 1.0 - progress;
    }

    // Mise à jour du progrès
    transitionProgressRef.current[postUID] = progress;

    // Changement: ne modifier que la taille, pas la couleur pour les posts actifs
    const baseColor = [
      originalColors.current[index * 3],
      originalColors.current[index * 3 + 1],
      originalColors.current[index * 3 + 2],
    ];

    // Utiliser la fonction utilitaire pour calculer la taille et la couleur
    // Mais utiliser la couleur originale au lieu de ACTIVE_POST_COLOR
    const result = calculateTransitionValues({
      baseSize,
      baseColor,
      targetColor: baseColor, // Utiliser la couleur de base au lieu de ACTIVE_POST_COLOR
      targetSize: isActivation ? ACTIVE_POST_SIZE : baseSize,
      progress,
      minSize: MIN_SIZE_DURING_TRANSITION,
    });

    // Si l'animation est terminée
    if (progress >= 0.99) {
      if (isActivation) {
        // Garder à l'état activé
        result.finalSize = ACTIVE_POST_SIZE;
        // IMPORTANT: Fixer le progrès à 1 pour éviter le flickering
        transitionProgressRef.current[postUID] = 1.0;
      } else {
        // Supprimer la transition car l'animation est terminée
        delete transitionProgressRef.current[postUID];
        delete activationTimeRef.current[postUID];
      }
    }

    return result;
  }

  // Appliquer les transformations à l'objet 3D temporaire et mettre à jour l'instance
  function applyTransformations(
    index,
    finalX,
    finalY,
    finalZ,
    finalSize,
    finalR,
    finalG,
    finalB,
    postUID
  ) {
    tempObject.position.set(finalX, finalY, finalZ);

    // Scaling uniforme basé sur la taille finale
    // S'assurer que la taille n'est jamais nulle ou négative
    const safeSize = Math.max(0.001, finalSize);
    tempObject.scale.set(safeSize, safeSize, safeSize);

    // Réinitialiser toute rotation qui pourrait causer des problèmes
    tempObject.rotation.set(0, 0, 0);
    tempObject.quaternion.identity();

    // Mise à jour de la matrice et application à l'instance
    tempObject.updateMatrix();

    // Mettre à jour la matrice de manière sécurisée
    try {
      if (meshRef.current && meshRef.current.setMatrixAt) {
        meshRef.current.setMatrixAt(index, tempObject.matrix);

        // Stocker la matrice pour référence ultérieure
        if (!matrixRef.current) {
          matrixRef.current = [];
        }

        // Créer une copie de la matrice pour ne pas partager la référence
        if (!matrixRef.current[index]) {
          matrixRef.current[index] = new THREE.Matrix4();
        }
        matrixRef.current[index].copy(tempObject.matrix);

        // Mettre à jour la couleur
        if (meshRef.current.setColorAt) {
          meshRef.current.setColorAt(
            index,
            new THREE.Color(finalR, finalG, finalB)
          );
        }
      }
    } catch (error) {
      console.error(
        `Erreur lors de la mise à jour de la matrice pour le post ${postUID}:`,
        error
      );
    }
  }

  // ----------------------------------------------------------------------------------
  // Création des données pour l'instancedMesh
  // ----------------------------------------------------------------------------------
  useMemo(() => {
    if (!data || data.length === 0) return;

    // Stocker les positions, tailles et couleurs originales
    const positions = [];
    const sizes = [];
    const colors = [];

    // Trouver la distance maximale pour normaliser
    let maxDistance = 0;
    data.forEach((post) => {
      if (!post) return;

      let x = 0,
        y = 0,
        z = 0;

      if (
        post.x !== undefined &&
        post.y !== undefined &&
        post.z !== undefined
      ) {
        x = post.x;
        y = post.y;
        z = post.z;
      } else if (post.coordinates && post.coordinates.x !== undefined) {
        x = post.coordinates.x;
        y = post.coordinates.y;
        z = post.coordinates.z;
      }

      const distance = Math.sqrt(x * x + y * y + z * z);
      if (distance > maxDistance) {
        maxDistance = distance;
      }
    });

    // Traiter chaque post
    data.forEach((post, index) => {
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
        x = 0;
        y = 0;
        z = 0;
      }

      // Stocker la position
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = z;

      // Déterminer la taille en fonction de l'impact
      let size = SIZE;
      if (
        USE_IMPACT_SIZE &&
        post.impact !== undefined &&
        !isNaN(post.impact) &&
        post.impact > 0
      ) {
        const impactValue = Math.max(1, Math.min(500, post.impact));
        const normalizedImpact = Math.log(impactValue) / Math.log(500);
        size =
          MIN_IMPACT_SIZE +
          normalizedImpact * (MAX_IMPACT_SIZE - MIN_IMPACT_SIZE);
      }

      // Stocker la taille
      sizes[index] = size;

      // Calculer la couleur en fonction de la distance au centre
      let [r, g, b] = calculateGradientColorByDistance({
        x,
        y,
        z,
        maxDistance,
      });

      r = 1.0;
      g = 1.0;
      b = 1.0;

      // Stocker la couleur
      colors[index * 3] = r;
      colors[index * 3 + 1] = g;
      colors[index * 3 + 2] = b;

      // Mémoriser l'index pour ce postUID
      if (post.postUID) {
        postIndexMap.current.set(post.postUID, index);
      }

      // Si c'est déjà le post actif, initialiser sa transition
      if (post.postUID === activePostUID) {
        transitionProgressRef.current[post.postUID] = 0;
        activationTimeRef.current[post.postUID] = 0;
      }
    });

    // Stocker les valeurs originales
    originalPositions.current = positions;
    originalSizes.current = sizes;
    originalColors.current = colors;
  }, [data, activePostUID]);

  // ----------------------------------------------------------------------------------
  // Rendu
  // ----------------------------------------------------------------------------------
  // Ne rien afficher si pas de données
  if (!data || data.length === 0) {
    return null;
  }

  return (
    <>
      {/* Rendu des posts avec le renderer sélectionné */}
      {renderer === "sphere" ? (
        <SphereRenderer
          meshRef={meshRef}
          data={data}
          SPHERE_SEGMENTS={SPHERE_SEGMENTS}
          SIZE={SIZE}
          MIN_IMPACT_SIZE={MIN_IMPACT_SIZE}
          MAX_IMPACT_SIZE={MAX_IMPACT_SIZE}
        />
      ) : (
        <BillboardRenderer
          ref={meshRef}
          data={data}
          SIZE={SIZE}
          MIN_IMPACT_SIZE={MIN_IMPACT_SIZE}
          MAX_IMPACT_SIZE={MAX_IMPACT_SIZE}
        />
      )}

      {/* Effets d'activation */}
      {activationEffects.map((effect) => (
        <PulseEffect
          key={effect.id}
          position={effect.position}
          colorStart={[0.2, 0.8, 1.0]} // Couleur de départ (bleu-cyan)
          colorEnd={[1.0, 0.4, 0.8]} // Couleur de fin (rose-violet)
          duration={1.0} // Durée en secondes
          rings={2} // Nombre d'anneaux
          glowIntensity={1.2} // Intensité de la lueur
          onComplete={() => console.log("Animation terminée")}
        />
      ))}
    </>
  );
}

export default Posts;

// ----------------------------------------------------------------------------------
// Fonctions d'easing et utilitaires pour les animations des posts
// ----------------------------------------------------------------------------------

/**
 * Fonction d'easing cubique pour une sortie douce sans rebond
 * @param {number} x - Valeur entre 0 et 1
 * @returns {number} Valeur easing entre 0 et 1
 */
export function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

/**
 * Fonction d'easing exponentielle pour un effet d'explosion plus dynamique
 * @param {number} x - Valeur entre 0 et 1
 * @returns {number} Valeur easing entre 0 et 1
 */
export function easeOutExpo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

/**
 * Calcule les positions pour l'animation d'oscillation
 * @param {Object} params - Paramètres pour l'animation
 * @param {number} params.timeValue - Valeur du temps actuel
 * @param {number} params.index - Index du post
 * @param {number} params.baseX - Position X de base
 * @param {number} params.baseY - Position Y de base
 * @param {number} params.baseZ - Position Z de base
 * @param {Object} params.frequencies - Fréquences d'oscillation
 * @param {number} params.amplitude - Amplitude du mouvement
 * @param {number} params.transitionFactor - Facteur de transition (0-1)
 * @param {number} params.maxDistance - Distance maximale autorisée
 * @returns {Object} Positions X, Y, Z calculées
 */
export function calculateOscillationPositions({
  timeValue,
  index,
  baseX,
  baseY,
  baseZ,
  frequencies,
  amplitude,
  transitionFactor,
  maxDistance,
}) {
  // Calculer les déplacements pour chaque axe
  const moveX =
    Math.sin(timeValue * frequencies.x1 + frequencies.phaseX) *
      amplitude *
      0.5 +
    Math.sin(timeValue * frequencies.x2 + index) * amplitude * 0.2;

  const moveY =
    Math.cos(timeValue * frequencies.y1 + frequencies.phaseY) *
      amplitude *
      0.5 +
    Math.cos(timeValue * frequencies.y2 + index * 2) * amplitude * 0.3;

  const moveZ =
    Math.sin(timeValue * frequencies.z1 + frequencies.phaseZ) *
      amplitude *
      0.4 +
    Math.sin(timeValue * frequencies.z2 + index * 1.5) * amplitude * 0.25;

  // Limiter le déplacement à la distance maximale configurée
  const totalDistance = Math.sqrt(
    moveX * moveX + moveY * moveY + moveZ * moveZ
  );

  let finalX = baseX;
  let finalY = baseY;
  let finalZ = baseZ;

  if (totalDistance > maxDistance) {
    // Facteur de réduction pour ramener le mouvement dans les limites
    const scaleFactor = maxDistance / totalDistance;

    // Appliquer le mouvement avec la limite et la transition progressive
    finalX = baseX + moveX * scaleFactor * transitionFactor;
    finalY = baseY + moveY * scaleFactor * transitionFactor;
    finalZ = baseZ + moveZ * scaleFactor * transitionFactor;
  } else {
    // Appliquer le mouvement tel quel s'il est dans les limites
    finalX = baseX + moveX * transitionFactor;
    finalY = baseY + moveY * transitionFactor;
    finalZ = baseZ + moveZ * transitionFactor;
  }

  return { finalX, finalY, finalZ };
}

/**
 * Calcule les positions pour l'animation d'explosion
 * @param {Object} params - Paramètres pour l'animation
 * @param {number} params.index - Index du post
 * @param {number} params.baseX - Position X de base
 * @param {number} params.baseY - Position Y de base
 * @param {number} params.baseZ - Position Z de base
 * @param {number} params.baseSize - Taille de base
 * @param {boolean} params.isInTransition - Si le post est en transition
 * @param {number} params.progress - Progrès de l'explosion (0-1)
 * @param {number} params.stagger - Décalage temporel entre les particules
 * @param {number} params.pathVariation - Variation des trajectoires
 * @param {number} params.arcFactor - Facteur d'arc
 * @param {number} params.sizeVariationFactor - Facteur de variation de taille
 * @returns {Object} Positions X, Y, Z et taille calculées
 */
export function calculateExplosionPositions({
  index,
  baseX,
  baseY,
  baseZ,
  baseSize,
  isInTransition,
  progress,
  stagger,
  pathVariation,
  arcFactor,
  sizeVariationFactor,
}) {
  const indexOffset = (Math.sin(index * 0.1) * 0.5 + 0.5) * stagger;
  const individualProgress = Math.min(
    1.0,
    (progress - indexOffset) / (1.0 - indexOffset)
  );

  let finalX = baseX;
  let finalY = baseY;
  let finalZ = baseZ;
  let finalSize = baseSize;

  // N'animer que si le progrès individuel est positif
  if (individualProgress > 0) {
    // Fonction d'easing
    const easedProgress =
      index % 2 === 0
        ? easeOutExpo(individualProgress)
        : easeOutCubic(individualProgress);

    // Facteurs pour trajectoire courbée
    const curveFactorX = Math.sin(index * 0.3) * pathVariation;
    const curveFactorY = Math.cos(index * 0.5) * pathVariation;
    const curveFactorZ = Math.sin(index * 0.7) * pathVariation;

    // Effet d'arc
    const arcFactorValue = Math.sin(individualProgress * Math.PI) * arcFactor;

    // Calculer la position avec la courbe
    finalX =
      baseX * easedProgress + curveFactorX * arcFactorValue * Math.abs(baseX);
    finalY =
      baseY * easedProgress + curveFactorY * arcFactorValue * Math.abs(baseY);
    finalZ =
      baseZ * easedProgress + curveFactorZ * arcFactorValue * Math.abs(baseZ);

    // Effet de taille pendant l'explosion
    const sizeFactor = 1.0 + (1.0 - easedProgress) * sizeVariationFactor;

    // Ne pas écraser la taille si c'est un post actif animé
    if (!isInTransition) {
      finalSize = baseSize * sizeFactor;
    }
  } else {
    // Garder le point à la position 0 s'il n'a pas encore commencé à exploser
    finalX = 0;
    finalY = 0;
    finalZ = 0;

    // Taille minimum avant l'explosion
    if (!isInTransition) {
      finalSize = baseSize * 0.5;
    }
  }

  return { finalX, finalY, finalZ, finalSize };
}

/**
 * Calcule la taille et la couleur pour une transition d'activation/désactivation
 * @param {Object} params - Paramètres pour la transition
 * @param {number} params.baseSize - Taille de base
 * @param {Array} params.baseColor - Couleur de base [r, g, b]
 * @param {Array} params.targetColor - Couleur cible [r, g, b]
 * @param {number} params.targetSize - Taille cible
 * @param {number} params.progress - Progrès de la transition (0-1)
 * @param {number} params.minSize - Taille minimale
 * @returns {Object} Taille et couleur finales
 */
export function calculateTransitionValues({
  baseSize,
  baseColor,
  targetColor,
  targetSize,
  progress,
  minSize,
}) {
  // Appliquer l'effet d'easing pour une transition plus fluide
  const easedProgress = easeOutCubic(progress);

  // Interpolation de la taille entre taille normale et taille active
  // IMPORTANT: Ajouter un garde pour éviter toute valeur trop petite qui causerait un flickering
  const finalSize = Math.max(
    minSize,
    baseSize + (targetSize - baseSize) * easedProgress
  );

  // Interpolation de la couleur
  const finalR = baseColor[0] + (targetColor[0] - baseColor[0]) * easedProgress;
  const finalG = baseColor[1] + (targetColor[1] - baseColor[1]) * easedProgress;
  const finalB = baseColor[2] + (targetColor[2] - baseColor[2]) * easedProgress;

  return { finalSize, finalR, finalG, finalB };
}

/**
 * Utilitaires pour calculer les positions spatiales des posts
 * en fonction des positions des nœuds de type "character" dans le graphe.
 */

// Importer les passes de déformation depuis leurs modules respectifs
import {
  calculatePostPosition,
  spatializePostsAroundJoshuaNodes,
} from "./voronoiPass.js";
import { animatePostsInFlowfield } from "./flowfieldPass.js";
import { normalizePostsInSphere } from "./spherizePass.js";
import { applyRadialDisplacement } from "./displacementPass.js";

/**
 * Calcule une couleur pour un post en fonction de différents critères
 *
 * @param {Object} post - Le post pour lequel calculer la couleur
 * @param {Array} allPosts - Liste de tous les posts (pour contexte)
 * @param {Object} options - Options de calcul
 * @param {boolean} options.useUniqueColorsPerCharacter - Si true, attribue une couleur unique par personnage (défaut: true)
 * @returns {Array} Couleur RGB [r, g, b] avec valeurs entre 0 et 1
 */
export function calculatePostColor(post, allPosts, options = {}) {
  const useUniqueColorsPerCharacter =
    options.useUniqueColorsPerCharacter !== undefined
      ? options.useUniqueColorsPerCharacter
      : true;

  // Si le post a déjà une couleur, l'utiliser
  if (post.color && Array.isArray(post.color) && post.color.length >= 3) {
    return post.color;
  }

  // Si on utilise des couleurs uniques par personnage, calculer une couleur basée sur le slug
  if (useUniqueColorsPerCharacter && post.slug) {
    return generateCharacterColor(post.slug, post.isJoshuaCharacter, options);
  }

  // Couleur par défaut pour les posts sans caractère ou sans couleur spécifique
  return [0.8, 0.4, 0.0]; // Orange
}

/**
 * Génère une couleur unique pour un personnage basée sur son slug
 *
 * @param {string} slug - Identifiant unique du personnage
 * @param {boolean} isJoshua - Si le personnage est Joshua
 * @param {Object} options - Options de génération
 * @returns {Array} Couleur RGB [r, g, b] avec valeurs entre 0 et 1
 */
export function generateCharacterColor(slug, isJoshua = false, options = {}) {
  if (!slug) {
    return [0.8, 0.4, 0.0]; // Orange par défaut
  }

  // Utiliser une teinte fixe pour les personnages Joshua si spécifié
  if (isJoshua && options.joshuaColor) {
    return options.joshuaColor;
  }

  // Convertir le slug en nombre pour déterminer la teinte
  const hash = slug.split("").reduce((hash, char) => {
    return (hash * 31 + char.charCodeAt(0)) & 0xffffffff;
  }, 0);

  // Utiliser le hash pour générer une teinte entre 0 et 360
  let hue = (hash % 360) / 360;

  // Pour les personnages Joshua, utiliser une gamme de couleurs différente
  if (isJoshua) {
    // Restreindre à des teintes rouges-oranges pour Joshua
    hue = (hash % 60) / 360 + 0 / 360; // Entre 0 (rouge) et 60 (jaune)
  }

  // Convertir HSL en RGB
  const saturation = isJoshua ? 0.8 : 0.7; // Plus saturé pour Joshua
  const lightness = isJoshua ? 0.5 : 0.45; // Plus lumineux pour Joshua

  const rgb = hslToRgb(hue, saturation, lightness);
  return rgb;
}

/**
 * Convertit une couleur HSL en RGB
 *
 * @param {number} h - Teinte (0-1)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Luminosité (0-1)
 * @returns {Array} Tableau [r, g, b] avec valeurs entre 0 et 1
 */
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // Achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [r, g, b];
}

// Exporter les fonctions des passes pour les rendre disponibles via ce module
export {
  calculatePostPosition,
  spatializePostsAroundJoshuaNodes,
  animatePostsInFlowfield,
  normalizePostsInSphere,
  applyRadialDisplacement,
};

/**
 * Met à jour les positions des posts dans le contexte
 * Applique toutes les passes de déformation dans l'ordre :
 * 1. Voronoi (spatialisation autour des noeuds)
 * 2. Flowfield (animation dans un champ de vecteurs)
 * 3. Spherize (normalisation des positions dans une sphère)
 * 4. Displacement (déplacement radial avec bruit de Perlin)
 *
 * @param {Array} postsData - Liste des posts à traiter
 * @param {Object} graphData - Données du graphe avec les nœuds
 * @param {Object} options - Options de traitement
 * @param {Function} updateCallback - Callback à appeler avec les posts mis à jour
 * @returns {Array} Posts avec coordonnées mises à jour
 */
export function updatePostsPositionsInContext(
  postsData,
  graphData,
  options = {},
  updateCallback = null
) {
  // Extraire les tableaux des posts et des nœuds selon le format des données
  const posts = Array.isArray(postsData) ? postsData : postsData?.posts || [];

  // Si des nœuds personnalisés sont fournis, les utiliser directement
  if (options.customNodes && Array.isArray(options.customNodes)) {
    console.log(
      `Utilisation de ${options.customNodes.length} nœuds personnalisés pour la mise à jour des positions`
    );

    // Spatialiser les posts autour des nœuds personnalisés
    const initialPosts = spatializePostsAroundJoshuaNodes(posts, [], {
      ...options,
      customNodes: options.customNodes,
    });

    // Continuer avec le traitement normal
    return processPostsForVisualization(initialPosts, options, updateCallback);
  }

  // Sinon, extraire les nœuds du graphe comme avant
  let nodes = [];
  if (Array.isArray(graphData)) {
    nodes = graphData;
  } else if (graphData?.nodes) {
    nodes = graphData.nodes;
  } else if (graphData?.graphData?.nodes) {
    nodes = graphData.graphData.nodes;
  }

  if (nodes.length === 0) {
    console.error("Aucun nœud trouvé dans les données du graphe");
    return posts;
  }

  console.log(
    `Mise à jour des positions de ${posts.length} posts avec ${nodes.length} nœuds du graphe`
  );

  // Spatialiser les posts autour des nœuds Joshua
  const initialPosts = spatializePostsAroundJoshuaNodes(posts, nodes, options);

  // Continuer le traitement (flowfield, normalisation, etc.)
  return processPostsForVisualization(initialPosts, options, updateCallback);
}

/**
 * Fonction utilitaire pour traiter les posts après la spatialisation initiale
 * (gère flowfield, normalisation, etc.)
 */
function processPostsForVisualization(initialPosts, options, updateCallback) {
  // Options pour les différentes passes
  const useFlowfield =
    options.useFlowfield !== undefined ? options.useFlowfield : true;
  const normalizeInSphere =
    options.normalizeInSphere !== undefined ? options.normalizeInSphere : true;
  const useDisplacement =
    options.useDisplacement !== undefined ? options.useDisplacement : true;

  // Chaîner les traitements de manière asynchrone
  let promise = Promise.resolve(initialPosts);

  // 1. Étape de flowfield si activée
  if (useFlowfield && options.flowFrames > 0) {
    promise = promise.then((posts) => {
      console.log(
        `Animation flowfield avec ${options.flowFrames} frames, échelle ${options.flowScale}, force ${options.flowStrength}`
      );
      return animatePostsInFlowfield(posts, {
        frames: options.flowFrames,
        flowScale: options.flowScale,
        flowStrength: options.flowStrength,
      });
    });
  }

  // 2. Étape de normalisation sphérique si activée
  if (normalizeInSphere) {
    promise = promise.then((posts) => {
      console.log(
        `Normalisation sphérique avec rayon ${options.sphereRadius}, exposant ${options.volumeExponent}`
      );
      return normalizePostsInSphere(posts, {
        sphereRadius: options.sphereRadius,
        volumeExponent: options.volumeExponent,
        minRadius: options.minRadius,
        jitter: options.jitter,
      });
    });
  }

  // 3. Étape de déplacement radial avec bruit de Perlin si activée
  if (useDisplacement) {
    promise = promise.then((posts) => {
      console.log(
        `Déplacement radial avec intensité ${
          options.displacementIntensity || 10
        }, fréquence ${options.displacementFrequency || 0.05}`
      );
      return applyRadialDisplacement(posts, {
        intensity: options.displacementIntensity || 10,
        frequency: options.displacementFrequency || 0.05,
        seed: options.displacementSeed || 42,
        center: options.center || { x: 0, y: 0, z: 0 },
        minRadius: options.displacementMinRadius || 0,
      });
    });
  }

  // Traitement final et mise à jour du callback
  promise
    .then((finalizedPosts) => {
      console.log(`Traitement complet de ${finalizedPosts.length} posts`);

      // Si une fonction de rappel est fournie, appeler avec les posts finalisés
      if (typeof updateCallback === "function") {
        updateCallback(finalizedPosts);
      }

      return finalizedPosts;
    })
    .catch((error) => {
      console.error("Erreur lors du traitement des posts:", error);
      return initialPosts;
    });

  return initialPosts;
}

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
// Import du fichier de test
import { testDisplacement } from "./testDisplacement.js";

// Vérifier immédiatement si la fonction de déplacement est correctement importée
console.log("VÉRIFICATION DE L'IMPORT DU DÉPLACEMENT DANS POSTSPOSITIONUTILS");
console.log(
  `La fonction applyRadialDisplacement est de type: ${typeof applyRadialDisplacement}`
);

// Appel du test pour vérifier le fonctionnement du déplacement
testDisplacement()
  .then((result) => {
    console.log("TEST DE DÉPLACEMENT TERMINÉ DEPUIS POSTSPOSITIONUTILS");
  })
  .catch((error) => {
    console.error("ERREUR LORS DU TEST:", error);
  });

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
 * @returns {Promise<Array>} Promise résolue avec les posts mis à jour
 */
export async function updatePostsPositionsInContext(
  postsData,
  graphData,
  options = {},
  updateCallback = null
) {
  // Extraire les tableaux des posts et des nœuds selon le format des données
  const posts = Array.isArray(postsData) ? postsData : postsData?.posts || [];

  try {
    console.log(
      "Démarrage de la mise à jour des positions pour",
      posts.length,
      "posts"
    );

    // Préparer les nœuds à utiliser pour la spatialisation
    let nodes = [];
    let useCustomNodes = false;

    // Si des nœuds personnalisés sont fournis, les utiliser directement
    if (options.customNodes && Array.isArray(options.customNodes)) {
      console.log(
        `Utilisation de ${options.customNodes.length} nœuds personnalisés pour la mise à jour des positions`
      );
      nodes = options.customNodes;
      useCustomNodes = true;
    } else {
      // Sinon, extraire les nœuds du graphe comme avant
      if (Array.isArray(graphData)) {
        nodes = graphData;
      } else if (graphData?.nodes) {
        nodes = graphData.nodes;
      } else if (graphData?.graphData?.nodes) {
        nodes = graphData.graphData.nodes;
      }
    }

    if (nodes.length === 0) {
      console.error("Aucun nœud trouvé dans les données du graphe");
      return posts;
    }

    console.log(
      `Mise à jour des positions de ${posts.length} posts avec ${nodes.length} nœuds`
    );

    // Vérifier si on utilise le système de passes
    const passes = options.passes || [];

    if (passes.length > 0) {
      console.log(
        `Utilisation du système de passes avec ${passes.length} passes configurées`
      );

      // Traiter toutes les passes configurées, en commençant par voronoi
      return await processPostsWithPasses(
        posts,
        nodes,
        options,
        updateCallback,
        useCustomNodes
      );
    } else {
      // Ancien système: spatialiser puis traiter
      console.log(
        "Mode legacy: Spatialisation initiale puis traitement séquentiel"
      );

      // Spatialiser les posts autour des nœuds Joshua (voronoi initial)
      const initialPosts = spatializePostsAroundJoshuaNodes(
        posts,
        useCustomNodes ? [] : nodes,
        {
          ...options,
          customNodes: useCustomNodes ? nodes : undefined,
        }
      );

      // Continuer avec le traitement asynchrone complet
      return await processPostsForVisualization(
        initialPosts,
        options,
        updateCallback
      );
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour des positions:", error);
    return posts;
  }
}

/**
 * Nouveau processus qui traite toutes les passes configurées, y compris la passe voronoi
 *
 * @param {Array} posts - Les posts à traiter
 * @param {Array} nodes - Les nœuds à utiliser pour la spatialisation
 * @param {Object} options - Options de traitement
 * @param {Function} updateCallback - Fonction de rappel pour mettre à jour les posts
 * @param {boolean} useCustomNodes - Si true, utilise les nœuds personnalisés
 * @returns {Promise<Array>} Promise résolue avec les posts traités
 */
async function processPostsWithPasses(
  posts,
  nodes,
  options,
  updateCallback,
  useCustomNodes = false
) {
  try {
    console.log("=== DÉBUT DU PROCESSUS DE SPATIALISATION AVEC PASSES ===");
    console.log(
      `Démarrage avec ${posts.length} posts et ${nodes.length} nœuds`
    );

    // Tableau de passes à exécuter
    const passes = options.passes || [];
    console.log(`Traitement séquentiel de ${passes.length} passes configurées`);

    // Variable pour suivre les posts à travers les transformations
    let processedPosts = posts;

    // Exécuter chaque passe dans l'ordre défini
    for (let i = 0; i < passes.length; i++) {
      const pass = passes[i];

      // Ignorer les passes désactivées
      if (!pass.enabled) {
        console.log(
          `Passe "${pass.name}" [${i + 1}/${
            passes.length
          }] désactivée - ignorée`
        );
        continue;
      }

      console.log(
        `=== EXÉCUTION DE LA PASSE "${pass.name}" [${i + 1}/${
          passes.length
        }] ===`
      );

      // Exécuter la passe appropriée en fonction de son nom
      switch (pass.name.toLowerCase()) {
        case "voronoi":
          console.log(
            `Spatialisation voronoi avec échelle ${pass.config.perlinScale}, amplitude ${pass.config.perlinAmplitude}, dilatation ${pass.config.dilatationFactor}`
          );

          // Appliquer la spatialisation voronoi
          processedPosts = spatializePostsAroundJoshuaNodes(
            processedPosts,
            useCustomNodes ? [] : nodes,
            {
              // Options générales
              joshuaOnly: options.joshuaOnly,
              preserveOtherPositions: options.preserveOtherPositions,
              radius: options.radius,
              minDistance: options.minDistance,
              verticalSpread: options.verticalSpread,
              horizontalSpread: options.horizontalSpread,

              // Options spécifiques à voronoi
              perlinScale: pass.config.perlinScale,
              perlinAmplitude: pass.config.perlinAmplitude,
              dilatationFactor: pass.config.dilatationFactor,

              // Si on utilise des nœuds personnalisés
              customNodes: useCustomNodes ? nodes : undefined,
            }
          );

          console.log(
            `Voronoi terminé, ${processedPosts.length} posts spatialisés`
          );
          break;

        case "flowfield":
          console.log(
            `Animation flowfield avec ${pass.config.frames} frames, échelle ${pass.config.flowScale}, force ${pass.config.flowStrength}`
          );

          // S'assurer que frames est un nombre positif
          const frames = Math.max(1, parseInt(pass.config.frames) || 10);
          console.log(`Nombre de frames final pour flowfield: ${frames}`);

          processedPosts = await animatePostsInFlowfield(processedPosts, {
            frames: frames,
            flowScale: pass.config.flowScale,
            flowStrength: pass.config.flowStrength,
          });

          console.log(
            `Flowfield terminé, ${processedPosts.length} posts traités`
          );
          break;

        case "spherize":
          console.log(
            `Normalisation sphérique avec rayon ${pass.config.sphereRadius}, exposant ${pass.config.volumeExponent}`
          );

          processedPosts = await normalizePostsInSphere(processedPosts, {
            sphereRadius: pass.config.sphereRadius,
            volumeExponent: pass.config.volumeExponent,
            minRadius: pass.config.minRadius,
            jitter: pass.config.jitter,
          });

          console.log(
            `Sphérisation terminée, ${processedPosts.length} posts traités`
          );
          break;

        case "displacement":
          console.log(`--------> DÉMARRAGE DU DÉPLACEMENT RADIAL <--------`);
          console.log(
            `Paramètres de déplacement: 
            - Intensité: ${pass.config.intensity || 10}
            - Fréquence: ${pass.config.frequency || 0.05}
            - Seed: ${pass.config.seed || 42}
            - Min Radius: ${pass.config.minRadius || 0}`
          );

          try {
            // Vérifier l'existence de la fonction
            console.log(
              `La fonction applyRadialDisplacement est: ${typeof applyRadialDisplacement}`
            );
            console.log("Début de l'appel à applyRadialDisplacement");

            processedPosts = await applyRadialDisplacement(processedPosts, {
              intensity: pass.config.intensity || 10,
              frequency: pass.config.frequency || 0.05,
              seed: pass.config.seed || 42,
              center: pass.config.center || { x: 0, y: 0, z: 0 },
              minRadius: pass.config.minRadius || 0,
            });

            console.log("Appel à applyRadialDisplacement terminé");
          } catch (error) {
            console.error(
              "ERREUR lors de l'application du déplacement radial:",
              error
            );
          }

          console.log(
            `Déplacement terminé, ${processedPosts.length} posts traités`
          );
          break;

        default:
          console.warn(`Passe inconnue: ${pass.name} - ignorée`);
          break;
      }

      // Appeler le callback après chaque passe si configuré avec updateAfterEachPass
      if (options.updateAfterEachPass && typeof updateCallback === "function") {
        console.log(`Mise à jour intermédiaire après la passe "${pass.name}"`);
        updateCallback([...processedPosts]);
      }
    }

    console.log(`=== TRAITEMENT COMPLET: ${processedPosts.length} posts ===`);

    // Si une fonction de rappel est fournie, appeler avec les posts finalisés
    if (typeof updateCallback === "function" && !options.updateAfterEachPass) {
      // Vérifier que les posts ne sont pas undefined avant d'appeler le callback
      if (processedPosts && Array.isArray(processedPosts)) {
        console.log(
          `Application du callback avec ${processedPosts.length} posts...`
        );
        updateCallback(processedPosts);
      } else {
        console.error(
          "ERREUR: Les posts traités sont undefined ou pas un tableau!"
        );
      }
    }

    return processedPosts;
  } catch (error) {
    console.error("Erreur dans processPostsWithPasses:", error);
    return posts;
  }
}

/**
 * Fonction utilitaire pour traiter les posts après la spatialisation initiale
 * (gère flowfield, normalisation, etc.)
 *
 * @deprecated Utiliser processPostsWithPasses à la place
 */
async function processPostsForVisualization(
  initialPosts,
  options,
  updateCallback
) {
  try {
    console.log(
      "ATTENTION: Utilisation de la fonction processPostsForVisualization dépréciée"
    );
    console.log(
      "Il est recommandé d'utiliser le nouveau système de passes configurées"
    );

    // Reconstruire un tableau de passes basé sur les options legacy
    const passes = [];

    // Ajouter la passe flowfield si activée
    if (options.useFlowfield) {
      passes.push({
        name: "flowfield",
        enabled: true,
        config: {
          frames: options.flowFrames || 10,
          flowScale: options.flowScale || 0.02,
          flowStrength: options.flowStrength || 2,
        },
      });
    }

    // Ajouter la passe spherize si activée
    if (options.normalizeInSphere) {
      passes.push({
        name: "spherize",
        enabled: true,
        config: {
          sphereRadius: options.sphereRadius || 100,
          volumeExponent: options.volumeExponent || 1 / 3,
          minRadius: options.minRadius || 0,
          jitter: options.jitter || 0.1,
        },
      });
    }

    // Ajouter la passe displacement si activée
    if (options.useDisplacement) {
      passes.push({
        name: "displacement",
        enabled: true,
        config: {
          intensity: options.displacementIntensity || 10,
          frequency: options.displacementFrequency || 0.05,
          seed: options.displacementSeed || 42,
          minRadius: options.displacementMinRadius || 0,
        },
      });
    }

    // Si des passes ont été configurées, les utiliser avec le nouveau système
    if (passes.length > 0) {
      const optionsWithPasses = {
        ...options,
        passes: passes,
      };

      // Utiliser le nouveau système (sans appliquer voronoi à nouveau)
      return await processPostsWithPasses(
        initialPosts,
        [],
        optionsWithPasses,
        updateCallback,
        false
      );
    }

    // Si aucune passe n'est configurée, juste retourner les posts initiaux
    console.log(
      "Aucune passe configurée, retour des posts sans transformation"
    );

    // Si une fonction de rappel est fournie, appeler avec les posts finalisés
    if (typeof updateCallback === "function") {
      // Vérifier que les posts ne sont pas undefined avant d'appeler le callback
      if (initialPosts && Array.isArray(initialPosts)) {
        console.log(
          `Application du callback avec ${initialPosts.length} posts...`
        );
        updateCallback(initialPosts);
      }
    }

    return initialPosts;
  } catch (error) {
    console.error("Erreur dans processPostsForVisualization:", error);
    return initialPosts;
  }
}

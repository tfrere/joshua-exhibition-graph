/**
 * Utilitaires pour calculer les positions spatiales des posts
 * en fonction des positions des nœuds de type "character" dans le graphe.
 */

/**
 * Calcule une position pour un post en fonction de la position du nœud de character associé
 * et ajoute une dispersion selon l'algorithme inspiré de la dilatation Voronoi.
 *
 * @param {Object} characterNode - Le nœud character auquel appartient le post
 * @param {Object} options - Options de calcul
 * @param {number} options.radius - Rayon maximal de la dispersion autour du nœud (défaut: 15)
 * @param {number} options.minDistance - Distance minimale du nœud (défaut: 5)
 * @param {number} options.verticalSpread - Facteur de dispersion verticale (défaut: 1)
 * @param {number} options.horizontalSpread - Facteur de dispersion horizontale (défaut: 1)
 * @param {number} options.perlinScale - Échelle du bruit de Perlin (défaut: 0.05)
 * @param {number} options.perlinAmplitude - Amplitude du bruit de Perlin (défaut: 5)
 * @param {number} options.dilatationFactor - Facteur de dilatation pour l'effet Voronoï (défaut: 1.2)
 * @returns {Object} Coordonnées {x, y, z} du post
 */
export function calculatePostPosition(characterNode, options = {}) {
  if (
    !characterNode ||
    !characterNode.x ||
    !characterNode.y ||
    !characterNode.z
  ) {
    // Si le nœud n'a pas de position valide, retourner une position par défaut
    return { x: 0, y: 0, z: 0 };
  }

  // Options par défaut
  const radius = options.radius ?? 15;
  const minDistance = options.minDistance ?? 5;
  const verticalSpread = options.verticalSpread ?? 1;
  const horizontalSpread = options.horizontalSpread ?? 1;
  const perlinScale = options.perlinScale ?? 0.05;
  const perlinAmplitude = options.perlinAmplitude ?? 5;
  const dilatationFactor = options.dilatationFactor ?? 1.2;

  // Position du nœud
  const center = {
    x: characterNode.x,
    y: characterNode.y,
    z: characterNode.z,
  };

  // 1. Créer un vecteur de dispersion aléatoire (comme dans la version originale)
  const distance = minDistance + Math.random() * (radius - minDistance);
  const theta = Math.random() * Math.PI * 2; // angle horizontal
  const phi = Math.random() * Math.PI - Math.PI / 2; // angle vertical

  // Calculer la position initiale avec dispersion différente sur chaque axe
  const initialPosition = {
    x: center.x + distance * Math.cos(theta) * Math.cos(phi) * horizontalSpread,
    y: center.y + distance * Math.sin(theta) * Math.cos(phi) * horizontalSpread,
    z: center.z + distance * Math.sin(phi) * verticalSpread,
  };

  // 2. Appliquer l'effet de dilatation (inspiration Voronoi)
  // Vecteur du centre à la position initiale
  const vec = {
    x: initialPosition.x - center.x,
    y: initialPosition.y - center.y,
    z: initialPosition.z - center.z,
  };

  // Appliquer la dilatation
  const dilatedPosition = {
    x: center.x + vec.x * dilatationFactor,
    y: center.y + vec.y * dilatationFactor,
    z: center.z + vec.z * dilatationFactor,
  };

  // 3. Ajouter du bruit de type Perlin (approximation simplifiée)
  // Utiliser plusieurs fréquences pour un effet plus naturel
  const frequencies = [perlinScale, perlinScale * 2, perlinScale * 4];
  const amplitudes = [1.0, 0.5, 0.25];

  // Générer des phases aléatoires pour chaque dimension
  const phases = Array(6)
    .fill()
    .map(() => Math.random() * Math.PI * 2);

  // Calculer le bruit pour chaque dimension
  let noiseX = 0,
    noiseY = 0,
    noiseZ = 0;

  frequencies.forEach((freq, i) => {
    const amp = amplitudes[i];

    // Approximation du bruit de Perlin avec des fonctions sinus
    noiseX +=
      amp *
      Math.sin(dilatedPosition.x * freq + phases[0]) *
      Math.cos(dilatedPosition.y * freq + phases[1]);
    noiseY +=
      amp *
      Math.sin(dilatedPosition.y * freq + phases[2]) *
      Math.cos(dilatedPosition.z * freq + phases[3]);
    noiseZ +=
      amp *
      Math.sin(dilatedPosition.z * freq + phases[4]) *
      Math.cos(dilatedPosition.x * freq + phases[5]);
  });

  // Normaliser et appliquer l'amplitude
  const normalizationFactor = Math.sqrt(
    frequencies.reduce((sum, val) => sum + val, 0)
  );

  // Position finale avec bruit
  const finalPosition = {
    x: dilatedPosition.x + (noiseX / normalizationFactor) * perlinAmplitude,
    y: dilatedPosition.y + (noiseY / normalizationFactor) * perlinAmplitude,
    z: dilatedPosition.z + (noiseZ / normalizationFactor) * perlinAmplitude,
  };

  return finalPosition;
}

/**
 * Fonction utilitaire pour calculer une couleur basée sur la date du post
 * Plus le post est récent, plus la couleur sera vive
 *
 * @param {Object} post - Le post pour lequel calculer la couleur
 * @param {Object} options - Options de calcul de couleur
 * @param {number} options.minIntensity - Intensité minimale de couleur (défaut: 0.3)
 * @param {number} options.maxIntensity - Intensité maximale de couleur (défaut: 1.0)
 * @param {number} options.startTimestamp - Timestamp de début pour la normalisation (défaut: plus ancien post)
 * @param {number} options.endTimestamp - Timestamp de fin pour la normalisation (défaut: plus récent post)
 * @returns {Array} Couleur RGB [r, g, b] entre 0 et 1
 */
export function calculatePostColor(post, allPosts, options = {}) {
  const { minIntensity = 0.3, maxIntensity = 1.0 } = options;

  let { startTimestamp, endTimestamp } = options;

  // Si les timestamps ne sont pas fournis, les calculer à partir de tous les posts
  if (!startTimestamp || !endTimestamp) {
    const timestamps = allPosts
      .filter((p) => p.timestamp)
      .map((p) => p.timestamp);

    startTimestamp = startTimestamp || Math.min(...timestamps);
    endTimestamp = endTimestamp || Math.max(...timestamps);
  }

  const timeRange = endTimestamp - startTimestamp;

  // Si pas de timestamp valide ou plage de temps nulle, retourner une couleur par défaut
  if (!post.timestamp || timeRange <= 0) {
    return [0.8, 0.4, 0.0]; // Couleur orange par défaut
  }

  // Normaliser le timestamp entre 0 et 1
  const normalizedTime = (post.timestamp - startTimestamp) / timeRange;

  // Calculer l'intensité en fonction du temps (les posts plus récents sont plus vifs)
  const intensity =
    minIntensity + normalizedTime * (maxIntensity - minIntensity);

  // Générer une couleur basée sur l'intensité
  // On peut personnaliser cette logique en fonction des besoins spécifiques
  return [
    0.9 * intensity, // Rouge
    0.4 * intensity, // Vert
    0.1 * intensity, // Bleu
  ];
}

/**
 * Génère une couleur unique par personnage en se basant sur son slug
 * La couleur sera cohérente à chaque appel pour le même personnage
 *
 * @param {string} slug - L'identifiant unique du personnage
 * @param {boolean} isJoshua - Si le personnage est un personnage Joshua
 * @param {Object} options - Options de génération de couleurs
 * @param {number} options.saturation - Saturation de la couleur (défaut: 0.8)
 * @param {number} options.lightness - Luminosité de la couleur (défaut: 0.5)
 * @param {number} options.joshuaSaturation - Saturation pour les personnages Joshua (défaut: 0.9)
 * @param {number} options.joshuaLightness - Luminosité pour les personnages Joshua (défaut: 0.6)
 * @returns {Array} Couleur RGB [r, g, b] entre 0 et 1
 */
export function generateCharacterColor(slug, isJoshua = false, options = {}) {
  // Options par défaut
  const {
    saturation = 0.8,
    lightness = 0.5,
    joshuaSaturation = 0.9,
    joshuaLightness = 0.6,
  } = options;

  // Utiliser le slug pour générer un nombre déterministe
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = (hash << 5) - hash + slug.charCodeAt(i);
    hash = hash & hash; // Convertir en entier 32 bits
  }

  // Normaliser la valeur de hachage en une valeur entre 0 et 1
  const normalizedHash = Math.abs(hash) / 2147483647;

  // Choisir une teinte (hue) basée sur la valeur de hachage (0-360 degrés)
  const hue = normalizedHash * 360;

  // Ajuster la saturation et la luminosité selon le type de personnage
  const finalSaturation = isJoshua ? joshuaSaturation : saturation;
  const finalLightness = isJoshua ? joshuaLightness : lightness;

  // Convertir HSL en RGB
  return hslToRgb(hue / 360, finalSaturation, finalLightness);
}

/**
 * Convertit une couleur HSL en RGB
 * Source: https://stackoverflow.com/questions/2353211
 *
 * @param {number} h - Teinte (0-1)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Luminosité (0-1)
 * @returns {Array} Couleur RGB [r, g, b] entre 0 et 1
 */
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // Niveau de gris
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

/**
 * Spatialise les posts spécifiquement autour des noeuds marqués comme isJoshua=true.
 * Cette fonction réorganise uniquement les posts liés aux personnages Joshua en
 * utilisant les positions actuelles de ces noeuds dans le graphe et l'algorithme
 * inspiré de la dilatation Voronoi.
 *
 * @param {Array} posts - Liste des posts à spatialiser
 * @param {Array} nodes - Liste des nœuds du graphe avec leurs positions actuelles
 * @param {Object} options - Options de spatialisation
 * @param {boolean} options.joshuaOnly - Si true, ne repositionne que les posts des personnages Joshua (défaut: true)
 * @param {boolean} options.preserveOtherPositions - Si true, préserve les positions existantes des posts non-Joshua (défaut: true)
 * @param {number} options.radius - Rayon maximal de dispersion (défaut: 15)
 * @param {number} options.minDistance - Distance minimale du nœud (défaut: 5)
 * @param {number} options.verticalSpread - Facteur de dispersion verticale (défaut: 1)
 * @param {number} options.horizontalSpread - Facteur de dispersion horizontale (défaut: 1)
 * @param {number} options.perlinScale - Échelle du bruit de Perlin (défaut: 0.05)
 * @param {number} options.perlinAmplitude - Amplitude du bruit de Perlin (défaut: 5)
 * @param {number} options.dilatationFactor - Facteur de dilatation pour l'effet Voronoï (défaut: 1.2)
 * @param {boolean} options.useUniqueColorsPerCharacter - Si true, attribue une couleur unique par personnage (défaut: true)
 * @returns {Array} Posts spatialisés avec coordonnées mises à jour
 */
export function spatializePostsAroundJoshuaNodes(posts, nodes, options = {}) {
  const {
    joshuaOnly = true,
    preserveOtherPositions = true,
    // Options de positionnement pour les posts
    radius = 15,
    minDistance = 5,
    verticalSpread = 1,
    horizontalSpread = 1,
    // Nouveaux paramètres de l'algorithme Voronoi
    perlinScale = 0.05,
    perlinAmplitude = 5,
    dilatationFactor = 1.2,
    // Option pour les couleurs uniques par personnage
    useUniqueColorsPerCharacter = true,
  } = options;

  // Créer un index des nœuds par slug pour un accès rapide
  const nodesMap = {};

  // Index des nœuds de personnages
  const characterNodesMap = {};

  // Identifier spécifiquement les noeuds Joshua
  const joshuaCharacterSlugs = new Set();

  nodes.forEach((node) => {
    // Indexer tous les nœuds par slug
    if (node.slug) {
      nodesMap[node.slug] = node;

      // Indexer les nœuds de type character
      if (node.type === "character") {
        characterNodesMap[node.slug] = node;

        // Si le noeud est marqué comme Joshua, l'ajouter à l'ensemble
        if (node.isJoshua === true) {
          joshuaCharacterSlugs.add(node.slug);
        }
      }
    }
  });

  console.log(
    `Nombre de personnages Joshua identifiés: ${joshuaCharacterSlugs.size}`
  );

  // Cache pour les couleurs générées par personnage
  const characterColorCache = {};

  // Positionner chaque post en fonction de son slug (identifiant du personnage)
  return posts.map((post) => {
    // Utiliser le slug du post pour trouver le nœud correspondant
    const slug = post.slug;

    if (!slug) {
      console.warn("Post sans slug:", post);
      return post; // Conserver le post intact s'il n'a pas de slug
    }

    // Chercher d'abord dans les nœuds de type character
    let characterNode = characterNodesMap[slug];

    // Si aucun nœud character n'est trouvé, chercher dans tous les nœuds
    if (!characterNode) {
      characterNode = nodesMap[slug];
    }

    // Vérifier si ce post appartient à un personnage Joshua
    // Soit via la propriété ajoutée lors du chargement, soit via le Set de slugs
    const isJoshuaPost =
      post.isJoshuaCharacter === true || joshuaCharacterSlugs.has(slug);

    // Si joshuaOnly est true, on ne repositionne que les posts des personnages Joshua
    // Si preserveOtherPositions est true, on conserve les positions existantes des autres posts
    if (joshuaOnly && !isJoshuaPost && preserveOtherPositions) {
      return post; // Conserver le post intact
    }

    // Générer ou récupérer la couleur unique pour ce personnage
    let color = post.color;
    if (useUniqueColorsPerCharacter && slug) {
      // Vérifier si on a déjà généré une couleur pour ce personnage
      if (!characterColorCache[slug]) {
        characterColorCache[slug] = generateCharacterColor(slug, isJoshuaPost);
      }
      color = characterColorCache[slug];
    }

    // Si un nœud correspondant existe et (c'est un Joshua ou on traite tous les characters)
    if (characterNode && (!joshuaOnly || isJoshuaPost)) {
      const postOptions = {
        radius,
        minDistance,
        verticalSpread,
        horizontalSpread,
        // Transmettre également les nouveaux paramètres
        perlinScale,
        perlinAmplitude,
        dilatationFactor,
      };

      // Calculer de nouvelles coordonnées pour ce post avec l'algorithme Voronoi
      const coordinates = calculatePostPosition(characterNode, postOptions);

      return {
        ...post,
        coordinates,
        color, // Ajouter la couleur générée/cachée
      };
    }

    // Si on arrive ici et le post n'a pas de coordonnées, on en crée par défaut
    if (!post.coordinates) {
      return {
        ...post,
        coordinates: { x: 0, y: 0, z: 0 },
        color, // Ajouter la couleur générée/cachée même si on ne change pas les positions
      };
    }

    // Sinon, retourner le post avec sa couleur mise à jour
    return {
      ...post,
      color,
    };
  });
}

/**
 * Met à jour directement les positions des posts en utilisant les nœuds du graphe déjà chargés
 * Cette fonction est conçue pour être utilisée avec les données déjà en mémoire
 *
 * @param {Array|Object} postsData - Données des posts à mettre à jour (peut être un tableau ou l'état du contexte)
 * @param {Array|Object} graphData - Données du graphe avec les positions des nœuds (peut être un tableau ou l'état du contexte)
 * @param {Object} options - Options de spatialisation
 * @param {Function} updateCallback - Fonction à appeler avec les posts mis à jour (ex: setPostsData)
 */
export function updatePostsPositionsInContext(
  postsData,
  graphData,
  options = {},
  updateCallback = null
) {
  // Extraire les tableaux des posts et des nœuds selon le format des données
  const posts = Array.isArray(postsData) ? postsData : postsData?.posts || [];

  // Extraire les nœuds du graphe
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
    `Mise à jour des positions de ${posts.length} posts avec ${nodes.length} nœuds`
  );

  // Spatialiser les posts autour des nœuds Joshua
  const updatedPosts = spatializePostsAroundJoshuaNodes(posts, nodes, options);

  // Si une fonction de rappel est fournie, l'appeler avec les posts mis à jour
  if (typeof updateCallback === "function") {
    updateCallback(updatedPosts);
  }

  return updatedPosts;
}

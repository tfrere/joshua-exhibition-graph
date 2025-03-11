/**
 * Module pour la passe de déformation Voronoi
 * Cette passe applique une dilatation des positions autour des nœuds
 * centraux avec un effet voronoi, qui crée des clusters distincts
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
 * @param {boolean} options.useVoronoi - Si true, applique l'effet de dilatation Voronoi (défaut: true)
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
  const useVoronoi =
    options.useVoronoi !== undefined ? options.useVoronoi : true;

  // Position du nœud
  const center = {
    x: characterNode.x,
    y: characterNode.y,
    z: characterNode.z,
  };

  // Générer un angle et une distance aléatoires pour une répartition uniforme dans l'espace
  const theta = Math.random() * Math.PI * 2; // Angle horizontal (0-2π)
  const phi = Math.acos(2 * Math.random() - 1); // Angle vertical (0-π)

  // Générer une distance entre minDistance et radius avec distribution en r^2
  // pour une répartition uniforme dans l'espace
  const r = minDistance + Math.sqrt(Math.random()) * (radius - minDistance);

  // Calculer les coordonnées sphériques puis les convertir en cartésiennes
  let dx = r * Math.sin(phi) * Math.cos(theta) * horizontalSpread;
  let dy = r * Math.sin(phi) * Math.sin(theta) * horizontalSpread;
  let dz = r * Math.cos(phi) * verticalSpread;

  // Appliquer l'effet de dilatation Voronoi si activé
  if (useVoronoi) {
    // Utiliser une approximation du bruit de Perlin avec des fonctions trigonométriques
    // pour ajouter un aspect organique à la dilatation
    const seed = (characterNode.id || "")
      .toString()
      .split("")
      .reduce((a, b) => {
        return a + b.charCodeAt(0);
      }, 0);

    // Utiliser des fonctions trigonométriques pour simuler un bruit de Perlin
    const perlinX = Math.sin(center.x * perlinScale + seed) * perlinAmplitude;
    const perlinY =
      Math.sin(center.y * perlinScale + seed * 2) * perlinAmplitude;
    const perlinZ =
      Math.sin(center.z * perlinScale + seed * 3) * perlinAmplitude;

    // Calculer le coefficient de dilatation basé sur le "bruit de Perlin"
    // et la position du caractère dans l'espace
    const distanceFromOrigin = Math.sqrt(
      center.x * center.x + center.y * center.y + center.z * center.z
    );

    // Régler le facteur de dilatation en fonction de la distance et du bruit
    const dilatation =
      dilatationFactor *
      (1 +
        0.2 *
          Math.sin(distanceFromOrigin * 0.01 + perlinX + perlinY + perlinZ));

    // Appliquer la dilatation aux décalages
    dx *= dilatation;
    dy *= dilatation;
    dz *= dilatation;
  }

  // Appliquer les décalages à la position du nœud
  const result = {
    x: center.x + dx,
    y: center.y + dy,
    z: center.z + dz,
  };

  return result;
}

/**
 * Spatialise les posts autour des nœuds Joshua en utilisant l'effet Voronoi
 *
 * @param {Array} posts - Liste des posts à spatialiser
 * @param {Array} nodes - Liste des nœuds du graphe
 * @param {Object} options - Options de spatialisation
 * @param {boolean} options.joshuaOnly - Si true, ne spatialiser que les posts des personnages Joshua (défaut: true)
 * @param {boolean} options.preserveOtherPositions - Si true, préserver les positions des posts non spatialisés (défaut: true)
 * @param {number} options.radius - Rayon de dispersion (défaut: 15)
 * @param {number} options.minDistance - Distance minimale du nœud (défaut: 5)
 * @param {number} options.verticalSpread - Facteur de dispersion verticale (défaut: 1)
 * @param {number} options.horizontalSpread - Facteur de dispersion horizontale (défaut: 1)
 * @param {number} options.perlinScale - Échelle du bruit de Perlin (défaut: 0.05)
 * @param {number} options.perlinAmplitude - Amplitude du bruit de Perlin (défaut: 5)
 * @param {number} options.dilatationFactor - Facteur de dilatation Voronoi (défaut: 1.2)
 * @param {boolean} options.useVoronoi - Si true, applique l'effet de dilatation Voronoi (défaut: true)
 * @param {boolean} options.useUniqueColorsPerCharacter - Si true, attribue une couleur unique par personnage (défaut: true)
 * @param {Array} options.customNodes - Nœuds personnalisés avec leurs positions actuelles, utilisés à la place des nœuds standards
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
    useVoronoi = true,
    // Option pour les couleurs uniques par personnage
    useUniqueColorsPerCharacter = true,
    // Nœuds personnalisés avec positions actuelles de la simulation
    customNodes = null,
  } = options;

  // Utiliser les nœuds personnalisés s'ils sont fournis, sinon utiliser les nœuds standards
  const nodesData = customNodes || nodes;

  console.log(
    `Spatialisation des posts: utilisation de ${
      customNodes ? "nœuds personnalisés" : "nœuds standards"
    } (${nodesData.length} nœuds)`
  );

  if (nodesData.length === 0) {
    console.warn("Aucun nœud disponible pour la spatialisation des posts");
    return posts;
  }

  // Afficher tous les nœuds au lieu de seulement 5
  if (nodesData.length > 0) {
    console.log(
      "Nœuds pour spatialisation:",
      nodesData.map((n) => ({
        id: n.id,
        slug: n.slug,
        type: n.type,
        isJoshua: n.isJoshua,
        pos: [Math.round(n.x), Math.round(n.y), Math.round(n.z)],
      }))
    );
  }

  // Créer un index des nœuds par slug ET par id pour un accès rapide
  const nodesMap = {};
  const nodesByIdMap = {};

  // Index des nœuds de personnages
  const characterNodesMap = {};

  // Identifier spécifiquement les noeuds Joshua
  const joshuaCharacterSlugs = new Set();
  const joshuaCharacterIds = new Set();

  nodesData.forEach((node) => {
    // Indexer tous les nœuds par id et par slug
    if (node.id) {
      nodesByIdMap[node.id] = node;
    }

    if (node.slug) {
      nodesMap[node.slug] = node;
    }

    // Si le nœud est un personnage, l'ajouter à l'index des personnages
    if (
      node.type === "character" ||
      (node.id && typeof node.id === "string" && node.id.includes("-"))
    ) {
      if (node.slug) {
        characterNodesMap[node.slug] = node;
      }

      // Identifier les personnages Joshua
      if (node.isJoshua === true || node.slug === "real-joshua-goldberg") {
        if (node.slug) joshuaCharacterSlugs.add(node.slug);
        if (node.id) joshuaCharacterIds.add(node.id);
      }
    }
  });

  console.log(
    `Nombre de personnages Joshua identifiés: ${joshuaCharacterSlugs.size} (par slug) et ${joshuaCharacterIds.size} (par id)`
  );

  // Créer une copie profonde des posts pour éviter de modifier l'original
  const spatializedPosts = JSON.parse(JSON.stringify(posts));

  // Traiter chaque post
  spatializedPosts.forEach((post) => {
    // Déterminer si c'est un post "Joshua"
    const isJoshuaPost =
      post.isJoshuaCharacter === true ||
      (post.slug && joshuaCharacterSlugs.has(post.slug)) ||
      (post.character && joshuaCharacterIds.has(post.character));

    // Si on veut seulement les posts Joshua et que ce n'est pas un post Joshua, passer
    if (joshuaOnly && !isJoshuaPost) {
      // Si on veut préserver les positions, ne rien faire
      if (preserveOtherPositions) {
        return;
      }
    }

    // Trouver le nœud correspondant à ce post (priorité au slug, puis au character)
    let characterNode = null;

    if (post.slug && characterNodesMap[post.slug]) {
      characterNode = characterNodesMap[post.slug];
    } else if (post.character) {
      // Essayer d'abord comme slug
      if (characterNodesMap[post.character]) {
        characterNode = characterNodesMap[post.character];
      }
      // Puis comme id
      else if (nodesByIdMap[post.character]) {
        characterNode = nodesByIdMap[post.character];
      }
    }

    // Si on a trouvé un nœud de caractère pour ce post, calculer sa position
    if (characterNode) {
      const postPosition = calculatePostPosition(characterNode, {
        radius,
        minDistance,
        verticalSpread,
        horizontalSpread,
        perlinScale,
        perlinAmplitude,
        dilatationFactor,
        useVoronoi,
      });

      // Mettre à jour les coordonnées du post
      post.coordinates = postPosition;
    }
  });

  return spatializedPosts;
}

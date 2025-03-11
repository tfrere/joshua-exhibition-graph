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
 * @param {boolean} options.applyDispersion - Si true, applique la dispersion autour du nœud (défaut: true)
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
  const dilatationFactor =
    options.dilatationFactor !== undefined ? options.dilatationFactor : 1.2;
  const useVoronoi =
    options.useVoronoi !== undefined ? options.useVoronoi : true;
  const applyDispersion =
    options.applyDispersion !== undefined ? options.applyDispersion : true;

  // Si on ne veut pas appliquer de dispersion, retourner simplement la position du nœud
  if (!applyDispersion) {
    return {
      x: characterNode.x,
      y: characterNode.y,
      z: characterNode.z,
    };
  }

  // Position du nœud
  const nodeX = characterNode.x;
  const nodeY = characterNode.y;
  const nodeZ = characterNode.z;

  // Générer une dispersion aléatoire autour du nœud
  // Au lieu de dispersion totalement aléatoire, utiliser une version simplifiée de "bruit de Perlin"
  // (nous n'avons pas accès à une vraie implémentation ici)
  const seed = nodeX * 1000 + nodeY * 100 + nodeZ * 10; // Utiliser la position comme seed
  const pseudoRandom = (val) =>
    (Math.sin(val * 12.9898 + seed * 78.233) * 43758.5453) % 1;

  // Calculer des valeurs "pseudo-aléatoires" mais déterministes pour ce nœud
  const theta = pseudoRandom(nodeX) * Math.PI * 2; // Angle horizontal (0-2π)
  const phi = pseudoRandom(nodeY) * Math.PI; // Angle vertical (0-π)

  // Calculer une distance entre minDistance et radius
  const distance = minDistance + pseudoRandom(nodeZ) * (radius - minDistance);

  // Calculer la dispersion sphérique
  let x = nodeX + Math.sin(phi) * Math.cos(theta) * distance * horizontalSpread;
  let y = nodeY + Math.sin(phi) * Math.sin(theta) * distance * horizontalSpread;
  let z = nodeZ + Math.cos(phi) * distance * verticalSpread;

  // Ajouter du "bruit" façon Perlin pour éviter les distributions trop régulières
  if (perlinScale > 0 && perlinAmplitude > 0) {
    const noiseX =
      Math.sin(x * perlinScale) * Math.cos(y * perlinScale) * perlinAmplitude;
    const noiseY =
      Math.sin(y * perlinScale) * Math.cos(z * perlinScale) * perlinAmplitude;
    const noiseZ =
      Math.sin(z * perlinScale) * Math.cos(x * perlinScale) * perlinAmplitude;

    x += noiseX;
    y += noiseY;
    z += noiseZ;
  }

  // Appliquer l'effet de dilatation Voronoi si activé
  if (useVoronoi && dilatationFactor !== 1) {
    // La dilatation augmente la distance au centre proportionnellement
    const dx = x - nodeX;
    const dy = y - nodeY;
    const dz = z - nodeZ;

    // Calculer la nouvelle position dilatée
    x = nodeX + dx * dilatationFactor;
    y = nodeY + dy * dilatationFactor;
    z = nodeZ + dz * dilatationFactor;
  }

  // Retourner les coordonnées calculées
  return { x, y, z };
}

/**
 * Spatialise les posts autour des nœuds Joshua en utilisant l'algorithme de dispersion Voronoi.
 * Cette fonction utilise une approche en deux phases :
 * 1. Positionner d'abord chaque post exactement aux coordonnées de son personnage
 * 2. Appliquer ensuite l'effet de dispersion et dilatation Voronoi
 *
 * @param {Array} posts - Liste des posts à spatialiser
 * @param {Array} nodes - Liste des nœuds du graphe avec leurs positions
 * @param {Object} options - Options de spatialisation
 * @param {boolean} options.joshuaOnly - Si true, ne traite que les posts liés à Joshua (défaut: true)
 * @param {boolean} options.preserveOtherPositions - Si true, ne modifie pas les positions des posts non-Joshua (défaut: true)
 * @param {boolean} options.twoPhases - Si true, effectue le traitement en deux phases (défaut: true)
 * @param {number} options.radius - Rayon de dispersion (défaut: 15)
 * @param {number} options.minDistance - Distance minimale du nœud (défaut: 5)
 * @param {number} options.verticalSpread - Facteur de dispersion verticale (défaut: 1.5)
 * @param {number} options.horizontalSpread - Facteur de dispersion horizontale (défaut: 1.5)
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
    twoPhases = true,
    // Options de positionnement pour les posts
    radius = 15,
    minDistance = 5,
    verticalSpread = 1.5,
    horizontalSpread = 1.5,
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
  const characterNodesMap = {}; // Map des nœuds par slug
  const nodesByIdMap = {}; // Map des nœuds par id
  const joshuaCharacterSlugs = new Set(); // Ensemble des slugs des personnages Joshua
  const joshuaCharacterIds = new Set(); // Ensemble des IDs des personnages Joshua

  // Compteurs pour le debugging
  let characterNodesCount = 0;
  let nodesWithSlugCount = 0;
  let nodesWithIdCount = 0;

  nodesData.forEach((node) => {
    // Vérifier et logguer des détails pour le debugging
    if (!node) {
      console.warn("Nœud null détecté et ignoré");
      return;
    }

    if (typeof node !== "object") {
      console.warn(`Nœud non-objet détecté et ignoré: ${typeof node}`);
      return;
    }

    // Compter les nœuds avec attributs importants
    if (node.type === "character") characterNodesCount++;
    if (node.slug) nodesWithSlugCount++;
    if (node.id) nodesWithIdCount++;

    // Indexer le nœud par son ID si disponible
    if (node.id) {
      nodesByIdMap[node.id] = node;
    }

    // Si le nœud est un personnage OU a un slug, l'ajouter à l'index des personnages
    // Relaxation des critères pour inclure plus de nœuds
    if (
      node.type === "character" ||
      node.type === "user" ||
      node.slug ||
      (node.id && typeof node.id === "string" && node.id.includes("-"))
    ) {
      if (node.slug) {
        characterNodesMap[node.slug] = node;
      } else if (node.id) {
        // Si pas de slug mais un ID, utiliser l'ID comme clé alternative
        characterNodesMap[node.id] = node;
      }

      // Identifier les personnages Joshua (gardé pour compatibilité)
      if (node.isJoshua === true || node.slug === "real-joshua-goldberg") {
        if (node.slug) joshuaCharacterSlugs.add(node.slug);
        if (node.id) joshuaCharacterIds.add(node.id);
      }
    }
  });

  console.log(
    `Indexation des nœuds: ${characterNodesCount} personnages, ${nodesWithSlugCount} nœuds avec slug, ${nodesWithIdCount} nœuds avec ID`
  );

  console.log(
    `Nœuds de personnages indexés: ${
      Object.keys(characterNodesMap).length
    } (par slug/id)`
  );

  console.log(
    `Nombre de personnages Joshua identifiés: ${joshuaCharacterSlugs.size} (par slug) et ${joshuaCharacterIds.size} (par id)`
  );

  // Créer une copie profonde des posts pour éviter de modifier l'original
  const spatializedPosts = JSON.parse(JSON.stringify(posts));

  if (twoPhases) {
    console.log(
      "PHASE 1: Positionnement des posts aux coordonnées exactes des personnages"
    );
  }

  // Traiter chaque post
  let postsWithCharacter = 0;
  let postsWithoutCharacter = 0;
  let totalPostsWithCoordinates = 0;

  spatializedPosts.forEach((post, index) => {
    // Déterminer si c'est un post "Joshua" (gardé pour compatibilité)
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

    // Si on a trouvé un nœud de caractère pour ce post
    if (characterNode) {
      postsWithCharacter++;

      // PHASE 1: Positionner d'abord le post exactement aux coordonnées du personnage
      if (twoPhases) {
        // Positionner exactement aux coordonnées du personnage (sans dispersion)
        const nodePosition = {
          x: characterNode.x,
          y: characterNode.y,
          z: characterNode.z,
        };

        // Mettre à jour les coordonnées du post
        post.x = nodePosition.x;
        post.y = nodePosition.y;
        post.z = nodePosition.z;
      } else {
        // Mode standard: calculer la position avec dispersion en une seule étape
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
        post.x = postPosition.x;
        post.y = postPosition.y;
        post.z = postPosition.z;
      }

      totalPostsWithCoordinates++;
    } else {
      // Si aucun nœud trouvé mais qu'on veut traiter ce post
      postsWithoutCharacter++;

      if (!joshuaOnly || (joshuaOnly && isJoshuaPost)) {
        // Générer une position aléatoire si aucun nœud correspondant trouvé
        // On place ces posts à la périphérie pour les distinguer
        const theta = Math.random() * Math.PI * 2; // Angle horizontal aléatoire
        const phi = Math.acos(2 * Math.random() - 1); // Angle vertical aléatoire
        const r = radius * 1.2; // Un peu plus loin que les autres

        // Convertir les coordonnées sphériques en cartésiennes
        post.x = r * Math.sin(phi) * Math.cos(theta);
        post.y = r * Math.sin(phi) * Math.sin(theta);
        post.z = r * Math.cos(phi);
        totalPostsWithCoordinates++;
      }
    }
  });

  console.log(`Stats de spatialisation après phase 1:
    - Posts avec un personnage identifié: ${postsWithCharacter}
    - Posts sans personnage identifié: ${postsWithoutCharacter}
    - Total posts avec coordonnées: ${totalPostsWithCoordinates}
    - Total posts sans coordonnées: ${
      spatializedPosts.length - totalPostsWithCoordinates
    }
  `);

  // PHASE 2: Appliquer la dispersion autour des positions des personnages
  if (twoPhases) {
    console.log(
      "PHASE 2: Application de la dispersion autour des positions de base"
    );

    // Pour chaque post qui a été positionné sur un personnage, appliquer la dispersion
    let postsDispersed = 0;

    spatializedPosts.forEach((post) => {
      // Rechercher à nouveau le nœud correspondant
      let characterNode = null;

      if (post.slug && characterNodesMap[post.slug]) {
        characterNode = characterNodesMap[post.slug];
      } else if (post.character) {
        if (characterNodesMap[post.character]) {
          characterNode = characterNodesMap[post.character];
        } else if (nodesByIdMap[post.character]) {
          characterNode = nodesByIdMap[post.character];
        }
      }

      // Si le post a un nœud associé, appliquer la dispersion
      if (characterNode) {
        // Créer un nœud temporaire avec les coordonnées actuelles du post
        // pour calculer la dispersion à partir de la position actuelle
        const basePosition = {
          x: characterNode.x,
          y: characterNode.y,
          z: characterNode.z,
        };

        // Appliquer l'effet de dispersion et voronoi
        const dispersedPosition = calculatePostPosition(basePosition, {
          radius,
          minDistance,
          verticalSpread,
          horizontalSpread,
          perlinScale,
          perlinAmplitude,
          dilatationFactor,
          useVoronoi,
        });

        // Mettre à jour les coordonnées du post avec la dispersion
        post.x = dispersedPosition.x;
        post.y = dispersedPosition.y;
        post.z = dispersedPosition.z;

        postsDispersed++;
      }
    });

    console.log(`Phase 2 terminée: ${postsDispersed} posts dispersés`);
  }

  return spatializedPosts;
}

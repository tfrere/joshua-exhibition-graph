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
 * @param {string} options.postUID - Identifiant unique du post (défaut: '')
 * @param {number} options.displacementIntensity - Intensité du déplacement (défaut: 10)
 * @param {number} options.displacementFrequency - Fréquence du bruit de Perlin (défaut: 0.05)
 * @param {number} options.displacementSeed - Valeur de graine pour le bruit (défaut: 42)
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
  const postUID = options.postUID || ''; // Ajouter le postUID comme option

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
  
  // Utiliser postUID comme partie de la seed pour obtenir des positions différentes pour chaque post  
  // Combiner la position du nœud et le hash du postUID pour créer une seed unique par post
  const seed = nodeX * 1000 + nodeY * 100 + nodeZ * 10 + postUID;
  
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

// Importer la fonction de bruit de Perlin depuis displacementPass.js
function perlinNoise(x, y, z, scale = 1, seed = 0) {
  // Ajuster les coordonnées avec l'échelle et le seed
  x = x * scale + seed;
  y = y * scale + seed * 2;
  z = z * scale + seed * 3;

  // Utiliser des fonctions trigonométriques pour simuler le bruit de Perlin
  const noise =
    Math.sin(x * 1.7 + Math.sin(y * 0.5) + Math.sin(z * 0.3)) * 0.5 +
    Math.sin(y * 2.3 + Math.sin(z * 0.7) + Math.sin(x * 0.9)) * 0.3 +
    Math.sin(z * 1.9 + Math.sin(x * 1.1) + Math.sin(y * 0.5)) * 0.2;

  return noise;
}

/**
 * Applique un déplacement radial à un post par rapport à son nœud de personnage
 * 
 * @param {Object} post - Le post à déplacer
 * @param {Object} characterNode - Le nœud de personnage servant de centre
 * @param {Object} options - Options de déplacement
 * @param {number} options.intensity - Intensité du déplacement (défaut: 10)
 * @param {number} options.frequency - Fréquence du bruit de Perlin (défaut: 0.05)
 * @param {number} options.seed - Valeur de graine pour le bruit (défaut: 42)
 * @param {number} options.minRadius - Rayon minimal à préserver (défaut: 0)
 * @returns {Object} Post avec coordonnées mises à jour
 */
function applyCharacterRadialDisplacement(post, characterNode, options = {}) {
  const intensity = options.intensity || 10;
  const frequency = options.frequency || 0.05;
  const seed = options.seed || 42;
  const minRadius = options.minRadius || 0;
  
  // Centre du déplacement = position du personnage
  const center = {
    x: characterNode.x,
    y: characterNode.y,
    z: characterNode.z
  };

  // S'assurer que les coordonnées existent
  if (post.x === undefined || post.y === undefined || post.z === undefined) {
    // Initialiser les coordonnées si elles n'existent pas
    return {
      ...post,
      x: center.x,
      y: center.y,
      z: center.z,
    };
  }

  // S'assurer que les coordonnées sont numériques
  const x = typeof post.x === "number" ? post.x : center.x;
  const y = typeof post.y === "number" ? post.y : center.y;
  const z = typeof post.z === "number" ? post.z : center.z;

  // Calculer le vecteur de direction depuis le centre
  const dx = x - center.x;
  const dy = y - center.y;
  const dz = z - center.z;

  // Distance au centre
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Éviter la division par zéro
  if (distance < 0.0001) {
    return post;
  }

  // Direction radiale normalisée
  const dirX = dx / distance;
  const dirY = dy / distance;
  const dirZ = dz / distance;

  // Calculer la valeur de bruit pour ce point
  const noiseValue = perlinNoise(dirX, dirY, dirZ, frequency, seed);

  // Calculer l'amplitude du déplacement
  const displacementFactor = intensity * noiseValue;

  // Appliquer le déplacement dans la direction radiale, en respectant le rayon minimal
  // Si minRadius est défini, s'assurer que le post ne se rapproche pas trop du centre
  let newX = x + dirX * displacementFactor;
  let newY = y + dirY * displacementFactor;
  let newZ = z + dirZ * displacementFactor;

  // Vérifier si le déplacement respecte le rayon minimal
  if (minRadius > 0) {
    const newDx = newX - center.x;
    const newDy = newY - center.y;
    const newDz = newZ - center.z;
    const newDistance = Math.sqrt(newDx * newDx + newDy * newDy + newDz * newDz);
    
    // Si la nouvelle distance est inférieure au rayon minimal, ajuster la position
    if (newDistance < minRadius) {
      const scaleFactor = minRadius / newDistance;
      newX = center.x + newDx * scaleFactor;
      newY = center.y + newDy * scaleFactor;
      newZ = center.z + newDz * scaleFactor;
    }
  }

  return {
    ...post,
    x: newX,
    y: newY,
    z: newZ,
    // Attribut additionnel pour tracking
    displacementValue: displacementFactor
  };
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
 * @param {boolean} options.secondPass - Si true, effectue le traitement en deux phases (défaut: true)
 * @param {boolean} options.thirdPass - Si true, effectue le traitement en deux phases (défaut: true)
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
export function spatializePostsAroundJoshuaNodesVND(posts, nodes, options = {}) {
  const {
    joshuaOnly = true,
    preserveOtherPositions = true,
    secondPass = true,
    thirdPass = true,
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
    // Options pour la Phase 3 de displacement
    displacementIntensity = 10,
    displacementFrequency = 0.05,
    displacementSeed = 42,
    // Option pour les couleurs uniques par personnage
    useUniqueColorsPerCharacter = true, // eslint-disable-line no-unused-vars
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

  // PHASE 1: Positionnement des posts aux coordonnées exactes des personnages
  // Cette phase est toujours exécutée
  console.log(
    "PHASE 1: Positionnement des posts aux coordonnées exactes des personnages"
  );

  // Traiter chaque post
  let postsWithCharacter = 0;
  let postsWithoutCharacter = 0;
  let totalPostsWithCoordinates = 0;

  spatializedPosts.forEach((post) => {
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
  // Cette phase n'est exécutée que si secondPass est true
  if (secondPass) {
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
        // Appliquer l'effet de dispersion et voronoi
        const dispersedPosition = calculatePostPosition(characterNode, {
          radius,
          minDistance,
          verticalSpread,
          horizontalSpread,
          perlinScale,
          perlinAmplitude,
          dilatationFactor,
          useVoronoi,
          postUID: post.postUID, // Utiliser directement le postUID existant
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

  // PHASE 3: Appliquer le déplacement radial pour chaque personnage
  // Cette phase n'est exécutée que si thirdPass est true
  if (thirdPass) {
    console.log("=== DÉBUT DU DÉPLACEMENT RADIAL PAR PERSONNAGE (PHASE 3) ===");
    console.log(`Application de déplacement radial avec du bruit de Perlin sur ${spatializedPosts.length} posts (intensité: ${displacementIntensity}, fréquence: ${displacementFrequency}, seed: ${displacementSeed})`);

    const displacementOptions = {
      intensity: displacementIntensity,
      frequency: displacementFrequency,
      seed: displacementSeed,
      minRadius: options.minRadius || 0
    };

    // Pour le debugging, échantillonner quelques posts avant déplacement
    if (spatializedPosts.length > 0) {
      const samplePost = spatializedPosts[0];
      console.log(
        "Coordonnées AVANT déplacement (premier post):",
        JSON.stringify({
          x: samplePost.x,
          y: samplePost.y,
          z: samplePost.z,
        })
      );

      // Calculer les statistiques initiales (min, max, moyenne)
      const validDistances = [];
      for (const post of spatializedPosts) {
        // Vérifier que les coordonnées sont numériques
        if (
          typeof post.x === "number" &&
          typeof post.y === "number" &&
          typeof post.z === "number"
        ) {
          // Trouver le nœud correspondant
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

          if (characterNode) {
            const dx = post.x - characterNode.x;
            const dy = post.y - characterNode.y;
            const dz = post.z - characterNode.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (!isNaN(distance) && isFinite(distance)) {
              validDistances.push(distance);
            }
          }
        }
      }

      let minDist = 0,
          maxDist = 0,
          avgDist = 0;
      if (validDistances.length > 0) {
        minDist = Math.min(...validDistances);
        maxDist = Math.max(...validDistances);
        avgDist =
          validDistances.reduce((sum, d) => sum + d, 0) / validDistances.length;
      }

      console.log(
        `Statistiques avant déplacement: min=${minDist.toFixed(
          2
        )}, max=${maxDist.toFixed(2)}, moyenne=${avgDist.toFixed(2)}`
      );
    }

    let postsDisplaced = 0;

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

      // Si le post a un nœud associé, appliquer le déplacement radial
      if (characterNode) {
        const displacedPost = applyCharacterRadialDisplacement(
          post,
          characterNode,
          displacementOptions
        );

        // Mettre à jour les coordonnées du post
        post.x = displacedPost.x;
        post.y = displacedPost.y;
        post.z = displacedPost.z;
        post.displacementValue = displacedPost.displacementValue;

        postsDisplaced++;
      }
    });

    // Pour le debugging, échantillonner quelques posts après déplacement
    if (spatializedPosts.length > 0) {
      const samplePost = spatializedPosts[0];
      console.log(
        "Coordonnées APRÈS déplacement (premier post):",
        JSON.stringify({
          x: samplePost.x,
          y: samplePost.y,
          z: samplePost.z,
        })
      );

      // Calculer les statistiques après déplacement
      const validDistances = [];
      for (const post of spatializedPosts) {
        // Vérifier que les coordonnées sont numériques
        if (
          typeof post.x === "number" &&
          typeof post.y === "number" &&
          typeof post.z === "number"
        ) {
          // Trouver le nœud correspondant
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

          if (characterNode) {
            const dx = post.x - characterNode.x;
            const dy = post.y - characterNode.y;
            const dz = post.z - characterNode.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (!isNaN(distance) && isFinite(distance)) {
              validDistances.push(distance);
            }
          }
        }
      }

      let minDist = 0,
          maxDist = 0,
          avgDist = 0;
      if (validDistances.length > 0) {
        minDist = Math.min(...validDistances);
        maxDist = Math.max(...validDistances);
        avgDist =
          validDistances.reduce((sum, d) => sum + d, 0) / validDistances.length;
      }

      console.log(
        `Statistiques après déplacement: min=${minDist.toFixed(
          2
        )}, max=${maxDist.toFixed(2)}, moyenne=${avgDist.toFixed(2)}`
      );
    }

    console.log(`Phase 3 terminée: ${postsDisplaced} posts déplacés radialement`);
    console.log("=== FIN DU DÉPLACEMENT RADIAL PAR PERSONNAGE ===");
  }

  return spatializedPosts;
}

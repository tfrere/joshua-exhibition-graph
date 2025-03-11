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
 * @param {Array} options.allCharacterNodes - Tous les nœuds de personnage (pour vérifier les frontières Voronoi)
 * @param {number} options.maxAttempts - Nombre maximal de tentatives pour trouver une position valide (défaut: 50)
 * @param {number} options.cellPadding - Marge à garder par rapport aux frontières Voronoi (0-1) (défaut: 0)
 * @param {string} options.distributionStrategy - Stratégie de distribution: "uniform", "clustered", "balanced" (défaut: "balanced")
 * @param {string} options.fallbackStrategy - Stratégie de repli en cas d'échec: "shrink", "center", "random" (défaut: "shrink")
 * @param {number} options.weightValue - Valeur à utiliser pour la pondération (ex: impact du post) (défaut: 1)
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
  const postUID = options.postUID || 0; // Utiliser directement postUID comme valeur numérique
  const allCharacterNodes = options.allCharacterNodes || []; // Tous les nœuds pour calculer les frontières Voronoi
  
  // Nouveaux paramètres additionnels
  const maxAttempts = options.maxAttempts || 50;
  const cellPadding = options.cellPadding || 0;
  const distributionStrategy = options.distributionStrategy || "balanced";
  const fallbackStrategy = options.fallbackStrategy || "shrink";
  const weightValue = options.weightValue || 1;

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

  // Combiner la position du nœud et le hash du postUID pour créer une seed unique par post
  // Utiliser l'entier postUID directement
  const postUIDValue = postUID || 0; // Utiliser directement postUID comme valeur numérique
  const seed = Math.abs(nodeX * 73.156 + nodeY * 52.789 + nodeZ * 21.321 + postUIDValue * 13.437);
  
  // Fonction pseudo-aléatoire plus chaotique
  const pseudoRandom = (val, offset = 0) => {
    const x = Math.sin(val * 12.9898 + seed * 78.233 + offset * 43.4329) * 43758.5453;
    const y = Math.cos(val * 39.4729 + seed * 27.957 + offset * 12.3743) * 32478.2357;
    return (Math.abs(x * y) % 1);
  };

  // Fonction pour calculer la distance entre deux points 3D
  const distanceBetween = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  // Position initiale dans la cellule Voronoi
  let isValid = false;
  let attempts = 0;
  let x, y, z;
  
  // Essayer jusqu'au nombre maximal de tentatives pour trouver une position valide
  while (!isValid && attempts < maxAttempts) {
    // Deux approches différentes pour générer des positions, selon la stratégie de distribution
    if (distributionStrategy === "uniform" || 
        (distributionStrategy === "balanced" && pseudoRandom(attempts, 1) < 0.5)) {
      // Approche 1: Coordonnées sphériques aléatoires avec perturbation
      const theta = pseudoRandom(attempts, 2) * Math.PI * 2; // Angle horizontal (0-2π)
      const phi = Math.acos(2 * pseudoRandom(attempts, 3) - 1); // Angle vertical (0-π)
      
      // Ajouter une perturbation aux angles pour éviter les arcs parfaits
      const thetaNoise = (pseudoRandom(attempts, 4) - 0.5) * 0.5;
      const phiNoise = (pseudoRandom(attempts, 5) - 0.5) * 0.3;
      
      // Calculer une distance entre minDistance et radius avec distribution non uniforme
      let distancePower = pseudoRandom(attempts, 6) * 2; // Entre 0 et 2
      
      // Si on utilise la stratégie "clustered", favoriser les positions plus proches du centre
      if (distributionStrategy === "clustered") {
        distancePower = distancePower * 2; // Plus concentré au centre
      }
      
      // Si le poids est utilisé, ajuster la distance en fonction du poids (plus d'impact = plus loin)
      const normalizedWeight = weightValue > 1 ? Math.log(weightValue) / Math.log(1000) : 0;
      const weightScale = 1 + normalizedWeight;
      
      const normalizedDistance = Math.pow(pseudoRandom(attempts, 7), distancePower); 
      const distance = minDistance + normalizedDistance * (radius - minDistance) * weightScale;
      
      // Calculer les coordonnées avec les angles perturbés
      x = nodeX + Math.sin(phi + phiNoise) * Math.cos(theta + thetaNoise) * distance * horizontalSpread;
      y = nodeY + Math.sin(phi + phiNoise) * Math.sin(theta + thetaNoise) * distance * horizontalSpread;
      z = nodeZ + Math.cos(phi + phiNoise) * distance * verticalSpread;
    } else {
      // Approche 2: Position cubique avec projection radiale
      // Générer une position dans un cube (-1 à 1)
      const cubeX = (pseudoRandom(attempts, 8) * 2 - 1);
      const cubeY = (pseudoRandom(attempts, 9) * 2 - 1);
      const cubeZ = (pseudoRandom(attempts, 10) * 2 - 1);
      
      // Calculer la distance du point au centre du cube
      const dist = Math.sqrt(cubeX*cubeX + cubeY*cubeY + cubeZ*cubeZ);
      
      // Normaliser le point sur une sphère si nécessaire (évite concentration au centre)
      let nx, ny, nz;
      if (dist > 1) {
        // Normaliser sur la sphère unité
        nx = cubeX / dist;
        ny = cubeY / dist;
        nz = cubeZ / dist;
      } else if (dist < 0.2) {
        // Éviter trop de points au centre
        const normDist = Math.max(0.2, dist);
        nx = cubeX / normDist;
        ny = cubeY / normDist;
        nz = cubeZ / normDist;
      } else {
        // Garder la position cubique
        nx = cubeX;
        ny = cubeY;
        nz = cubeZ;
      }
      
      // Calculer une distance entre minDistance et radius non linéaire
      const distanceRatio = minDistance / radius;
      
      // Si le poids est utilisé, ajuster la distance en fonction du poids
      const normalizedWeight = weightValue > 1 ? Math.log(weightValue) / Math.log(1000) : 0;
      const weightScale = 1 + normalizedWeight;
      
      const distance = radius * (distanceRatio + (1 - distanceRatio) * pseudoRandom(attempts, 11)) * weightScale;
      
      // Calculer les coordonnées finales
      x = nodeX + nx * distance * horizontalSpread;
      y = nodeY + ny * distance * horizontalSpread;
      z = nodeZ + nz * distance * verticalSpread;
    }

    // Ajouter du "bruit" façon Perlin pour éviter les distributions trop régulières
    if (perlinScale > 0 && perlinAmplitude > 0) {
      // Utiliser des fréquences différentes pour chaque dimension
      const noiseX = perlinNoise(x * perlinScale, y * perlinScale * 1.1, z * perlinScale * 0.9, 1, seed) * perlinAmplitude;
      const noiseY = perlinNoise(y * perlinScale * 1.2, z * perlinScale * 0.8, x * perlinScale * 1.3, 1, seed + 1) * perlinAmplitude;
      const noiseZ = perlinNoise(z * perlinScale * 0.7, x * perlinScale * 1.4, y * perlinScale * 1.1, 1, seed + 2) * perlinAmplitude;

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

      // Appliquer un facteur de dilatation légèrement variable pour casser les motifs réguliers
      const dilatationVariation = 1 + (pseudoRandom(attempts, 12) - 0.5) * 0.2; // ±10% de variation
      const effectiveDilatation = dilatationFactor * dilatationVariation;

      // Calculer la nouvelle position dilatée
      x = nodeX + dx * effectiveDilatation;
      y = nodeY + dy * effectiveDilatation;
      z = nodeZ + dz * effectiveDilatation;
    }

    // Vérifier que cette position est à l'intérieur de la cellule Voronoi
    // c'est-à-dire qu'elle est plus proche de son personnage que de tout autre personnage
    if (allCharacterNodes.length > 0) {
      isValid = true;
      const newPosition = { x, y, z };
      const distanceToSite = distanceBetween(newPosition, characterNode);
      
      for (const otherNode of allCharacterNodes) {
        // Ne pas comparer avec le nœud lui-même
        if (otherNode === characterNode || 
            (otherNode.id && characterNode.id && otherNode.id === characterNode.id) ||
            (otherNode.slug && characterNode.slug && otherNode.slug === characterNode.slug)) {
          continue;
        }
        
        const distanceToOther = distanceBetween(newPosition, otherNode);
        
        // Si cellPadding est utilisé, vérifier avec une marge
        if (cellPadding > 0) {
          // distanceToOther * (1 - cellPadding) < distanceToSite signifie qu'on est trop proche de la frontière
          if (distanceToOther * (1 - cellPadding) < distanceToSite) {
            isValid = false;
            break;
          }
        } else {
          // Vérification standard sans marge
          if (distanceToOther < distanceToSite) {
            isValid = false;
            break;
          }
        }
      }
    } else {
      // Si aucun autre nœud n'est fourni, considérer la position comme valide par défaut
      isValid = true;
    }

    attempts++;
  }

  // Si après plusieurs tentatives on n'a pas trouvé de position valide,
  // on utilise la stratégie de repli sélectionnée
  if (!isValid) {
    if (fallbackStrategy === "shrink") {
      // Approche de repli avec réduction progressive du rayon
      let fallbackValid = false;
      let fallbackAttempts = 0;
      
      while (!fallbackValid && fallbackAttempts < 10) {
        // Réduire progressivement le rayon
        const fallbackRadius = minDistance * (1 - fallbackAttempts * 0.1);
        
        // Générer des angles vraiment aléatoires pour cette tentative de repli
        const theta = pseudoRandom(1000 + fallbackAttempts, 1) * Math.PI * 2;
        const phi = Math.acos(2 * pseudoRandom(2000 + fallbackAttempts, 2) - 1);
        
        x = nodeX + Math.sin(phi) * Math.cos(theta) * fallbackRadius * horizontalSpread;
        y = nodeY + Math.sin(phi) * Math.sin(theta) * fallbackRadius * horizontalSpread;
        z = nodeZ + Math.cos(phi) * fallbackRadius * verticalSpread;
        
        // Vérifier si cette position est dans la cellule Voronoi
        if (allCharacterNodes.length > 0) {
          fallbackValid = true;
          const newPosition = { x, y, z };
          const distanceToSite = distanceBetween(newPosition, characterNode);
          
          for (const otherNode of allCharacterNodes) {
            if (otherNode === characterNode || 
                (otherNode.id && characterNode.id && otherNode.id === characterNode.id) ||
                (otherNode.slug && characterNode.slug && otherNode.slug === characterNode.slug)) {
              continue;
            }
            
            const distanceToOther = distanceBetween(newPosition, otherNode);
            if (distanceToOther < distanceToSite) {
              fallbackValid = false;
              break;
            }
          }
        } else {
          fallbackValid = true;
        }
        
        fallbackAttempts++;
      }
      
      // Si toujours pas de position valide, utiliser une position très proche
      if (!fallbackValid) {
        const minimalOffset = minDistance * 0.1;
        x = nodeX + (pseudoRandom(3000, 3) - 0.5) * minimalOffset;
        y = nodeY + (pseudoRandom(4000, 4) - 0.5) * minimalOffset;
        z = nodeZ + (pseudoRandom(5000, 5) - 0.5) * minimalOffset;
      }
      
      isValid = fallbackValid;
    } 
    else if (fallbackStrategy === "center") {
      // Positionnement au centre avec une très légère variation
      const minimalOffset = minDistance * 0.05;
      x = nodeX + (pseudoRandom(3000, 3) - 0.5) * minimalOffset;
      y = nodeY + (pseudoRandom(4000, 4) - 0.5) * minimalOffset;
      z = nodeZ + (pseudoRandom(5000, 5) - 0.5) * minimalOffset;
      isValid = true;
    }
    else if (fallbackStrategy === "random") {
      // Position complètement aléatoire à l'intérieur d'une cellule contrainte
      // Essayer avec un rayon très petit
      const tinyRadius = minDistance * 0.3;
      const randomTheta = pseudoRandom(6000, 6) * Math.PI * 2;
      const randomPhi = Math.acos(2 * pseudoRandom(7000, 7) - 1);
      
      x = nodeX + Math.sin(randomPhi) * Math.cos(randomTheta) * tinyRadius;
      y = nodeY + Math.sin(randomPhi) * Math.sin(randomTheta) * tinyRadius;
      z = nodeZ + Math.cos(randomPhi) * tinyRadius;
      isValid = true;
    }
    // Par défaut, on utilise la stratégie "shrink" déjà existante
  }

  // Retourner les coordonnées calculées
  return { 
    x, 
    y, 
    z,
    inValidVoronoiCell: isValid // Attribut pour debugging
  };
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
 * @param {number} options.maxAttempts - Nombre maximal de tentatives pour trouver une position valide (défaut: 50)
 * @param {number} options.cellPadding - Marge à garder par rapport aux frontières Voronoi (0-1) (défaut: 0)
 * @param {string} options.distributionStrategy - Stratégie de distribution: "uniform", "clustered", "balanced" (défaut: "balanced")
 * @param {string} options.fallbackStrategy - Stratégie de repli en cas d'échec: "shrink", "center", "random" (défaut: "shrink")
 * @param {string} options.weightField - Nom du champ à utiliser pour la pondération (ex: "impact") (défaut: aucun)
 * @param {boolean} options.useStrictSlugMatching - Si true, utilise strictement les slugs pour les correspondances (défaut: false)
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
    // Nouveaux paramètres pour la fonction spatializePostsAroundJoshuaNodesVND
    maxAttempts = 50,
    cellPadding = 0,
    distributionStrategy = "balanced",
    fallbackStrategy = "shrink",
    weightField = "",
    useStrictSlugMatching = false,
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

    // Priorité absolue au slug pour les nœuds de personnages
    if (node.slug) {
      characterNodesMap[node.slug] = node;
      // Également mapper par ID pour compatibilité
      if (node.id) {
        characterNodesMap[node.id] = node;
      }
    }
    // Si pas de slug mais un ID, utiliser l'ID comme clé alternative
    else if (node.id && (node.type === "character" || node.type === "user" || (typeof node.id === "string" && node.id.includes("-")))) {
      characterNodesMap[node.id] = node;
    }

    // Identifier les personnages Joshua (gardé pour compatibilité)
    if (node.isJoshua === true || node.slug === "real-joshua-goldberg") {
      if (node.slug) joshuaCharacterSlugs.add(node.slug);
      if (node.id) joshuaCharacterIds.add(node.id);
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

  // Debug: identifier tous les slugs uniques dans les posts pour validation
  const uniqueSlugs = new Set();
  const missingNodePosts = [];
  
  // Traiter chaque post
  let postsWithCharacter = 0;
  let postsWithoutCharacter = 0;
  let totalPostsWithCoordinates = 0;

  spatializedPosts.forEach((post) => {
    // Collecter les slugs uniques pour debug
    if (post.slug) uniqueSlugs.add(post.slug);
    
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

    // Trouver le nœud correspondant à ce post (Priorité STRICTE au slug)
    let characterNode = null;

    // 1. Recherche par slug (PRIORITAIRE)
    if (post.slug && characterNodesMap[post.slug]) {
      characterNode = characterNodesMap[post.slug];
    } 
    // 2. Si aucun nœud trouvé par slug et que post.character existe, l'utiliser (sauf si useStrictSlugMatching est true)
    else if (!characterNode && post.character && !useStrictSlugMatching) {
      // Essayer d'abord comme slug dans characterNodesMap
      if (characterNodesMap[post.character]) {
        characterNode = characterNodesMap[post.character];
      }
      // Puis comme id dans nodesByIdMap
      else if (nodesByIdMap[post.character]) {
        characterNode = nodesByIdMap[post.character];
      }
    }

    // Si on a trouvé un nœud de caractère pour ce post
    if (characterNode) {
      postsWithCharacter++;
      
      // Enregistrer le nœud dans le post pour traçabilité
      post.associatedNodeId = characterNode.id;
      post.associatedNodeSlug = characterNode.slug;

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
      
      // Enregistrer dans la liste des posts sans nœud pour debug
      missingNodePosts.push({
        postId: post.id,
        postSlug: post.slug,
        character: post.character
      });

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
  
  // Debug: Afficher les slugs uniques trouvés dans les posts
  console.log(`Nombre de slugs uniques dans les posts: ${uniqueSlugs.size}`);
  console.log(`Exemple de slugs: ${Array.from(uniqueSlugs).slice(0, 10).join(', ')}`);
  
  // Identifier les slugs qui n'ont pas de nœud correspondant
  const missingSlugs = Array.from(uniqueSlugs).filter(slug => !characterNodesMap[slug]);
  console.log(`Slugs sans nœud correspondant: ${missingSlugs.length}`);
  if (missingSlugs.length > 0) {
    console.log(`Exemple de slugs manquants: ${missingSlugs.slice(0, 10).join(', ')}`);
  }
  
  // Afficher quelques posts sans nœud pour debug
  if (missingNodePosts.length > 0) {
    console.log(`Exemples de posts sans nœud correspondant: `, missingNodePosts.slice(0, 5));
  }

  // PHASE 2: Appliquer la dispersion autour des positions des personnages avec respect des frontières Voronoi
  // Cette phase n'est exécutée que si secondPass est true
  if (secondPass) {
    console.log(
      "PHASE 2: Application de la dispersion avec respect des frontières Voronoi"
    );

    // Extraire tous les nœuds de personnage pour les calculs de frontières Voronoi
    const allCharacterNodes = Object.values(characterNodesMap);

    // Pour chaque post qui a été positionné sur un personnage, appliquer la dispersion
    let postsDispersed = 0;
    const postsInWrongCells = [];

    spatializedPosts.forEach((post) => {
      // Rechercher le nœud correspondant prioritairement par le slug
      let characterNode = null;

      // 1. Recherche par slug (PRIORITAIRE)
      if (post.slug && characterNodesMap[post.slug]) {
        characterNode = characterNodesMap[post.slug];
      } 
      // 2. Utiliser le nœud associé dans la phase 1 si disponible
      else if (post.associatedNodeSlug && characterNodesMap[post.associatedNodeSlug]) {
        characterNode = characterNodesMap[post.associatedNodeSlug];
      }
      // 3. Recherche par character comme fallback
      else if (post.character) {
        if (characterNodesMap[post.character]) {
          characterNode = characterNodesMap[post.character];
        } else if (nodesByIdMap[post.character]) {
          characterNode = nodesByIdMap[post.character];
        }
      }

      // Si le post a un nœud associé, appliquer la dispersion
      if (characterNode) {
        // Extraire la valeur de poids si un champ de poids est spécifié
        let weightValue = 1;
        if (weightField && post[weightField] !== undefined) {
          weightValue = post[weightField];
        }

        // Appliquer l'effet de dispersion et voronoi avec respect des frontières
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
          allCharacterNodes: allCharacterNodes, // Fournir tous les nœuds pour les calculs de frontières
          maxAttempts: maxAttempts, // Nombre maximal de tentatives
          cellPadding: cellPadding, // Marge par rapport aux frontières
          distributionStrategy: distributionStrategy, // Stratégie de distribution
          fallbackStrategy: fallbackStrategy, // Stratégie de repli
          weightValue: weightValue // Valeur de poids (ex: impact du post)
        });

        // Mettre à jour les coordonnées du post avec la dispersion
        post.x = dispersedPosition.x;
        post.y = dispersedPosition.y;
        post.z = dispersedPosition.z;
        // Conserver l'information de validité Voronoi pour le debugging
        post.inValidVoronoiCell = dispersedPosition.inValidVoronoiCell;

        // Si le post n'est pas dans la bonne cellule, l'ajouter à la liste pour debuggage
        if (!post.inValidVoronoiCell) {
          postsInWrongCells.push({
            postId: post.id, 
            postSlug: post.slug,
            character: post.character,
            associatedNodeSlug: post.associatedNodeSlug
          });
        }

        postsDispersed++;
      }
    });

    console.log(`Phase 2 terminée: ${postsDispersed} posts dispersés avec respect des frontières Voronoi`);
    
    // Debug: posts dans des cellules incorrectes
    if (postsInWrongCells.length > 0) {
      console.log(`ATTENTION: ${postsInWrongCells.length} posts placés dans des cellules Voronoi incorrectes`);
      console.log(`Exemples de posts mal placés:`, postsInWrongCells.slice(0, 5));
    }
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

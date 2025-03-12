/**
 * Module pour la passe de distribution volumétrique
 * Cette passe répartit les posts en volumes proportionnels autour des nœuds centraux,
 * créant des clusters distincts dont la taille dépend du nombre de posts.
 */

// Fonction de bruit de Perlin pour ajouter de la variation
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
 * Spatialise les posts autour des nœuds en créant des volumes proportionnels
 * au nombre de posts pour chaque caractère, répartis dans une sphère globale.
 *
 * @param {Array} posts - Liste des posts à spatialiser
 * @param {Array} nodes - Liste des nœuds du graphe avec leurs positions
 * @param {Object} options - Options de spatialisation
 * @param {boolean} options.joshuaOnly - Si true, ne traite que les posts liés à Joshua (défaut: true)
 * @param {boolean} options.preserveOtherPositions - Si true, ne modifie pas les positions des posts non-Joshua (défaut: true)
 * @param {number} options.globalSphereRadius - Rayon de la sphère globale dans laquelle répartir les posts (défaut: 200)
 * @param {boolean} options.proportionalVolume - Si true, dimensionne les volumes en fonction du nombre de posts par caractère (défaut: true)
 * @param {number} options.perlinScale - Échelle du bruit de Perlin (défaut: 0.05)
 * @param {number} options.perlinAmplitude - Amplitude du bruit de Perlin (défaut: 5)
 * @param {number} options.minCharacterDistance - Distance minimale entre les centres des volumes des personnages (défaut: 50)
 * @param {boolean} options.useStrictSlugMatching - Si true, utilise strictement les slugs pour les correspondances (défaut: false)
 * @param {Array} options.customNodes - Nœuds personnalisés à utiliser à la place des nœuds standards
 * @param {number} options.voronoiPermissivity - Facteur entre 0 et 1 permettant aux posts de dépasser les frontières des cellules (0 = strict, 1 = permissif) (défaut: 0)
 * @returns {Array} Posts spatialisés avec coordonnées mises à jour
 */
export function spatializePostsWithVolumetricDistribution(posts, nodes, options = {}) {
  const {
    joshuaOnly = true,
    preserveOtherPositions = true,
    globalSphereRadius = 200,
    proportionalVolume = true,
    perlinScale = 0.05,
    perlinAmplitude = 5,
    minCharacterDistance = 50,
    useStrictSlugMatching = false,
    customNodes = null,
    voronoiPermissivity = 0
  } = options;

  // Utiliser les nœuds personnalisés s'ils sont fournis, sinon utiliser les nœuds standards
  const nodesData = customNodes || nodes;

  console.log(
    `Spatialisation volumétrique des posts: utilisation de ${
      customNodes ? "nœuds personnalisés" : "nœuds standards"
    } (${nodesData.length} nœuds)`
  );

  if (nodesData.length === 0) {
    console.warn("Aucun nœud disponible pour la spatialisation des posts");
    return posts;
  }

  // Afficher les nœuds disponibles pour debug
  if (nodesData.length > 0) {
    console.log(
      "Nœuds pour spatialisation volumétrique:",
      nodesData.map((n) => ({
        id: n.id,
        slug: n.slug,
        type: n.type,
        isJoshua: n.isJoshua,
        pos: [Math.round(n.x || 0), Math.round(n.y || 0), Math.round(n.z || 0)],
      }))
    );
  }

  // Vérifier que les nœuds ont des positions valides
  const validNodes = nodesData.filter(node => 
    node && 
    typeof node.x === 'number' && 
    typeof node.y === 'number' && 
    typeof node.z === 'number'
  );
  
  if (validNodes.length === 0) {
    console.warn("Aucun nœud avec des positions valides n'a été trouvé");
    // Si aucun nœud valide n'est disponible, créer quelques nœuds fictifs pour éviter les erreurs
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      validNodes.push({
        id: `generated_${i}`,
        slug: `generated_${i}`,
        type: "character",
        x: Math.cos(angle) * globalSphereRadius * 0.5,
        y: Math.sin(angle) * globalSphereRadius * 0.5,
        z: 0
      });
    }
    console.log("Nœuds fictifs générés pour éviter les erreurs:", validNodes.length);
  }

  // Créer un index des nœuds par slug ET par id pour un accès rapide
  const characterNodesMap = {}; // Map des nœuds par slug
  const nodesByIdMap = {}; // Map des nœuds par id
  const joshuaCharacterSlugs = new Set(); // Ensemble des slugs des personnages Joshua
  const joshuaCharacterIds = new Set(); // Ensemble des IDs des personnages Joshua

  // Indexer tous les nœuds pour accès rapide
  validNodes.forEach((node) => {
    if (!node || typeof node !== "object") return;

    // Indexer le nœud par son ID si disponible
    if (node.id) {
      nodesByIdMap[node.id] = node;
    }

    // Priorité au slug pour les nœuds de personnages
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

    // Identifier les personnages Joshua
    if (node.isJoshua === true || node.slug === "real-joshua-goldberg") {
      if (node.slug) joshuaCharacterSlugs.add(node.slug);
      if (node.id) joshuaCharacterIds.add(node.id);
    }
  });

  console.log(
    `Nœuds de personnages indexés: ${
      Object.keys(characterNodesMap).length
    } (par slug/id)`
  );

  // Créer une copie profonde des posts pour éviter de modifier l'original
  const spatializedPosts = JSON.parse(JSON.stringify(posts));

  // ÉTAPE 1: Compter les posts par caractère pour calculer les volumes proportionnels
  const postCountByCharacter = {};
  const postsByCharacter = {};
  let totalPosts = 0;
  
  // Première passe pour compter les posts par caractère
  spatializedPosts.forEach((post) => {
    const isJoshuaPost =
      post.isJoshuaCharacter === true ||
      (post.slug && joshuaCharacterSlugs.has(post.slug)) ||
      (post.character && joshuaCharacterIds.has(post.character));

    // Si on veut seulement les posts Joshua et que ce n'est pas un post Joshua, passer
    if (joshuaOnly && !isJoshuaPost && preserveOtherPositions) {
      return;
    }

    // Identifier le caractère associé à ce post
    let characterKey = null;
    
    // 1. Recherche par slug (PRIORITAIRE)
    if (post.slug && characterNodesMap[post.slug]) {
      characterKey = post.slug;
    } 
    // 2. Si aucun nœud trouvé par slug et que post.character existe, l'utiliser (sauf si useStrictSlugMatching est true)
    else if (post.character && !useStrictSlugMatching) {
      // Essayer d'abord comme slug dans characterNodesMap
      if (characterNodesMap[post.character]) {
        characterKey = post.character;
      }
      // Puis comme id dans nodesByIdMap
      else if (nodesByIdMap[post.character]) {
        characterKey = post.character;
      }
    }

    if (characterKey) {
      // Incrémenter le compteur de posts pour ce caractère
      postCountByCharacter[characterKey] = (postCountByCharacter[characterKey] || 0) + 1;
      
      // Stocker ce post dans la liste des posts de ce caractère
      if (!postsByCharacter[characterKey]) {
        postsByCharacter[characterKey] = [];
      }
      postsByCharacter[characterKey].push(post);
      
      totalPosts++;
    }
  });

  console.log(`Comptage des posts: ${totalPosts} posts pour ${Object.keys(postCountByCharacter).length} caractères`);
  
  // Exemples des 5 caractères avec le plus grand nombre de posts
  const characterPostCounts = Object.entries(postCountByCharacter)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  console.log("Caractères avec le plus de posts:", characterPostCounts);

  // ÉTAPE 2: Calculer les volumes proportionnels et les rayons des sphères
  const characterVolumeInfo = {};
  const totalVolume = (4/3) * Math.PI * Math.pow(globalSphereRadius, 3);
  
  // Si proportionalVolume est activé, calculer les volumes proportionnels au nombre de posts
  if (proportionalVolume) {
    // Calculer le volume pour chaque caractère
    for (const [characterKey, postCount] of Object.entries(postCountByCharacter)) {
      const volumeRatio = postCount / totalPosts * 10;
      const characterVolume = totalVolume * volumeRatio;
      
      // Rayon effectif pour ce volume (en supposant une sphère)
      const effectiveRadius = Math.pow((4 * characterVolume) / (4 * Math.PI), 1/3);
      
      characterVolumeInfo[characterKey] = {
        postCount,
        volumeRatio,
        volume: characterVolume,
        radius: effectiveRadius
      };
    }
  } else {
    // Volume égal pour chaque caractère
    const characterCount = Object.keys(postCountByCharacter).length;
    const equalVolume = totalVolume / characterCount;
    const equalRadius = Math.pow((3 * equalVolume) / (4 * Math.PI), 1/3);
    
    for (const [characterKey, postCount] of Object.entries(postCountByCharacter)) {
      characterVolumeInfo[characterKey] = {
        postCount,
        volumeRatio: 1 / characterCount,
        volume: equalVolume,
        radius: equalRadius
      };
    }
  }
  
  // ÉTAPE 3: Préparer les volumes autour des nœuds character originaux
  console.log("Calcul des volumes autour des positions originales des nœuds character");
  
  // Utiliser les positions originales des nœuds character comme centres
  const characterCenters = {};
  const placedCenters = [];
  
  // Collecter d'abord les positions originales
  for (const [characterKey, volumeInfo] of Object.entries(characterVolumeInfo)) {
    const characterNode = characterNodesMap[characterKey];
    
    if (characterNode && typeof characterNode.x === 'number' && 
        typeof characterNode.y === 'number' && typeof characterNode.z === 'number') {
      
      // Utiliser la position d'origine du nœud character comme centre
      characterCenters[characterKey] = {
        x: characterNode.x,
        y: characterNode.y,
        z: characterNode.z,
        radius: volumeInfo.radius,
        originalNode: characterNode
      };
      
      placedCenters.push({
        position: {
          x: characterNode.x,
          y: characterNode.y,
          z: characterNode.z
        },
        radius: volumeInfo.radius,
        characterKey
      });
    } else {
      console.warn(`Position invalide pour le nœud character ${characterKey}, ce caractère sera ignoré`);
    }
  }
  
  console.log(`${placedCenters.length} centres de caractères définis aux positions d'origine des nœuds`);
  
  // Vérifier si certains volumes dépassent la sphère globale ou se chevauchent
  console.log(`Note: Les volumes peuvent se chevaucher car aucune distance minimale (${minCharacterDistance}) n'est appliquée`);
  
  for (const center of placedCenters) {
    // Calculer la distance au centre global
    const distanceFromOrigin = Math.sqrt(
      center.position.x * center.position.x + 
      center.position.y * center.position.y + 
      center.position.z * center.position.z
    );
    
    // Vérifier si le volume dépasse la sphère globale
    if (distanceFromOrigin + center.radius > globalSphereRadius) {
      console.warn(`Le volume à la position (${center.position.x.toFixed(1)}, ${center.position.y.toFixed(1)}, ${center.position.z.toFixed(1)}) dépasse la sphère globale de ${((distanceFromOrigin + center.radius) - globalSphereRadius).toFixed(1)} unités`);
    }
  }
  
  console.log(`Volumes calculés pour ${Object.keys(characterCenters).length} caractères aux positions originales des nœuds`);

  // ÉTAPE 4: Pas besoin de stocker séparément les positions calculées puisqu'on utilise les positions d'origine
  console.log("Utilisation des positions originales des nœuds de caractère pour le placement des posts");
  
  // ÉTAPE 5: Positionnement des posts dans leurs volumes respectifs
  console.log("Positionnement des posts dans leurs volumes alloués avec logique de Voronoi");
  
  // Afficher le facteur de permissivité utilisé
  if (voronoiPermissivity > 0) {
    console.log(`Mode permissif activé: les posts peuvent dépasser les frontières Voronoi jusqu'à ${(voronoiPermissivity * 100).toFixed(1)}% du rayon de leur volume`);
  } else {
    console.log("Mode strict activé: les posts restent strictement dans leurs cellules de Voronoi");
  }
  
  let postsPositioned = 0;
  let postsInBlendedArea = 0; // Compteur pour les posts placés dans des zones de chevauchement
  
  // Créer une carte des volumes pour vérification rapide d'appartenance
  const volumesByCenterKey = {};
  for (const [characterKey, centerInfo] of Object.entries(characterCenters)) {
    volumesByCenterKey[characterKey] = {
      center: {
        x: centerInfo.x,
        y: centerInfo.y,
        z: centerInfo.z
      },
      radius: centerInfo.radius
    };
  }
  
  // Fonction pour vérifier si un point appartient à la cellule de Voronoi d'un caractère
  const isInVoronoiCell = (point, characterKey) => {
    // Le centre associé à ce caractère
    const ownCenter = volumesByCenterKey[characterKey]?.center;
    if (!ownCenter) return false;
    
    // Calculer la distance au centre de ce caractère
    const dx = point.x - ownCenter.x;
    const dy = point.y - ownCenter.y;
    const dz = point.z - ownCenter.z;
    const distanceToOwnCenter = Math.sqrt(dx*dx + dy*dy + dz*dz);
    
    // Si la permissivité est à 0, vérification stricte
    if (voronoiPermissivity <= 0) {
      // Vérifier si ce point est plus proche de ce centre que de tout autre centre
      for (const [otherKey, otherVolume] of Object.entries(volumesByCenterKey)) {
        if (otherKey === characterKey) continue; // Ignorer le même caractère
        
        const odx = point.x - otherVolume.center.x;
        const ody = point.y - otherVolume.center.y;
        const odz = point.z - otherVolume.center.z;
        const distanceToOtherCenter = Math.sqrt(odx*odx + ody*ody + odz*odz);
        
        // Si le point est plus proche d'un autre centre, il n'appartient pas à cette cellule de Voronoi
        if (distanceToOtherCenter < distanceToOwnCenter) {
          return false;
        }
      }
      
      // Le point est plus proche de ce centre que de tout autre centre
      return true;
    } 
    // Si la permissivité est > 0, autoriser un débordement contrôlé
    else {
      let minDistanceToBorder = Infinity;
      
      // Vérifier la distance aux frontières Voronoi (distances aux autres centres)
      for (const [otherKey, otherVolume] of Object.entries(volumesByCenterKey)) {
        if (otherKey === characterKey) continue; // Ignorer le même caractère
        
        const odx = point.x - otherVolume.center.x;
        const ody = point.y - otherVolume.center.y;
        const odz = point.z - otherVolume.center.z;
        const distanceToOtherCenter = Math.sqrt(odx*odx + ody*ody + odz*odz);
        
        // La frontière Voronoi est à mi-chemin entre les deux centres
        // Calculer la distance à cette frontière
        const distanceToBorder = distanceToOtherCenter - distanceToOwnCenter;
        
        if (distanceToBorder < minDistanceToBorder) {
          minDistanceToBorder = distanceToBorder;
        }
      }
      
      // Si aucun autre volume n'existe, le point est dans la cellule
      if (minDistanceToBorder === Infinity) return true;
      
      // Calculer le seuil de permissivité basé sur le rayon moyen et le facteur
      const ownVolume = volumesByCenterKey[characterKey];
      const permissivityThreshold = ownVolume.radius * voronoiPermissivity;
      
      // Le point est dans la cellule si:
      // - Il est strictement à l'intérieur (distance à la frontière > 0)
      // - OU il est légèrement à l'extérieur mais dans la limite de permissivité
      return minDistanceToBorder > -permissivityThreshold;
    }
  };
  
  // Fonction pour vérifier si un point est dans la sphère globale
  const isInGlobalSphere = (point) => {
    const d = Math.sqrt(point.x*point.x + point.y*point.y + point.z*point.z);
    return d <= globalSphereRadius;
  };
  
  for (const [characterKey, posts] of Object.entries(postsByCharacter)) {
    const characterNode = characterNodesMap[characterKey];
    const volumeInfo = characterVolumeInfo[characterKey];
    const centerInfo = characterCenters[characterKey];
    
    if (!characterNode || !volumeInfo || !centerInfo) {
      console.warn(`Informations manquantes pour le caractère ${characterKey}, posts ignorés`);
      continue;
    }
    
    // Utiliser directement les coordonnées du nœud character comme centre
    const centerX = characterNode.x;
    const centerY = characterNode.y;
    const centerZ = characterNode.z;
    
    // Utiliser le rayon ajusté (pour éviter les chevauchements)
    const sphereRadius = centerInfo.radius;
    const safeRadius = sphereRadius * 0.95; // 5% de marge de sécurité
    
    console.log(`Placement des posts pour ${characterKey}: ${posts.length} posts dans un volume de rayon ${safeRadius.toFixed(2)} autour de (${centerX.toFixed(1)}, ${centerY.toFixed(1)}, ${centerZ.toFixed(1)})`);
    
    // Positionner chaque post à l'intérieur de la sphère de son caractère
    posts.forEach((post) => {
      let validPosition = false;
      let attempts = 0;
      const maxAttempts = 5000; // Augmenter les tentatives pour garantir un placement correct
      
      while (!validPosition && attempts < maxAttempts) {
        // Utiliser une distribution uniforme dans la sphère
        // Pour une vraie distribution uniforme en volume, on utilise r = R * cubeRoot(random)
        const r = safeRadius * Math.pow(Math.random(), 1/3);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        // Convertir de coordonnées sphériques à cartésiennes - UTILISER LES POSITIONS CALCULÉES
        const candidateX = centerX + r * Math.sin(phi) * Math.cos(theta);
        const candidateY = centerY + r * Math.sin(phi) * Math.sin(theta);
        const candidateZ = centerZ + r * Math.cos(phi);
        
        const candidatePoint = { 
          x: candidateX, 
          y: candidateY, 
          z: candidateZ
        };
        
        // VALIDATION EN TROIS ÉTAPES:
        // 1. Vérifier si le point est dans la cellule de Voronoi de ce caractère
        const inVoronoiCell = isInVoronoiCell(candidatePoint, characterKey);
        
        // 2. Vérifier que le point est dans sa sphère allouée
        const dx = candidateX - centerX;
        const dy = candidateY - centerY;
        const dz = candidateZ - centerZ;
        const distanceToCenter = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const inSphere = distanceToCenter <= safeRadius;
        
        // 3. Vérifier que le point est dans la sphère globale
        const inGlobalSphere = isInGlobalSphere(candidatePoint);
        
        if (inVoronoiCell && inSphere && inGlobalSphere) {
          // Position valide selon tous les critères
          post.x = candidateX;
          post.y = candidateY;
          post.z = candidateZ;
          
          // Marquer ce post comme spatialisé
          post.associatedNodeId = characterNode.id;
          post.associatedNodeSlug = characterNode.slug;
          post.inAllocatedVolume = true;
          post.inVoronoiCell = true;
          
          // Vérifier si le post est dans une zone de chevauchement (si permissivité > 0)
          if (voronoiPermissivity > 0) {
            // Calculer la distance minimale à une frontière Voronoi
            let minDistanceToBorder = Infinity;
            
            for (const [otherKey, otherVolume] of Object.entries(volumesByCenterKey)) {
              if (otherKey === characterKey) continue;
              
              const odx = candidateX - otherVolume.center.x;
              const ody = candidateY - otherVolume.center.y;
              const odz = candidateZ - otherVolume.center.z;
              const distanceToOtherCenter = Math.sqrt(odx*odx + ody*ody + odz*odz);
              
              const distanceToBorder = distanceToOtherCenter - distanceToCenter;
              if (distanceToBorder < minDistanceToBorder) {
                minDistanceToBorder = distanceToBorder;
              }
            }
            
            // Si le post est dans une zone de chevauchement
            if (minDistanceToBorder < 0) {
              post.inBlendedArea = true;
              postsInBlendedArea++;
            }
          }
          
          validPosition = true;
          postsPositioned++;
        }
        
        attempts++;
      }
      
      // Si après plusieurs tentatives on n'a pas trouvé de position valide, 
      // utiliser une approche plus directe en trouvant un point valide près du centre
      if (!validPosition) {
        console.warn(`Pas de position valide trouvée pour un post de ${characterKey} après ${maxAttempts} tentatives, recherche d'une position alternative`);
        
        // Réduire le rayon et chercher en spirale depuis le centre
        let foundPosition = false;
        const spiralSteps = 20;
        const maxRadius = Math.min(safeRadius, globalSphereRadius * 0.9);
        
        for (let radiusStep = 1; radiusStep <= spiralSteps && !foundPosition; radiusStep++) {
          const testRadius = (maxRadius * radiusStep) / spiralSteps;
          
          for (let angleStep = 0; angleStep < 8 && !foundPosition; angleStep++) {
            const testAngle = (angleStep / 8) * Math.PI * 2;
            
            for (let phiStep = 0; phiStep < 4 && !foundPosition; phiStep++) {
              const testPhi = (phiStep / 4) * Math.PI;
              
              const testX = centerX + testRadius * Math.sin(testPhi) * Math.cos(testAngle);
              const testY = centerY + testRadius * Math.sin(testPhi) * Math.sin(testAngle);
              const testZ = centerZ + testRadius * Math.cos(testPhi);
              
              const testPoint = { x: testX, y: testY, z: testZ };
              
              // Vérifier tous les critères
              if (isInVoronoiCell(testPoint, characterKey) && isInGlobalSphere(testPoint)) {
                post.x = testX;
                post.y = testY;
                post.z = testZ;
                
                post.associatedNodeId = characterNode.id;
                post.associatedNodeSlug = characterNode.slug;
                post.inAllocatedVolume = true;
                post.inVoronoiCell = true;
                
                foundPosition = true;
                postsPositioned++;
              }
            }
          }
        }
        
        // En dernier recours, placer très près du centre
        if (!foundPosition) {
          console.warn(`Placement de secours pour un post de ${characterKey} très près du centre`);
          
          // Utiliser un rayon minimal
          const minSafeRadius = Math.min(1.0, safeRadius * 0.05);
          
          // Générer une direction aléatoire
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          
          post.x = centerX + minSafeRadius * Math.sin(phi) * Math.cos(theta);
          post.y = centerY + minSafeRadius * Math.sin(phi) * Math.sin(theta);
          post.z = centerZ + minSafeRadius * Math.cos(phi);
          
          // Marquer ce post comme spatialisé
          post.associatedNodeId = characterNode.id;
          post.associatedNodeSlug = characterNode.slug;
          post.inAllocatedVolume = true;
          post.inVoronoiCell = true; // On suppose que c'est vrai si on est très proche du centre
          
          postsPositioned++;
        }
      }
    });
  }
  
  console.log(`Positionnement avec Voronoi terminé: ${postsPositioned} posts positionnés`);
  if (voronoiPermissivity > 0 && postsInBlendedArea > 0) {
    console.log(`${postsInBlendedArea} posts (${((postsInBlendedArea/postsPositioned)*100).toFixed(1)}%) sont placés dans des zones de transition entre cellules`);
  }

  // ÉTAPE 6: Vérification finale de la contrainte de sphère globale
  let postsOutsideGlobalSphere = 0;
  
  spatializedPosts.forEach(post => {
    // Ignorer les posts sans coordonnées
    if (typeof post.x !== 'number' || typeof post.y !== 'number' || typeof post.z !== 'number') return;
    
    // Calculer la distance au centre de la sphère globale (origine)
    const distanceToOrigin = Math.sqrt(post.x*post.x + post.y*post.y + post.z*post.z);
    
    // Si le post est en dehors de la sphère globale, le ramener à l'intérieur
    if (distanceToOrigin > globalSphereRadius) {
      postsOutsideGlobalSphere++;
      
      // Calculer un facteur d'échelle pour ramener le point à l'intérieur avec une marge de 1%
      const scaleFactor = (globalSphereRadius * 0.99) / distanceToOrigin;
      
      // Appliquer l'échelle
      post.x *= scaleFactor;
      post.y *= scaleFactor;
      post.z *= scaleFactor;
    }
  });
  
  if (postsOutsideGlobalSphere > 0) {
    console.log(`${postsOutsideGlobalSphere} posts étaient en dehors de la sphère globale et ont été contraints`);
  } else {
    console.log("Tous les posts sont correctement contraints dans la sphère globale de rayon", globalSphereRadius);
  }
  
  // ÉTAPE 7: Appliquer le bruit de Perlin uniquement si demandé
  if (perlinScale > 0 && perlinAmplitude > 0) {
    console.log("Application du bruit de Perlin pour la variation");
    console.log(`Facteur de permissivité Voronoi: ${voronoiPermissivity}`);
    
    let postsDisturbed = 0;
    
    spatializedPosts.forEach(post => {
      if (!post.associatedNodeId && !post.associatedNodeSlug) return;
      
      // Récupérer directement le nœud character original
      const characterNode = nodesByIdMap[post.associatedNodeId] || 
                          (post.associatedNodeSlug ? characterNodesMap[post.associatedNodeSlug] : null);
      
      if (!characterNode) return;
      
      // Trouver la clé du caractère
      const characterKey = characterNode.slug || characterNode.id;
      const centerInfo = characterCenters[characterKey];
      
      if (!centerInfo) {
        console.warn(`Pas d'information de volume pour le caractère ${characterKey}, perturbation ignorée`);
        return;
      }
      
      // Vérifier les coordonnées du post
      if (typeof post.x !== 'number' || typeof post.y !== 'number' || typeof post.z !== 'number') return;
      
      // Utiliser le rayon ajusté
      const effectiveRadius = centerInfo.radius;
      
      // Ne pas permettre au post de sortir de sa sphère allouée
      const maxDisturbance = Math.min(perlinAmplitude, effectiveRadius * 0.2);
      
      // Appliquer le bruit de Perlin comme perturbation
      const seed = 42;
      const noiseX = perlinNoise(post.x * perlinScale, post.y * perlinScale * 1.1, post.z * perlinScale * 0.9, 1, seed) * maxDisturbance;
      const noiseY = perlinNoise(post.y * perlinScale * 1.2, post.z * perlinScale * 0.8, post.x * perlinScale * 1.3, 1, seed + 1) * maxDisturbance;
      const noiseZ = perlinNoise(post.z * perlinScale * 0.7, post.x * perlinScale * 1.4, post.y * perlinScale * 1.1, 1, seed + 2) * maxDisturbance;
      
      // Appliquer la perturbation
      post.x += noiseX;
      post.y += noiseY;
      post.z += noiseZ;
      
      // Vérifier si le post est toujours dans sa sphère allouée après perturbation
      const newDx = post.x - centerInfo.x;
      const newDy = post.y - centerInfo.y;
      const newDz = post.z - centerInfo.z;
      const newDistance = Math.sqrt(newDx*newDx + newDy*newDy + newDz*newDz);
      
      // Si le post est sorti de sa sphère, le ramener à l'intérieur
      if (newDistance > effectiveRadius) {
        const scale = effectiveRadius / newDistance * 0.95; // 5% de marge
        post.x = centerInfo.x + newDx * scale;
        post.y = centerInfo.y + newDy * scale;
        post.z = centerInfo.z + newDz * scale;
      }
      
      // Vérifier que le post est toujours dans la cellule de Voronoi après perturbation
      const postPoint = { x: post.x, y: post.y, z: post.z };
      if (!isInVoronoiCell(postPoint, characterKey)) {
        // Si le post est sorti de sa cellule de Voronoi, annuler la perturbation
        post.x = centerInfo.x + newDx * 0.5; // Réduire le déplacement de moitié
        post.y = centerInfo.y + newDy * 0.5;
        post.z = centerInfo.z + newDz * 0.5;
      }
      
      // Vérifier que le post est toujours dans la sphère globale
      const distanceToOrigin = Math.sqrt(post.x*post.x + post.y*post.y + post.z*post.z);
      if (distanceToOrigin > globalSphereRadius) {
        const scaleFactor = (globalSphereRadius * 0.99) / distanceToOrigin;
        post.x *= scaleFactor;
        post.y *= scaleFactor;
        post.z *= scaleFactor;
      }
      
      postsDisturbed++;
    });
    
    console.log(`Variation terminée: ${postsDisturbed} posts perturbés avec du bruit de Perlin`);
  }

  // ÉTAPE FINALE: Uniformisation itérative de la densité
  console.log("Début de l'uniformisation itérative de la densité");

  const GRID_SIZE = 16;
  const voxelSize = (globalSphereRadius * 2) / GRID_SIZE;
  const voxels = new Map();
  
  const getVoxelKey = (x, y, z) => {
    const vx = Math.floor((x + globalSphereRadius) / voxelSize);
    const vy = Math.floor((y + globalSphereRadius) / voxelSize);
    const vz = Math.floor((z + globalSphereRadius) / voxelSize);
    return `${vx},${vy},${vz}`;
  };

  const isVoxelInSphere = (vx, vy, vz) => {
    const centerX = (vx + 0.5) * voxelSize - globalSphereRadius;
    const centerY = (vy + 0.5) * voxelSize - globalSphereRadius;
    const centerZ = (vz + 0.5) * voxelSize - globalSphereRadius;
    return Math.sqrt(centerX * centerX + centerY * centerY + centerZ * centerZ) <= globalSphereRadius;
  };

  let totalVoxelsInSphere = 0;
  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (isVoxelInSphere(x, y, z)) {
          totalVoxelsInSphere++;
        }
      }
    }
  }

  const targetDensityPerVoxel = Math.ceil(spatializedPosts.length / totalVoxelsInSphere);
  const MAX_ITERATIONS = 10;
  const CONVERGENCE_THRESHOLD = 0.1;
  let iteration = 0;
  let previousEmptyVoxels = Infinity;

  function redistributePosts() {
    voxels.clear();
    
    spatializedPosts.forEach(post => {
      if (typeof post.x !== 'number' || typeof post.y !== 'number' || typeof post.z !== 'number') return;
      const voxelKey = getVoxelKey(post.x, post.y, post.z);
      if (!voxels.has(voxelKey)) {
        voxels.set(voxelKey, []);
      }
      voxels.get(voxelKey).push(post);
    });

    const emptyVoxels = [];
    const denseVoxels = [];
    
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let z = 0; z < GRID_SIZE; z++) {
          if (!isVoxelInSphere(x, y, z)) continue;
          
          const voxelKey = `${x},${y},${z}`;
          const postsInVoxel = voxels.get(voxelKey) || [];
          
          if (postsInVoxel.length === 0) {
            const centerX = (x + 0.5) * voxelSize - globalSphereRadius;
            const centerY = (y + 0.5) * voxelSize - globalSphereRadius;
            const centerZ = (z + 0.5) * voxelSize - globalSphereRadius;
            
            const distanceToCenter = Math.sqrt(centerX * centerX + centerY * centerY + centerZ * centerZ);
            if (distanceToCenter <= globalSphereRadius * 0.95) {
              emptyVoxels.push({
                key: voxelKey,
                center: { x: centerX, y: centerY, z: centerZ }
              });
            }
          } else if (postsInVoxel.length > targetDensityPerVoxel * 1.2) {
            denseVoxels.push({
              key: voxelKey,
              posts: postsInVoxel,
              density: postsInVoxel.length,
              center: {
                x: (x + 0.5) * voxelSize - globalSphereRadius,
                y: (y + 0.5) * voxelSize - globalSphereRadius,
                z: (z + 0.5) * voxelSize - globalSphereRadius
              }
            });
          }
        }
      }
    }

    if (emptyVoxels.length === 0) {
      return { emptyVoxels: 0, improvement: 0 };
    }

    denseVoxels.sort((a, b) => b.density - a.density);

    emptyVoxels.forEach(emptyVoxel => {
      const sortedDenseVoxels = denseVoxels
        .filter(dv => dv.density > targetDensityPerVoxel)
        .sort((a, b) => {
          const distA = Math.sqrt(
            Math.pow(a.center.x - emptyVoxel.center.x, 2) +
            Math.pow(a.center.y - emptyVoxel.center.y, 2) +
            Math.pow(a.center.z - emptyVoxel.center.z, 2)
          );
          const distB = Math.sqrt(
            Math.pow(b.center.x - emptyVoxel.center.x, 2) +
            Math.pow(b.center.y - emptyVoxel.center.y, 2) +
            Math.pow(b.center.z - emptyVoxel.center.z, 2)
          );
          return distA - distB;
        });

      let postsToMove = [];
      const targetCount = Math.ceil(targetDensityPerVoxel * 0.7);

      for (const denseVoxel of sortedDenseVoxels) {
        if (postsToMove.length >= targetCount) break;
        
        const availablePosts = denseVoxel.posts;
        const postsToTake = Math.min(
          targetCount - postsToMove.length,
          Math.floor(availablePosts.length - targetDensityPerVoxel)
        );

        if (postsToTake <= 0) continue;

        const selectedPosts = availablePosts
          .slice(0, postsToTake)
          .sort((a, b) => {
            const distA = Math.sqrt(
              Math.pow(a.x - emptyVoxel.center.x, 2) +
              Math.pow(a.y - emptyVoxel.center.y, 2) +
              Math.pow(a.z - emptyVoxel.center.z, 2)
            );
            const distB = Math.sqrt(
              Math.pow(b.x - emptyVoxel.center.x, 2) +
              Math.pow(b.y - emptyVoxel.center.y, 2) +
              Math.pow(b.z - emptyVoxel.center.z, 2)
            );
            return distA - distB;
          });

        postsToMove = postsToMove.concat(selectedPosts);

        selectedPosts.forEach(post => {
          const index = availablePosts.indexOf(post);
          if (index !== -1) {
            availablePosts.splice(index, 1);
          }
        });

        denseVoxel.density = availablePosts.length;
      }

      if (postsToMove.length > 0) {
        postsToMove.forEach((post) => {
          const effectiveSize = voxelSize * 0.8;
          const localX = (Math.random() - 0.5) * effectiveSize;
          const localY = (Math.random() - 0.5) * effectiveSize;
          const localZ = (Math.random() - 0.5) * effectiveSize;
          
          post.x = emptyVoxel.center.x + localX;
          post.y = emptyVoxel.center.y + localY;
          post.z = emptyVoxel.center.z + localZ;

          const distanceToOrigin = Math.sqrt(
            post.x * post.x + post.y * post.y + post.z * post.z
          );
          if (distanceToOrigin > globalSphereRadius) {
            const scale = (globalSphereRadius * 0.99) / distanceToOrigin;
            post.x *= scale;
            post.y *= scale;
            post.z *= scale;
          }
        });
      }
    });

    let emptyVoxelsAfter = 0;
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        for (let z = 0; z < GRID_SIZE; z++) {
          if (!isVoxelInSphere(x, y, z)) continue;
          const voxelKey = `${x},${y},${z}`;
          const postsInVoxel = voxels.get(voxelKey) || [];
          if (postsInVoxel.length === 0) emptyVoxelsAfter++;
        }
      }
    }

    return {
      emptyVoxels: emptyVoxelsAfter,
      improvement: previousEmptyVoxels - emptyVoxelsAfter
    };
  }

  while (iteration < MAX_ITERATIONS) {
    console.log(`\nItération ${iteration + 1}/${MAX_ITERATIONS}`);
    
    const result = redistributePosts();
    const improvement = result.improvement;
    const currentEmptyVoxels = result.emptyVoxels;

    console.log(`- Voxels vides: ${currentEmptyVoxels}`);
    console.log(`- Amélioration: ${improvement}`);

    if (improvement < CONVERGENCE_THRESHOLD || currentEmptyVoxels === 0) {
      console.log(`Convergence atteinte après ${iteration + 1} itérations`);
      break;
    }

    previousEmptyVoxels = currentEmptyVoxels;
    iteration++;
  }

  const finalStats = {
    min: Infinity,
    max: 0,
    total: 0,
    voxels: 0,
    empty: 0
  };

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (!isVoxelInSphere(x, y, z)) continue;
        
        const voxelKey = getVoxelKey(
          (x + 0.5) * voxelSize - globalSphereRadius,
          (y + 0.5) * voxelSize - globalSphereRadius,
          (z + 0.5) * voxelSize - globalSphereRadius
        );
        const postsInVoxel = voxels.get(voxelKey) || [];
        
        if (postsInVoxel.length === 0) {
          finalStats.empty++;
        } else {
          finalStats.min = Math.min(finalStats.min, postsInVoxel.length);
          finalStats.max = Math.max(finalStats.max, postsInVoxel.length);
          finalStats.total += postsInVoxel.length;
          finalStats.voxels++;
        }
      }
    }
  }

  console.log({
    "Voxels vides": finalStats.empty,
    "Densité minimale": finalStats.min,
    "Densité maximale": finalStats.max,
    "Densité moyenne": (finalStats.total / finalStats.voxels).toFixed(2)
  });

  // ÉTAPE FINALE: Ajout de bruit pour casser l'aspect cubique des voxels
  console.log("Application d'une perturbation finale pour casser l'aspect cubique");
  
  const finalNoiseScale = 0.1; // Échelle plus fine que le bruit précédent
  const finalNoiseAmplitude = voxelSize * 2.0; // 30% de la taille d'un voxel
  const finalSeed = Math.floor(Math.random() * 10000); // Seed aléatoire
  
  spatializedPosts.forEach(post => {
    if (typeof post.x !== 'number' || typeof post.y !== 'number' || typeof post.z !== 'number') return;

    // Calculer le bruit avec des fréquences différentes pour chaque axe
    const noiseX = perlinNoise(
      post.x * finalNoiseScale,
      post.y * finalNoiseScale * 1.1,
      post.z * finalNoiseScale * 0.9,
      1,
      finalSeed
    ) * finalNoiseAmplitude;

    const noiseY = perlinNoise(
      post.y * finalNoiseScale * 1.2,
      post.z * finalNoiseScale * 0.8,
      post.x * finalNoiseScale * 1.3,
      1,
      finalSeed + 1
    ) * finalNoiseAmplitude;

    const noiseZ = perlinNoise(
      post.z * finalNoiseScale * 0.7,
      post.x * finalNoiseScale * 1.4,
      post.y * finalNoiseScale * 1.1,
      1,
      finalSeed + 2
    ) * finalNoiseAmplitude;

    // Appliquer la perturbation
    post.x += noiseX;
    post.y += noiseY;
    post.z += noiseZ;

    // S'assurer que le point reste dans la sphère globale
    const distanceToOrigin = Math.sqrt(post.x * post.x + post.y * post.y + post.z * post.z);
    if (distanceToOrigin > globalSphereRadius) {
      const scale = (globalSphereRadius * 0.99) / distanceToOrigin;
      post.x *= scale;
      post.y *= scale;
      post.z *= scale;
    }
  });

  console.log("Perturbation finale appliquée pour casser la régularité des voxels");

  return spatializedPosts;
}
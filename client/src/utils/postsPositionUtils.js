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
    // Option pour les couleurs uniques par personnage
    useUniqueColorsPerCharacter = true,
    // Nœuds personnalisés avec positions actuelles de la simulation
    customNodes = null
  } = options;

  // Utiliser les nœuds personnalisés s'ils sont fournis, sinon utiliser les nœuds standards
  const nodesData = customNodes || nodes;
  
  console.log(`Spatialisation des posts: utilisation de ${customNodes ? 'nœuds personnalisés' : 'nœuds standards'} (${nodesData.length} nœuds)`);
  
  if (nodesData.length === 0) {
    console.warn("Aucun nœud disponible pour la spatialisation des posts");
    return posts;
  }
  
  // Afficher les 5 premiers nœuds pour débogage
  if (nodesData.length > 0) {
    console.log("Échantillon de nœuds pour spatialisation:", 
      nodesData.slice(0, 5).map(n => ({ 
        id: n.id, 
        slug: n.slug, 
        type: n.type, 
        isJoshua: n.isJoshua,
        pos: [Math.round(n.x), Math.round(n.y), Math.round(n.z)]
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
      
      // Indexer les nœuds de type character
      if (node.type === 'character') {
        characterNodesMap[node.slug] = node;
        
        // Si le noeud est marqué comme Joshua, l'ajouter aux ensembles
        if (node.isJoshua === true) {
          joshuaCharacterSlugs.add(node.slug);
          if (node.id) {
            joshuaCharacterIds.add(node.id);
          }
        }
      }
    }
  });
  
  console.log(`Nombre de personnages Joshua identifiés: ${joshuaCharacterSlugs.size} (par slug) et ${joshuaCharacterIds.size} (par id)`);
  
  // Cache pour les couleurs générées par personnage
  const characterColorCache = {};
  
  // Positionner chaque post en fonction de son slug (identifiant du personnage)
  return posts.map(post => {
    // Trouver le nœud correspondant en essayant plusieurs stratégies
    let characterNode = null;
    let isJoshuaPost = false;
    let characterSlug = null;
    
    // Stratégie 1: Utiliser le slug du post directement
    if (post.slug) {
      characterSlug = post.slug;
      characterNode = nodesMap[characterSlug] || characterNodesMap[characterSlug];
      isJoshuaPost = post.isJoshuaCharacter === true || joshuaCharacterSlugs.has(characterSlug);
    }
    
    // Stratégie 2: Utiliser le champ character du post comme fallback
    if (!characterNode && post.character) {
      characterSlug = post.character;
      characterNode = nodesMap[characterSlug] || characterNodesMap[characterSlug];
      isJoshuaPost = post.isJoshuaCharacter === true || joshuaCharacterSlugs.has(characterSlug);
    }
    
    // Stratégie 3: Essayer de trouver par ID
    if (!characterNode && post.id) {
      const nodeById = nodesByIdMap[post.id];
      if (nodeById) {
        characterNode = nodeById;
        characterSlug = nodeById.slug || nodeById.id;
        isJoshuaPost = nodeById.isJoshua === true || joshuaCharacterIds.has(post.id);
      }
    }
    
    // Si aucun nœud n'est trouvé avec les stratégies précédentes
    if (!characterNode || !characterSlug) {
      // Conserver le post intact si aucun nœud correspondant n'est trouvé
      return post;
    }
    
    // Si joshuaOnly est true, on ne repositionne que les posts des personnages Joshua
    // Si preserveOtherPositions est true, on conserve les positions existantes des autres posts
    if (joshuaOnly && !isJoshuaPost && preserveOtherPositions) {
      return post; // Conserver le post intact
    }
    
    // Préparer les options pour le calcul de position
    const postOptions = {
      radius,
      minDistance,
      verticalSpread,
      horizontalSpread,
      // Transmettre également les nouveaux paramètres
      perlinScale,
      perlinAmplitude,
      dilatationFactor
    };
    
    // Calculer de nouvelles coordonnées pour ce post avec l'algorithme Voronoi
    const coordinates = calculatePostPosition(characterNode, postOptions);
    
    // Si on utilise des couleurs uniques par personnage, les générer ou récupérer du cache
    let color = post.color;
    if (useUniqueColorsPerCharacter) {
      if (!characterColorCache[characterSlug]) {
        characterColorCache[characterSlug] = generateCharacterColor(
          characterSlug, 
          isJoshuaPost
        );
      }
      color = characterColorCache[characterSlug];
    }
    
    // Retourner le post avec ses nouvelles coordonnées et éventuellement sa couleur
    return {
      ...post,
      coordinates,
      color: color || post.color || [0.8, 0.4, 0.0]
    };
  });
}

/**
 * Génère un vecteur de flowfield pour une position donnée
 * Le flowfield est basé sur un bruit de Perlin 3D
 *
 * @param {Object} position - Position {x, y, z} à évaluer dans le flowfield
 * @param {Object} options - Options du flowfield
 * @param {number} options.scale - Échelle du bruit (défaut: 0.02)
 * @param {number} options.strength - Force du vecteur généré (défaut: 2)
 * @param {number} options.time - Temps utilisé pour l'animation (défaut: 0)
 * @returns {Object} Vecteur {x, y, z} indiquant la direction du flow
 */
function generateFlowfieldVector(position, options = {}) {
  const scale = options.scale || 0.02;
  const strength = options.strength || 2;
  const time = options.time || 0;

  // Utiliser des fonctions trigonométriques pour simuler le bruit de Perlin
  // car nous n'avons pas accès à une vraie implémentation de Perlin noise ici
  const x = position.x * scale;
  const y = position.y * scale;
  const z = position.z * scale;
  const t = time * 0.2;

  // Calculer des composantes de direction à partir de sin/cos pour simuler un champ de vecteurs
  const vx = Math.sin(y + t) * Math.cos(z * 0.5) * strength;
  const vy = Math.sin(z + t) * Math.cos(x * 0.5) * strength;
  const vz = Math.sin(x + t) * Math.cos(y * 0.5) * strength;

  return { x: vx, y: vy, z: vz };
}

/**
 * Anime les posts dans un flowfield pendant plusieurs frames
 *
 * @param {Array} posts - Liste des posts avec leurs positions
 * @param {Object} options - Options pour l'animation flowfield
 * @param {number} options.frames - Nombre de frames d'animation (défaut: 10)
 * @param {number} options.flowScale - Échelle du flowfield (défaut: 0.02)
 * @param {number} options.flowStrength - Force du flowfield (défaut: 2)
 * @returns {Promise<Array>} Promise résolue avec les posts animés
 */
export function animatePostsInFlowfield(posts, options = {}) {
  return new Promise((resolve) => {
    const frames = options.frames || 10;
    const flowScale = options.flowScale || 0.02;
    const flowStrength = options.flowStrength || 2;

    // Créer une copie profonde des posts pour éviter de modifier l'original
    const animatedPosts = JSON.parse(JSON.stringify(posts));

    // Compteur de frames
    let currentFrame = 0;

    // Fonction pour effectuer une étape d'animation
    const animate = () => {
      // Incrémenter le compteur
      currentFrame++;

      // Mettre à jour les positions selon le flowfield
      for (let i = 0; i < animatedPosts.length; i++) {
        const post = animatedPosts[i];

        // Obtenir le vecteur de flow pour cette position
        const flowVector = generateFlowfieldVector(post.coordinates, {
          scale: flowScale,
          strength: flowStrength * (1 - currentFrame / frames), // Réduire la force au fil du temps
          time: currentFrame,
        });

        // Appliquer le vecteur à la position
        post.coordinates.x += flowVector.x;
        post.coordinates.y += flowVector.y;
        post.coordinates.z += flowVector.z;
      }

      // Continuer l'animation si nécessaire
      if (currentFrame < frames) {
        // Utiliser requestAnimationFrame si disponible, sinon setTimeout
        if (typeof window !== "undefined" && window.requestAnimationFrame) {
          window.requestAnimationFrame(animate);
        } else {
          setTimeout(animate, 16); // ~60fps
        }
      } else {
        // Animation terminée, résoudre la promesse
        console.log(`Animation flowfield terminée après ${frames} frames`);
        resolve(animatedPosts);
      }
    };

    // Démarrer l'animation
    console.log(`Début de l'animation flowfield pour ${posts.length} posts`);
    animate();
  });
}

/**
 * Normalise les positions des posts pour qu'ils soient tous contenus dans une sphère
 * avec une distribution volumique plus uniforme
 *
 * @param {Array} posts - Liste des posts à normaliser
 * @param {Object} options - Options de normalisation
 * @param {number} options.sphereRadius - Rayon de la sphère (défaut: 100)
 * @param {Object} options.center - Centre de la sphère (défaut: {x: 0, y: 0, z: 0})
 * @param {number} options.volumeExponent - Exposant pour la redistribution volumique (défaut: 1/3)
 * @param {number} options.minRadius - Rayon minimum depuis le centre (défaut: 0.1)
 * @param {number} options.jitter - Facteur de variation aléatoire des positions (défaut: 0.1)
 * @returns {Array} Posts avec coordonnées normalisées
 */
export function normalizePostsInSphere(posts, options = {}) {
  const sphereRadius = options.sphereRadius || 100;
  const center = options.center || { x: 0, y: 0, z: 0 };
  const volumeExponent =
    options.volumeExponent !== undefined ? options.volumeExponent : 1 / 3;
  const minRadius = options.minRadius || sphereRadius * 0.1; // 10% du rayon comme minimum
  const jitter = options.jitter !== undefined ? options.jitter : 0.1; // 10% de variation aléatoire

  if (!posts || posts.length === 0) {
    return posts;
  }

  console.log(
    `Redistribution volumique de ${posts.length} posts dans une sphère de rayon ${sphereRadius}`
  );

  // Calculer et stocker la direction et la distance de chaque post par rapport au centre
  const postsWithSphericalInfo = posts.map((post) => {
    const dx = post.coordinates.x - center.x;
    const dy = post.coordinates.y - center.y;
    const dz = post.coordinates.z - center.z;

    // Distance euclidienne au centre
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Si la distance est nulle (post au centre), générer une direction aléatoire
    let direction;
    if (distance < 0.0001) {
      // Générer des coordonnées aléatoires pour la direction
      const randomX = Math.random() * 2 - 1; // Entre -1 et 1
      const randomY = Math.random() * 2 - 1;
      const randomZ = Math.random() * 2 - 1;

      // Normaliser pour obtenir un vecteur unitaire
      const randomLength = Math.sqrt(
        randomX * randomX + randomY * randomY + randomZ * randomZ
      );
      direction = {
        x: randomX / randomLength,
        y: randomY / randomLength,
        z: randomZ / randomLength,
      };
    } else {
      // Normaliser la direction (vecteur unitaire)
      direction = {
        x: dx / distance,
        y: dy / distance,
        z: dz / distance,
      };
    }

    return {
      post,
      direction,
      originalDistance: distance,
    };
  });

  // Tri des posts par distance pour la redistribution volumique
  postsWithSphericalInfo.sort(
    (a, b) => a.originalDistance - b.originalDistance
  );

  // Redistribution volumique des distances
  const normalizedPosts = postsWithSphericalInfo.map((item, index) => {
    // Calcul du pourcentage volumique basé sur l'index (0 à 1)
    const volumeRatio = index / (postsWithSphericalInfo.length - 1);

    // Transformation du ratio volumique en distance radiale avec exposant pour distribution volumique
    // L'exposant 1/3 (racine cubique) donne une distribution uniforme dans le volume de la sphère
    let newDistance =
      Math.pow(volumeRatio, volumeExponent) * (sphereRadius - minRadius) +
      minRadius;

    // Ajouter un peu de jitter (variation aléatoire) pour éviter une trop grande régularité
    if (jitter > 0) {
      const jitterAmount =
        ((Math.random() * 2 - 1) * jitter * (sphereRadius - minRadius)) /
        postsWithSphericalInfo.length;
      newDistance = Math.max(
        minRadius,
        Math.min(sphereRadius, newDistance + jitterAmount)
      );
    }

    // Calculer les nouvelles coordonnées en appliquant la distance à la direction
    const newCoordinates = {
      x: center.x + item.direction.x * newDistance,
      y: center.y + item.direction.y * newDistance,
      z: center.z + item.direction.z * newDistance,
    };

    // Retourner le post avec ses nouvelles coordonnées
    return {
      ...item.post,
      coordinates: newCoordinates,
    };
  });

  console.log(
    `Redistribution terminée - tous les posts sont répartis dans une sphère de rayon ${sphereRadius}`
  );
  return normalizedPosts;
}

/**
 * Met à jour les positions des posts en fonction des positions actuelles des nœuds du graphe
 * dans le contexte de l'application.
 * 
 * @param {Array|Object} postsData - Tableau de posts ou objet contenant les posts
 * @param {Array|Object} graphData - Tableau de nœuds ou objet contenant les nœuds du graphe
 * @param {Object} options - Options de mise à jour
 * @param {boolean} options.joshuaOnly - Ne mettre à jour que les posts des personnages Joshua (défaut: true)
 * @param {boolean} options.preserveOtherPositions - Préserver les positions existantes des autres posts (défaut: true)
 * @param {number} options.radius - Rayon maximal de dispersion (défaut: 15)
 * @param {number} options.minDistance - Distance minimale du nœud (défaut: 5)
 * @param {number} options.verticalSpread - Facteur de dispersion verticale (défaut: 1)
 * @param {number} options.horizontalSpread - Facteur de dispersion horizontale (défaut: 1)
 * @param {boolean} options.useFlowfield - Appliquer une animation flowfield (défaut: true)
 * @param {number} options.flowFrames - Nombre d'images pour l'animation flowfield (défaut: 10)
 * @param {number} options.flowScale - Échelle du flowfield (défaut: 0.02)
 * @param {number} options.flowStrength - Force du flowfield (défaut: 2)
 * @param {boolean} options.normalizeInSphere - Normaliser les positions dans une sphère (défaut: true)
 * @param {number} options.sphereRadius - Rayon de la sphère (défaut: 100)
 * @param {number} options.perlinScale - Échelle du bruit de Perlin (défaut: 0.05)
 * @param {number} options.perlinAmplitude - Amplitude du bruit de Perlin (défaut: 5)
 * @param {number} options.dilatationFactor - Facteur de dilatation pour l'effet Voronoï (défaut: 1.2)
 * @param {Array} options.customNodes - Positions personnalisées des nœuds (à utiliser à la place de graphData.nodes)
 * @param {Function} updateCallback - Fonction de rappel pour mettre à jour les posts (optionnel)
 * @returns {Array} Posts avec positions mises à jour
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
    console.log(`Utilisation de ${options.customNodes.length} nœuds personnalisés pour la mise à jour des positions`);
    
    // Spatialiser les posts autour des nœuds personnalisés
    const initialPosts = spatializePostsAroundJoshuaNodes(posts, [], {
      ...options,
      customNodes: options.customNodes
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
  // Options pour le flowfield et la normalisation sphérique
  const useFlowfield =
    options.useFlowfield !== undefined ? options.useFlowfield : true;
  const normalizeInSphere =
    options.normalizeInSphere !== undefined ? options.normalizeInSphere : true;
  const sphereRadius = options.sphereRadius || 100;

  const flowOptions = {
    frames: options.flowFrames || 10,
    flowScale: options.flowScale || 0.02,
    flowStrength: options.flowStrength || 2,
  };

  // Si l'animation flowfield est activée, l'exécuter
  if (useFlowfield) {
    // Commencer par mettre à jour avec les positions initiales
    if (typeof updateCallback === "function") {
      updateCallback(initialPosts);
    }

    // Puis lancer l'animation et mettre à jour progressivement
    return animatePostsInFlowfield(initialPosts, flowOptions)
      .then((animatedPosts) => {
        console.log(
          "Animation flowfield terminée, finalisation des positions..."
        );

        // Normaliser dans une sphère si demandé
        let finalPosts = animatedPosts;
        if (normalizeInSphere) {
          finalPosts = normalizePostsInSphere(animatedPosts, { sphereRadius });
        }

        // Mettre à jour avec les positions finales
        if (typeof updateCallback === "function") {
          updateCallback(finalPosts);
        }
        return finalPosts;
      })
      .catch((error) => {
        console.error("Erreur lors de l'animation des posts:", error);
        return initialPosts;
      });
  } else {
    // Si pas d'animation, simplement normaliser si demandé
    let finalPosts = initialPosts;
    if (normalizeInSphere) {
      finalPosts = normalizePostsInSphere(initialPosts, { sphereRadius });
    }

    // Mettre à jour avec les positions finales
    if (typeof updateCallback === "function") {
      updateCallback(finalPosts);
    }
    return finalPosts;
  }
}

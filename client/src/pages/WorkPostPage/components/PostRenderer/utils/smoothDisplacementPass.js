/**
 * Module pour la passe de déformation Displacement
 * Cette passe applique un déplacement radial basé sur du bruit de Perlin
 * pour créer une texture organique à la surface de la sphère
 */

/**
 * Génère une valeur de bruit de Perlin approximative
 *
 * @param {number} x - Coordonnée x
 * @param {number} y - Coordonnée y
 * @param {number} z - Coordonnée z
 * @param {number} scale - Échelle du bruit
 * @param {number} seed - Valeur de graine pour la randomisation
 * @returns {number} Valeur de bruit entre -1 et 1
 */
function perlinNoise(x, y, z, scale = 1, seed = 0) {
  // Ajuster les coordonnées avec l'échelle et le seed
  x = x * scale + seed;
  y = y * scale + seed * 2;
  z = z * scale + seed * 3;

  // Utiliser des fonctions trigonométriques pour simuler le bruit de Perlin
  // Cette méthode n'est pas un vrai bruit de Perlin mais donne un effet similaire
  const noise =
    Math.sin(x * 1.7 + Math.sin(y * 0.5) + Math.sin(z * 0.3)) * 0.5 +
    Math.sin(y * 2.3 + Math.sin(z * 0.7) + Math.sin(x * 0.9)) * 0.3 +
    Math.sin(z * 1.9 + Math.sin(x * 1.1) + Math.sin(y * 0.5)) * 0.2;

  // Normaliser entre -1 et 1
  return noise;
}

/**
 * Applique un déplacement radial basé sur du bruit de Perlin à des posts
 * disposés dans une sphère
 *
 * @param {Array} posts - Liste des posts à déplacer
 * @param {Object} options - Options de déplacement
 * @param {number} options.intensity - Intensité du déplacement (défaut: 10)
 * @param {number} options.frequency - Fréquence du bruit de Perlin (défaut: 0.05)
 * @param {number} options.seed - Valeur de graine pour le bruit (défaut: 42)
 * @param {Object} options.center - Centre de la sphère (défaut: {x: 0, y: 0, z: 0})
 * @param {number} options.minRadius - Rayon minimal à préserver (défaut: 0)
 * @returns {Promise<Array>} Promise résolue avec les posts déplacés
 */
export async function applyRadialDisplacement(posts, options = {}) {
  const intensity = options.intensity || 10;
  const frequency = options.frequency || 0.05;
  const seed = options.seed || 42;
  const center = options.center || { x: 0, y: 0, z: 0 };
  const minRadius = options.minRadius || 0;
  const globalSphereRadius = options.globalSphereRadius;

  if (!posts || posts.length === 0) {
    console.warn("Aucun post à déplacer, retournant la liste vide");
    return posts;
  }

  console.log("=== DÉBUT DU DÉPLACEMENT RADIAL ===");
  console.log(
    `Application de déplacement radial avec du bruit de Perlin sur ${posts.length} posts (intensité: ${intensity}, fréquence: ${frequency}, seed: ${seed})`
  );

  // Pour le debugging, échantillonner quelques posts avant déplacement
  if (posts.length > 0) {
    const samplePost = posts[0];
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
    for (const post of posts) {
      // Vérifier que les coordonnées sont numériques
      if (
        typeof post.x === "number" &&
        typeof post.y === "number" &&
        typeof post.z === "number"
      ) {
        const dx = post.x - center.x;
        const dy = post.y - center.y;
        const dz = post.z - center.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!isNaN(distance) && isFinite(distance)) {
          validDistances.push(distance);
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

  // Appliquer le déplacement à chaque post
  const displacedPosts = posts.map((post) => {
    // S'assurer que les coordonnées existent
    if (post.x === undefined || post.y === undefined || post.z === undefined) {
      // Initialiser les coordonnées si elles n'existent pas
      return {
        ...post,
        x: 0,
        y: 0,
        z: 0,
      };
    }

    // S'assurer que les coordonnées sont numériques
    const x = typeof post.x === "number" ? post.x : 0;
    const y = typeof post.y === "number" ? post.y : 0;
    const z = typeof post.z === "number" ? post.z : 0;

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

    // Calculer l'atténuation basée sur la distance au centre
    // Plus on est proche du centre (distance faible), plus l'atténuation est forte
    const maxDistance = globalSphereRadius || Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    const attenuationFactor = Math.pow(distance / maxDistance, 2); // Fonction quadratique pour une atténuation progressive

    // Appliquer le déplacement dans la direction radiale avec atténuation
    const displacementFactor = intensity * noiseValue * attenuationFactor;

    // Appliquer le déplacement dans la direction radiale
    const newPost = {
      ...post,
      x: x + dirX * displacementFactor,
      y: y + dirY * displacementFactor,
      z: z + dirZ * displacementFactor,
      // Attribut additionnel pour tracking
      displacementValue: displacementFactor,
      attenuationValue: attenuationFactor // Pour debug
    };

    return newPost;
  });

  // Pour le debugging, échantillonner quelques posts après déplacement
  if (displacedPosts.length > 0) {
    const samplePost = displacedPosts[0];
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
    for (const post of displacedPosts) {
      // Vérifier que les coordonnées sont numériques
      if (
        typeof post.x === "number" &&
        typeof post.y === "number" &&
        typeof post.z === "number"
      ) {
        const dx = post.x - center.x;
        const dy = post.y - center.y;
        const dz = post.z - center.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (!isNaN(distance) && isFinite(distance)) {
          validDistances.push(distance);
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
    console.log("=== FIN DU DÉPLACEMENT RADIAL ===");
  }

  return displacedPosts;
}

export default {
  applyRadialDisplacement,
};

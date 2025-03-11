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
 * @returns {Array} Posts avec coordonnées déplacées
 */
export function applyRadialDisplacement(posts, options = {}) {
  const intensity = options.intensity || 10;
  const frequency = options.frequency || 0.05;
  const seed = options.seed || 42;
  const center = options.center || { x: 0, y: 0, z: 0 };
  const minRadius = options.minRadius || 0;

  if (!posts || posts.length === 0) {
    return posts;
  }

  console.log(
    `Application de déplacement radial avec du bruit de Perlin sur ${posts.length} posts (intensité: ${intensity}, fréquence: ${frequency})`
  );

  // Appliquer le déplacement à chaque post
  const displacedPosts = posts.map((post) => {
    // Calculer le vecteur de direction depuis le centre
    const dx = post.coordinates.x - center.x;
    const dy = post.coordinates.y - center.y;
    const dz = post.coordinates.z - center.z;

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
    // Le déplacement est plus fort à la surface et s'atténue vers le centre
    const displacementFactor =
      intensity * noiseValue * (distance / (distance + minRadius));

    // Appliquer le déplacement dans la direction radiale
    const newCoordinates = {
      x: post.coordinates.x + dirX * displacementFactor,
      y: post.coordinates.y + dirY * displacementFactor,
      z: post.coordinates.z + dirZ * displacementFactor,
    };

    // Créer une copie du post avec les nouvelles coordonnées
    return {
      ...post,
      coordinates: newCoordinates,
    };
  });

  return displacedPosts;
}

export default {
  applyRadialDisplacement,
};

/**
 * Module pour la passe de déformation Spherize
 * Cette passe normalise les positions dans une sphère pour assurer
 * une distribution homogène et contenir l'ensemble dans un volume défini
 */

/**
 * Normalise les positions des posts dans une sphère
 * en redistribuant les coordonnées volumétriquement
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
    // Utiliser les coordonnées à plat (s'assurer qu'elles existent)
    const x = post.x !== undefined ? post.x : 0;
    const y = post.y !== undefined ? post.y : 0;
    const z = post.z !== undefined ? post.z : 0;

    const dx = x - center.x;
    const dy = y - center.y;
    const dz = z - center.z;

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
      ...post,
      _spherical: {
        direction,
        distance,
      },
    };
  });

  // Trier les posts par distance pour la redistribution volumique
  postsWithSphericalInfo.sort(
    (a, b) => a._spherical.distance - b._spherical.distance
  );

  // Redistribuer les distances pour une distribution uniforme dans le volume de la sphère
  const normalizedPosts = postsWithSphericalInfo.map((post, index) => {
    // Calculer la nouvelle distance pour une distribution volumique
    // Formule: (index / total) ^ volumeExponent * (radius - minRadius) + minRadius
    const t = index / (postsWithSphericalInfo.length - 1 || 1);
    let newDistance =
      Math.pow(t, volumeExponent) * (sphereRadius - minRadius) + minRadius;

    // Ajouter un peu de variation aléatoire pour éviter un arrangement trop régulier
    if (jitter > 0) {
      const jitterAmount = (Math.random() * 2 - 1) * jitter; // Entre -jitter et +jitter
      newDistance *= 1 + jitterAmount;
    }

    // Appliquer la nouvelle distance dans la direction d'origine
    const newX = center.x + post._spherical.direction.x * newDistance;
    const newY = center.y + post._spherical.direction.y * newDistance;
    const newZ = center.z + post._spherical.direction.z * newDistance;

    // Créer une copie du post avec les nouvelles coordonnées, sans les infos sphériques temporaires
    const { _spherical, ...postWithoutSpherical } = post;
    return {
      ...postWithoutSpherical,
      x: newX,
      y: newY,
      z: newZ,
    };
  });

  return normalizedPosts;
}

export default {
  normalizePostsInSphere,
};

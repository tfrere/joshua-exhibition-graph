/**
 * Module pour la passe de déformation Flowfield
 * Cette passe anime les positions des posts à travers un champ de vecteurs
 * pour créer des motifs organiques et naturels
 */

/**
 * Génère un vecteur de flow en fonction de la position et du temps
 *
 * @param {Object} position - Position {x, y, z} pour laquelle générer le vecteur
 * @param {Object} options - Options de génération
 * @param {number} options.scale - Échelle du flowfield (défaut: 0.02)
 * @param {number} options.strength - Force du flowfield (défaut: 2)
 * @param {number} options.time - Temps pour l'animation (défaut: 0)
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
    animate();
  });
}

export default {
  animatePostsInFlowfield,
  generateFlowfieldVector,
};

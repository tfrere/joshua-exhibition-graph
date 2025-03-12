// ----------------------------------------------------------------------------------
// Constantes de configuration pour les Posts
// ----------------------------------------------------------------------------------

// Tailles et apparence
export const SIZE = 0.05;
export const ACTIVE_POST_SIZE = 5; // Taille du post actif - augmentée pour être plus visible
export const MIN_IMPACT_SIZE = 1;
export const MAX_IMPACT_SIZE = 2;
export const USE_IMPACT_SIZE = true;
export const ACTIVE_POST_COLOR = [1.0, 0, 0]; // Couleur rouge vif pour le post actif
export const POST_ACTIVATION_DURATION = 3; // Durée de la transition en secondes
export const MIN_SIZE_DURING_TRANSITION = 0.5; // Taille minimale pendant une transition pour éviter les disparitions
export const SPHERE_SEGMENTS = 6; // Segments de la sphère (qualité)
export const PROXIMITY_THRESHOLD = 100; // Seuil de proximité pour déterminer si un post est actif
export const MIN_DISTANCE = 20; // Distance minimale pour considérer un post comme actif

// Constantes pour l'animation
export const ANIMATION_AMPLITUDE = 1.5; // Amplitude maximale du mouvement
export const ANIMATION_SPEED = 0.5; // Vitesse de l'animation
export const EXPLOSION_DURATION = 3.0; // Durée de l'explosion initiale en secondes
export const EXPLOSION_STAGGER = 0.2; // Décalage temporel entre les particules (0-1)
export const EXPLOSION_PATH_VARIATION = 0.25; // Variation des trajectoires durant l'explosion
export const SIZE_VARIATION_FACTOR = 3.0; // Facteur de variation de la taille pendant l'explosion
export const EXPLOSION_ARC_FACTOR = 0; // Facteur pour l'amplitude des arcs durant l'explosion
export const IDLE_MOVEMENT_SPEED_VARIATION = 0.4; // Variation de la vitesse du mouvement permanent (0-1)
export const IDLE_MOVEMENT_MAX_DISTANCE = 15; // Distance maximale que les points peuvent s'éloigner
export const TRANSITION_DURATION = 1.0; // Durée de la transition entre l'explosion et l'oscillation

// Constantes pour l'effet d'activation des posts
export const ACTIVATION_EFFECT_DURATION = 0.85; // Durée de l'animation en secondes
export const ACTIVATION_EFFECT_MAX_SIZE = 3; // Taille maximale du cercle (réduite de 15 à 8)
export const ACTIVATION_EFFECT_START_SIZE = 0.2; // Taille initiale du cercle
export const ACTIVATION_EFFECT_COLOR = [1.0, 1.0, 1.0]; // Couleur de l'effet (blanc pur)
export const ACTIVATION_EFFECT_OPACITY = 0.8; // Opacité initiale
export const ACTIVATION_EFFECT_RINGS = 3; // Nombre d'anneaux concentriques (réduit de 3 à 1)
export const ACTIVATION_EFFECT_RING_DELAY = 0.25; // Délai entre les anneaux en secondes (plus utilisé si un seul anneau)

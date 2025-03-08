/**
 * Point d'entrée pour les utilitaires de l'application
 * Exporte toutes les fonctions utilitaires pour une utilisation simplifiée
 */

// Exporter les fonctions pour la gestion des positions des posts
export {
  calculatePostPosition,
  calculatePostColor,
  spatializePostsAroundJoshuaNodes,
  updatePostsPositionsInContext,
} from "../pages/WorkPage/components/PostRenderer/utils/postsPositionUtils";

// Exporter la fonction d'exportation des positions du graphe
export { exportGraphPositions } from "./exportGraphPositions";

// Exporter l'utilitaire de synchronisation socket si nécessaire
export * from "./socketSync";

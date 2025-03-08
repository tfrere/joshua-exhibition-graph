import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { loadGraphData } from "../pages/WorkPage/utils/graphDataUtils";
import { updatePostsPositionsInContext } from "../components/PostRenderer/utils/postsPositionUtils";

// Création du contexte
const DataContext = createContext(null);

/**
 * Provider de données qui charge et fournit les données de l'application
 * @param {Object} props - Propriétés du composant
 * @param {React.ReactNode} props.children - Composants enfants
 */
export function DataProvider({ children }) {
  // État pour les données du graphe
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  // État pour les données des posts
  const [postsData, setPostsData] = useState([]);
  // États de chargement
  const [isLoadingGraph, setIsLoadingGraph] = useState(true);
  const [isLoadingPosts, setIsLoadingPosts] = useState(true);
  // États d'erreur
  const [graphError, setGraphError] = useState(null);
  const [postsError, setPostsError] = useState(null);

  // Chargement des données du graphe
  useEffect(() => {
    const loadGraph = async () => {
      try {
        setIsLoadingGraph(true);
        const data = await loadGraphData("/data/database.data.json", {
          features: {
            includeCentralJoshua: true,
            includeSourceNodes: true,
          },
        });
        console.log("Données du graphe chargées:", data);

        if (data.nodes.length === 0) {
          throw new Error("Aucun nœud trouvé dans les données chargées");
        }

        setGraphData(data);
      } catch (err) {
        console.error("Erreur lors du chargement des données du graphe:", err);
        setGraphError(err.message);
      } finally {
        setIsLoadingGraph(false);
      }
    };

    loadGraph();
  }, []);

  // Chargement des données des posts
  useEffect(() => {
    const loadPosts = async () => {
      try {
        setIsLoadingPosts(true);
        const response = await fetch("/data/posts.data.json");

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const characterData = await response.json();

        // Extraire les posts de chaque personnage
        let allPosts = [];
        let characterCount = 0;
        let postsCount = 0;

        characterData.forEach((character) => {
          characterCount++;

          // Vérifier si le personnage a des posts
          if (character.posts && Array.isArray(character.posts)) {
            // Pour chaque post, ajouter des informations du personnage parent
            const characterPosts = character.posts.map((post) => ({
              ...post,
              // Assurer que le post a une référence au personnage via le slug
              slug: character.slug,
              isJoshuaCharacter: character.isJoshua === true,
              // Initialiser les coordonnées si elles n'existent pas
              coordinates: post.coordinates || { x: 0, y: 0, z: 0 },
              // Initialiser la couleur si elle n'existe pas
              color: post.color || [0.8, 0.4, 0.0],
            }));

            postsCount += characterPosts.length;
            allPosts = [...allPosts, ...characterPosts];
          }
        });

        console.log(
          `Posts chargés: ${postsCount} posts de ${characterCount} personnages`
        );

        setPostsData(allPosts);
      } catch (err) {
        console.error("Erreur lors du chargement des posts:", err);
        setPostsError(err.message);
      } finally {
        setIsLoadingPosts(false);
      }
    };

    loadPosts();
  }, []);

  /**
   * Met à jour les positions des posts en fonction des positions actuelles des nœuds dans le graphe
   * @param {Object} options - Options de spatialisation
   * @param {boolean} options.joshuaOnly - Si true, ne repositionne que les posts des personnages Joshua
   * @param {boolean} options.preserveOtherPositions - Si true, préserve les positions des autres posts
   * @param {Array} options.customNodes - Nœuds personnalisés à utiliser pour la spatialisation (si fournis)
   * @returns {boolean} True si la mise à jour a réussi
   */
  const updatePostsPositions = useCallback(
    (options = {}) => {
      try {
        if (isLoadingGraph || isLoadingPosts) {
          console.warn(
            "Impossible de mettre à jour les positions des posts pendant le chargement des données"
          );
          return false;
        }

        // Si on n'a pas de customNodes et pas de nœuds dans le graphe, impossible de mettre à jour
        if (!options.customNodes && graphData.nodes.length === 0) {
          console.error(
            "Aucun nœud dans le graphe pour mettre à jour les positions des posts"
          );
          return false;
        }

        const defaultOptions = {
          joshuaOnly: true,
          preserveOtherPositions: true,
          radius: 15,
          minDistance: 5,
          verticalSpread: 1.2,
          horizontalSpread: 1.5,
          ...options,
        };

        // Log pour le débogage
        if (options.customNodes) {
          console.log(
            `Mise à jour des positions avec ${options.customNodes.length} nœuds personnalisés`
          );
        } else {
          console.log(
            `Mise à jour des positions avec ${graphData.nodes.length} nœuds du graphe`
          );
        }

        // Mettre à jour les positions des posts en utilisant l'utilitaire
        const updatedPosts = updatePostsPositionsInContext(
          postsData,
          graphData,
          defaultOptions,
          setPostsData
        );

        console.log(`Positions de ${updatedPosts.length} posts mises à jour`);
        return true;
      } catch (err) {
        console.error(
          "Erreur lors de la mise à jour des positions des posts:",
          err
        );
        setPostsError(err.message);
        return false;
      }
    },
    [graphData, postsData, isLoadingGraph, isLoadingPosts]
  );

  // Valeur du contexte
  const contextValue = {
    // Données
    graphData,
    postsData,
    // États de chargement
    isLoadingGraph,
    isLoadingPosts,
    isLoading: isLoadingGraph || isLoadingPosts,
    // États d'erreur
    graphError,
    postsError,
    hasError: !!graphError || !!postsError,
    // Fonctions
    updatePostsPositions,
  };

  return (
    <DataContext.Provider value={contextValue}>{children}</DataContext.Provider>
  );
}

/**
 * Hook pour utiliser les données du contexte
 * @returns {Object} Les données et états du contexte
 */
export function useData() {
  const context = useContext(DataContext);

  if (context === null) {
    throw new Error(
      "useData doit être utilisé à l'intérieur d'un DataProvider"
    );
  }

  return context;
}

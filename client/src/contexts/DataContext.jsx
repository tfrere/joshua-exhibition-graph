import { createContext, useContext, useState, useEffect } from "react";
import { loadGraphData } from "../pages/WorkPage/utils/graphDataUtils";

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
          includePosts: false,
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
        const response = await fetch("/data/spatialized_posts.data.json");

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log("Posts chargés:", data.length);
        setPostsData(data);
      } catch (err) {
        console.error("Erreur lors du chargement des posts:", err);
        setPostsError(err.message);
      } finally {
        setIsLoadingPosts(false);
      }
    };

    loadPosts();
  }, []);

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

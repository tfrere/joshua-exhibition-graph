import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
// Import de loadGraphData supprimé puisque nous allons charger directement le fichier
// import { loadGraphData } from "./graphDataUtils";
import { updatePostsPositionsInContext } from "../pages/WorkPage/components/PostRenderer/utils/postsPositionUtils";

// Création du contexte
const DataContext = createContext(null);

/**
 * Normalise les noms de plateforme pour fusionner les plateformes similaires
 * @param {string} platform - Le nom de la plateforme à normaliser
 * @returns {string} - Le nom normalisé de la plateforme
 */
const normalizePlatform = (platform) => {
  if (!platform) return platform;

  // Convertir en minuscules pour une comparaison insensible à la casse
  const lowerPlatform = platform.toLowerCase();

  // Normalisation de "daily-kos" et "dailykos" en une seule valeur
  if (lowerPlatform === "daily-kos" || lowerPlatform === "dailykos") {
    return "dailykos";
  }

  // Autres normalisations de plateformes
  // 1. Normalisation des formes d'e-mail
  if (
    lowerPlatform === "e-mail" ||
    lowerPlatform === "mail" ||
    lowerPlatform === "email"
  ) {
    return "email";
  }

  // 2. Normalisation de JustPaste.it (casse cohérente)
  if (lowerPlatform === "justpaste.it" || lowerPlatform === "justpaste") {
    return "justpaste";
  }

  // 3. Normalisation des forums de type chan
  if (
    lowerPlatform === "8chan" ||
    lowerPlatform === "8ch" ||
    lowerPlatform === "8kun"
  ) {
    return "8chan";
  }

  // 4. Normalisation de Adult Swim (casse cohérente)
  if (lowerPlatform === "adult swim" || lowerPlatform === "adultswim") {
    return "adultswim";
  }

  // 5. Normalisation de anime-news-network (tirets consistants)
  if (
    lowerPlatform === "anime-news-network" ||
    lowerPlatform === "animenewsnetwork"
  ) {
    return "anime-news-network";
  }

  return platform;
};

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

        // Charger directement le fichier nodes_and_links.data.json au lieu d'utiliser loadGraphData
        const response = await fetch("/data/nodes_and_links.data.json");

        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }

        const rawData = await response.json();
        console.log(
          "[CYCLE DE VIE] Données du graphe chargées depuis le serveur"
        );

        if (rawData.nodes.length === 0) {
          throw new Error("Aucun nœud trouvé dans les données chargées");
        }

        // Fonction pour extraire le nom de plateforme d'un ID (supprime le préfixe "platform_" si présent)
        const extractPlatformName = (id) => {
          if (typeof id !== "string") return id;
          if (id.startsWith("platform_")) {
            return id.substring(9); // Enlève "platform_"
          }
          return id;
        };

        // Fonction pour normaliser un ID de nœud
        const normalizeNodeId = (id, type) => {
          if (typeof id !== "string") return id;

          // Si c'est déjà un ID avec préfixe platform_, extraire le nom et normaliser
          if (id.startsWith("platform_")) {
            const platformName = extractPlatformName(id);
            const normalizedName = normalizePlatform(platformName);
            return `platform_${normalizedName}`;
          }

          // Pour les autres nœuds, utiliser un préfixe basé sur le type
          if (type === "source") {
            return `source_${normalizePlatform(id)}`;
          } else if (type === "platform") {
            return `platform_${normalizePlatform(id)}`;
          }

          return id;
        };

        // Prétraiter les données pour normaliser les plateformes AVANT de les utiliser n'importe où
        // Étape 1: Créer un mapping pour les ID de nœuds à normaliser (pour les plateformes similaires)
        const nodeIdMapping = {};
        const processedNodes = [];
        const nodesToMerge = {};

        // DEBUG: Afficher tous les nœuds qui contiennent "mail" dans leur ID ou nom
        const mailNodes = rawData.nodes.filter(
          (node) =>
            (node.id && node.id.toLowerCase().includes("mail")) ||
            (node.name && node.name.toLowerCase().includes("mail"))
        );
        console.log('[DEBUG] Nœuds avec "mail":', mailNodes);

        // Première passe: identifier les nœuds à fusionner et créer le mapping d'IDs
        rawData.nodes.forEach((node) => {
          // Normaliser la plateforme du nœud si elle existe
          if (node.platform) {
            node.platform = normalizePlatform(node.platform);
          }

          // Normaliser le nom si c'est un nœud de type source ou platform
          if (node.type === "source" || node.type === "platform") {
            const originalId = node.id;
            const normalizedName = normalizePlatform(node.name);

            // Créer un ID normalisé basé sur le type
            let normalizedId;
            if (node.type === "platform") {
              normalizedId = `platform_${normalizedName}`;
            } else {
              normalizedId = `source_${normalizedName}`;
            }

            // Si c'est la première fois qu'on rencontre cette plateforme normalisée
            if (!nodesToMerge[normalizedId]) {
              // Créer un nouveau nœud normalisé
              const normalizedNode = {
                ...node,
                id: normalizedId,
                name: normalizedName,
                platform: normalizedName,
                // Garder trace des IDs originaux qui ont été fusionnés
                originalIds: [originalId],
              };

              nodesToMerge[normalizedId] = normalizedNode;
            } else {
              // Fusionner avec le nœud existant
              const existingNode = nodesToMerge[normalizedId];
              existingNode.value = Math.max(
                existingNode.value || 1,
                node.value || 1
              );
              existingNode.originalIds.push(originalId);

              // Position: conserver celle du premier nœud si les valeurs sont à 0
              if (!existingNode.x && !existingNode.y && !existingNode.z) {
                existingNode.x = node.x || 0;
                existingNode.y = node.y || 0;
                existingNode.z = node.z || 0;
              }

              console.log(
                `[FUSION] Nœud "${originalId}" (${node.name}) fusionné avec "${normalizedId}" (${normalizedName})`
              );
            }

            // Créer le mapping d'IDs pour mettre à jour les liens plus tard
            nodeIdMapping[originalId] = normalizedId;

            // S'il s'agit d'un ID préfixé avec "platform_", créer également un mapping pour l'ID sans préfixe
            if (originalId.startsWith("platform_")) {
              const baseId = extractPlatformName(originalId);
              nodeIdMapping[baseId] = normalizedId;
              console.log(
                `[MAPPING] Ajout de mapping supplémentaire: ${baseId} -> ${normalizedId}`
              );
            }
          }
          // Pour les autres types de nœuds, fusionner par plateforme si c'est une plateforme connue
          else if (node.platform) {
            const normalizedPlatform = normalizePlatform(node.platform);

            // Si cette plateforme correspond à une plateforme connue à fusionner
            // Nous pouvons déterminer cela en vérifiant si la plateforme normalisée est différente
            if (normalizedPlatform !== node.platform) {
              const normalizedId = `node_${normalizedPlatform}`;

              // Si c'est la première fois qu'on rencontre cette plateforme normalisée
              if (!nodesToMerge[normalizedId]) {
                // Créer un nouveau nœud normalisé
                const normalizedNode = {
                  ...node,
                  id: normalizedId,
                  platform: normalizedPlatform,
                  // Garder trace des IDs originaux qui ont été fusionnés
                  originalIds: [node.id],
                };

                nodesToMerge[normalizedId] = normalizedNode;
              } else {
                // Fusionner avec le nœud existant
                const existingNode = nodesToMerge[normalizedId];
                existingNode.value = Math.max(
                  existingNode.value || 1,
                  node.value || 1
                );
                existingNode.originalIds.push(node.id);

                console.log(
                  `[FUSION] Nœud "${node.id}" (plateforme: ${node.platform}) fusionné avec "${normalizedId}" (plateforme: ${normalizedPlatform})`
                );
              }

              // Créer le mapping d'IDs pour mettre à jour les liens plus tard
              nodeIdMapping[node.id] = normalizedId;
            } else {
              // Pour les nœuds avec plateforme déjà normalisée
              processedNodes.push(node);
            }
          } else {
            // Pour les nœuds sans plateforme
            processedNodes.push(node);
          }
        });

        // DEBUG: Afficher le mapping d'IDs pour les nœuds contenant "mail"
        console.log(
          '[DEBUG] Mapping d\'IDs pour "mail":',
          Object.entries(nodeIdMapping).filter(([key]) =>
            key.toLowerCase().includes("mail")
          )
        );

        // Ajouter les nœuds fusionnés au tableau final
        Object.values(nodesToMerge).forEach((node) => {
          processedNodes.push(node);
        });

        console.log(
          `[FUSION] Fusion de nœuds: ${rawData.nodes.length} -> ${processedNodes.length}`
        );

        // Étape 2: Mettre à jour les références dans les liens
        const processedLinks = [];
        const processedLinkKeys = new Set(); // Pour éviter les doublons

        // DEBUG: Afficher les liens qui contiennent "mail" dans leur source ou target
        const mailLinks = rawData.links.filter((link) => {
          const source =
            typeof link.source === "object" ? link.source.id : link.source;
          const target =
            typeof link.target === "object" ? link.target.id : link.target;
          return (
            (source && source.toLowerCase().includes("mail")) ||
            (target && target.toLowerCase().includes("mail"))
          );
        });
        console.log('[DEBUG] Liens avec "mail":', mailLinks);

        rawData.links.forEach((link) => {
          // Récupérer les IDs source et target
          const sourceId =
            typeof link.source === "object" ? link.source.id : link.source;
          const targetId =
            typeof link.target === "object" ? link.target.id : link.target;

          // Vérifier si l'un des ID est un ID de plateforme préfixé (pour le debug)
          if (
            (sourceId && sourceId.startsWith("platform_")) ||
            (targetId && targetId.startsWith("platform_"))
          ) {
            console.log(
              `[DEBUG] Lien avec plateforme préfixée: ${sourceId} -> ${targetId}`
            );
          }

          // Appliquer la normalisation si nécessaire
          const newSourceId = nodeIdMapping[sourceId] || sourceId;
          const newTargetId = nodeIdMapping[targetId] || targetId;

          // Log de debug si l'un des ID a été normalisé
          if (newSourceId !== sourceId || newTargetId !== targetId) {
            console.log(
              `[DEBUG] Lien normalisé: ${sourceId} -> ${targetId} devient ${newSourceId} -> ${newTargetId}`
            );
          }

          // Créer une clé unique pour ce lien
          const linkKey = `${newSourceId}-${newTargetId}`;

          // Vérifier si ce lien a déjà été ajouté
          if (!processedLinkKeys.has(linkKey)) {
            // Créer le nouveau lien avec les IDs normalisés
            const newLink = {
              ...link,
              source: newSourceId,
              target: newTargetId,
            };

            processedLinks.push(newLink);
            processedLinkKeys.add(linkKey);
          } else {
            // Si le lien existe déjà, fusionner avec le lien existant
            // Trouver le lien existant
            const existingLink = processedLinks.find((l) => {
              const lSource =
                typeof l.source === "object" ? l.source.id : l.source;
              const lTarget =
                typeof l.target === "object" ? l.target.id : l.target;
              return lSource === newSourceId && lTarget === newTargetId;
            });

            if (existingLink) {
              // Fusionner les propriétés (par exemple, additionner les valeurs)
              existingLink.value =
                (existingLink.value || 1) + (link.value || 1);
            }
          }
        });

        console.log(
          `[FUSION] Fusion de liens: ${rawData.links.length} -> ${processedLinks.length}`
        );

        // DEBUG: Afficher les liens normalisés qui contiennent "mail" dans leur source ou target
        const processedMailLinks = processedLinks.filter((link) => {
          const source =
            typeof link.source === "object" ? link.source.id : link.source;
          const target =
            typeof link.target === "object" ? link.target.id : link.target;
          return (
            (source && source.toLowerCase().includes("mail")) ||
            (target && target.toLowerCase().includes("mail"))
          );
        });
        console.log(
          '[DEBUG] Liens normalisés avec "mail":',
          processedMailLinks
        );

        // Créer les données finales du graphe avec les nœuds et liens normalisés
        const normalizedData = {
          nodes: processedNodes,
          links: processedLinks,
        };

        // Stocker les données normalisées dans l'état
        setGraphData(normalizedData);
      } catch (err) {
        console.log(
          "[CYCLE DE VIE] Erreur lors du chargement des données du graphe:",
          err.message
        );
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

        // Les données sont une liste plate de posts
        const postsData = await response.json();

        // Traitement des posts directement depuis la liste plate
        const allPosts = postsData.map((post) => ({
          ...post,
          // Normaliser la plateforme dans les posts également
          platform: normalizePlatform(post.platform),
          // Assurer que les propriétés nécessaires sont présentes
          isJoshuaCharacter:
            post.character?.includes("joshua") ||
            post.slug?.includes("joshua") ||
            false,
          // Initialiser les coordonnées si elles n'existent pas
          coordinates: post.coordinates || { x: 0, y: 0, z: 0 },
          // Initialiser la couleur si elle n'existe pas
          color: post.color || [0.8, 0.4, 0.0],
        }));

        console.log(`[CYCLE DE VIE] Posts chargés: ${allPosts.length} posts`);

        setPostsData(allPosts);
      } catch (err) {
        console.log(
          "[CYCLE DE VIE] Erreur lors du chargement des posts:",
          err.message
        );
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
          console.log(
            "[CYCLE DE VIE] Impossible de mettre à jour les positions - Données en cours de chargement"
          );
          return false;
        }

        // Si on n'a pas de customNodes et pas de nœuds dans le graphe, impossible de mettre à jour
        if (!options.customNodes && graphData.nodes.length === 0) {
          console.log(
            "[CYCLE DE VIE] Impossible de mettre à jour les positions - Aucun nœud disponible"
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
            `[CYCLE DE VIE] Mise à jour des positions avec ${options.customNodes.length} nœuds personnalisés`
          );
        } else {
          console.log(
            `[CYCLE DE VIE] Mise à jour des positions avec ${graphData.nodes.length} nœuds du graphe`
          );
        }

        // Mettre à jour les positions des posts en utilisant l'utilitaire
        const updatedPosts = updatePostsPositionsInContext(
          postsData,
          graphData,
          defaultOptions,
          setPostsData
        );

        console.log(
          `[CYCLE DE VIE] Positions de ${updatedPosts.length} posts mises à jour avec succès`
        );
        return true;
      } catch (err) {
        console.log(
          "[CYCLE DE VIE] Erreur lors de la mise à jour des positions des posts:",
          err.message
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

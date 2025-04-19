import { Canvas } from "@react-three/fiber";
import { Stats } from "@react-three/drei";
import { useRef, useEffect, useState, useCallback } from "react";
import { ForceGraphUI } from "./components/ForceGraph/ForceGraph.jsx";
import ForceGraph from "./components/ForceGraph/ForceGraph.jsx";
import CustomForceGraph from "./components/CustomForceGraph.jsx";
import PostsRenderer from "./components/PostRenderer/PostsRenderer.jsx";
import AdvancedCameraController, {
  GamepadIndicator,
} from "../HomePage/components/AdvancedCameraController.jsx";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import GridReferences from "../MovablePage/components/GridReferences.jsx";
import { loadGraphData, getNodesWithPositions } from "./utils/graphDataUtils";

// Fonction utilitaire pour télécharger un fichier JSON
const downloadJSON = (content, fileName) => {
  const blob = new Blob([JSON.stringify(content, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Fonction pour nettoyer l'objet et supprimer les références circulaires
const cleanForExport = (obj) => {
  const seen = new WeakSet();

  const replacer = (key, value) => {
    // Ignorer certaines propriétés problématiques
    if (key.startsWith("__") || key === "link" || key === "object") {
      return undefined;
    }

    // Si la valeur est un objet (mais pas null) et pas un tableau
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Si nous avons déjà vu cet objet, nous avons une référence circulaire
      if (seen.has(value)) {
        return undefined; // Retourner undefined pour éliminer la référence circulaire
      }
      seen.add(value); // Marquer cet objet comme vu
    }
    return value;
  };

  // Utiliser JSON.parse(JSON.stringify()) avec un replacer pour nettoyer l'objet
  // Cette approche permet de manipuler l'objet pendant la sérialisation
  return JSON.parse(JSON.stringify(obj, replacer));
};

const WorkPage = () => {
  // État pour stocker les données chargées
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const forceGraphRef = useRef(null);

  // Remplacer Leva par des états React simples
  const [debug, setDebug] = useState(true);
  const [backgroundColor, setBackgroundColor] = useState("#000000");

  // Utiliser useRef au lieu de useState pour éviter les re-rendus
  const graphInstanceRef = useRef(null);

  // Utiliser useCallback pour stabiliser cette fonction
  const getGraphRef = useCallback((instance) => {
    if (instance) {
      console.log("Référence du graphe obtenue");
      graphInstanceRef.current = instance;
    }
  }, []);

  // Fonction pour charger les données et construire le graphe
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Utiliser la fonction utilitaire pour charger les données et construire le graphe
        const data = await loadGraphData();

        // Mettre à jour l'état du graphe avec les nœuds et liens
        setGraphData(data);
        setIsLoading(false);
      } catch (err) {
        console.error("Erreur lors du chargement des données:", err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fonction pour exporter les données spatialisées
  const exportSpatializedData = () => {
    console.log("Début de l'exportation...");

    try {
      // Vérifier si les données sont disponibles
      if (!graphData || !graphData.nodes || graphData.nodes.length === 0) {
        alert("Aucune donnée de graphe à exporter.");
        return;
      }

      // Récupérer les positions actuelles des nœuds depuis le graphe en utilisant la fonction utilitaire
      const nodesWithPositions = getNodesWithPositions(
        graphInstanceRef,
        graphData
      );

      // Analyse des clusters pour inclure dans l'export
      const clusterAnalysis = analyzeExportClusters(
        nodesWithPositions,
        graphData.links
      );

      // Nettoyer les liens pour éviter les références circulaires
      const cleanedLinks = graphData.links.map((link) => {
        // S'assurer que les valeurs source et target sont des chaînes ou des références simples
        return {
          source:
            typeof link.source === "object" ? link.source.id : link.source,
          target:
            typeof link.target === "object" ? link.target.id : link.target,
          value: link.value || 1,
          type: link.type,
          isDirect: link.isDirect,
          relationType: link.relationType,
          // Inclure d'autres propriétés simples si nécessaire
        };
      });

      // Créer l'objet d'export
      const rawDataToExport = {
        nodes: nodesWithPositions,
        links: cleanedLinks,
        metadata: {
          exportDate: new Date().toISOString(),
          clusterCount: clusterAnalysis.clusterCount,
          clusterSummary: clusterAnalysis.clusterSummary,
        },
      };

      // Nettoyer les données pour éliminer les références circulaires
      const dataToExport = cleanForExport(rawDataToExport);

      // Télécharger le fichier JSON
      downloadJSON(dataToExport, "character_platform_graph.data.json");
      alert(
        `Exportation terminée! 
        - ${dataToExport.nodes.length} nœuds 
        - ${dataToExport.links.length} liens
        - ${clusterAnalysis.clusterCount} clusters distincts`
      );
    } catch (error) {
      console.error("Erreur pendant l'exportation:", error);
      alert(`Erreur pendant l'exportation: ${error.message}`);
    }
  };

  // Fonction locale pour analyser les clusters lors de l'exportation
  const analyzeExportClusters = (nodes, links) => {
    // Map pour stocker les informations sur chaque cluster
    const clusterMap = {};

    // Compter les nœuds par cluster
    nodes.forEach((node) => {
      if (node.cluster !== undefined) {
        if (!clusterMap[node.cluster]) {
          clusterMap[node.cluster] = {
            id: node.cluster,
            nodeCount: 0,
            characterCount: 0,
            platformCount: 0,
            nodes: [],
          };
        }

        clusterMap[node.cluster].nodeCount++;

        if (node.type === "character") {
          clusterMap[node.cluster].characterCount++;
        } else if (node.type === "platform") {
          clusterMap[node.cluster].platformCount++;
        }

        // Ajouter l'ID du nœud à la liste des nœuds du cluster
        clusterMap[node.cluster].nodes.push(node.id);
      }
    });

    // Analyser les liens entre clusters
    const interClusterLinks = [];

    links.forEach((link) => {
      // Trouver les clusters des nœuds source et cible
      const sourceNode = nodes.find((n) => n.id === link.source);
      const targetNode = nodes.find((n) => n.id === link.target);

      if (
        sourceNode &&
        targetNode &&
        sourceNode.cluster !== undefined &&
        targetNode.cluster !== undefined &&
        sourceNode.cluster !== targetNode.cluster
      ) {
        // C'est un lien inter-cluster
        interClusterLinks.push({
          source: link.source,
          target: link.target,
          sourceCluster: sourceNode.cluster,
          targetCluster: targetNode.cluster,
          value: link.value,
        });
      }
    });

    // Créer le résumé des clusters
    const clusterSummary = Object.values(clusterMap).map((cluster) => ({
      id: cluster.id,
      nodeCount: cluster.nodeCount,
      characterCount: cluster.characterCount,
      platformCount: cluster.platformCount,
      interClusterLinkCount: interClusterLinks.filter(
        (link) =>
          link.sourceCluster === cluster.id || link.targetCluster === cluster.id
      ).length,
    }));

    return {
      clusterCount: Object.keys(clusterMap).length,
      clusterSummary,
      interClusterLinkCount: interClusterLinks.length,
    };
  };

  return (
    <div className="canvas-container">
      {/* Message de chargement */}
      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "white",
            zIndex: 1000,
            fontSize: "24px",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: "20px",
            borderRadius: "10px",
          }}
        >
          Chargement des données...
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "red",
            zIndex: 1000,
            fontSize: "24px",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: "20px",
            borderRadius: "10px",
          }}
        >
          Erreur: {error}
        </div>
      )}

      {/* Bouton d'exportation */}
      <button
        className="export-button"
        onClick={exportSpatializedData}
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          padding: "10px 15px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "4px",
          fontSize: "14px",
          cursor: "pointer",
          zIndex: 1000,
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        }}
      >
        Exporter les données JSON
      </button>

      {/* Canvas 3D avec les éléments 3D uniquement */}
      <Canvas
        camera={{ position: [0, 0, 500], fov: 50, near: 0.1, far: 100000 }}
      >
        {debug && <Stats />}
        <color attach="background" args={[backgroundColor]} />
        <OrbitControls enablePan={true} enableZoom={true} makeDefault={true} />
        <ambientLight intensity={1.2} />

        {/* Passer les données du graphe directement au composant ForceGraph */}
        <ForceGraph ref={getGraphRef} graphData={graphData} />

        <GridReferences
          rotationInterval={20}
          maxRotation={180}
          circleRadii={[50, 100, 150, 200, 250]}
          opacity={0.3}
        />
      </Canvas>
    </div>
  );
};

export default WorkPage;

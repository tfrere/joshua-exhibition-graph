import { useState, useEffect, useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Html } from "@react-three/drei";
import ForceGraph from "r3f-forcegraph";
import * as THREE from "three";

// Composant pour le nœud avec texte
function NodeObject({ id, type }) {
  // Définir les couleurs par type
  const colors = {
    central: "#ff0000", // Rouge
    character: "#00ff00", // Vert
    source: "#0088ff", // Bleu
  };

  const color = colors[type] || "#ffffff";

  // Définir l'échelle par type
  const scale =
    type === "central"
      ? 3
      : type === "character"
      ? 2
      : type === "source"
      ? 1.5
      : 1;

  // Choisir une géométrie selon le type
  let NodeGeometry;
  switch (type) {
    case "central":
      NodeGeometry = () => <sphereGeometry args={[1, 16, 16]} />;
      break;
    case "character":
      NodeGeometry = () => <boxGeometry args={[1, 1, 1]} />;
      break;
    case "source":
      NodeGeometry = () => <octahedronGeometry args={[1]} />;
      break;
    default:
      NodeGeometry = () => <sphereGeometry args={[1, 8, 8]} />;
  }

  return (
    <group>
      <mesh scale={[scale, scale, scale]}>
        <NodeGeometry />
        <meshLambertMaterial color={color} />
      </mesh>
      <Html>
        <div
          style={{
            color: "white",
            background: "rgba(0,0,0,0.6)",
            padding: "5px 10px",
            borderRadius: "5px",
            whiteSpace: "nowrap",
            transform: "translate3d(-50%, -120%, 0)",
            pointerEvents: "none",
            fontSize: "14px",
            fontWeight: "bold",
          }}
        >
          {id}
        </div>
      </Html>
    </group>
  );
}

// Composant interne pour gérer le graphe et utiliser useFrame (qui doit être utilisé dans un composant enfant de Canvas)
function Graph({ graphData }) {
  const fgRef = useRef();

  // Appeler tickFrame à chaque frame de rendu
  useFrame(() => fgRef.current && fgRef.current.tickFrame());

  // Définir les couleurs par type
  const colorsByType = {
    central: "#ff0000", // Rouge
    character: "#00ff00", // Vert
    source: "#0088ff", // Bleu
  };

  // Augmenter la force de répulsion pour meilleure lisibilité
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force("charge").strength(-100);
    }
  }, []);

  return (
    <ForceGraph
      ref={fgRef}
      graphData={graphData}
      nodeRelSize={6}
      linkColor={() => "#ffffff"}
      linkWidth={1}
      linkOpacity={0.2}
      backgroundColor="#000000"
      cooldownTicks={100}
      nodeThreeObject={(node) => {
        return <NodeObject id={node.id} type={node.type || "character"} />;
      }}
    />
  );
}

/**
 * Simple experiment page with r3f-forcegraph
 * This component loads data from public/data/nodes_and_links.data.json
 */
function ExperimentGraph() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);

  // Load graph data from JSON file
  useEffect(() => {
    fetch("/data/nodes_and_links.data.json")
      .then((response) => response.json())
      .then((data) => {
        setGraphData(data);
        setIsLoading(false);
        console.log("Graph data loaded:", data);
      })
      .catch((error) => {
        console.error("Error loading graph data:", error);
        setIsLoading(false);
      });
  }, []);

  return (
    <div style={{ width: "100%", height: "100vh" }}>
      {isLoading ? (
        <div style={{ padding: "20px", color: "white" }}>
          Chargement des données du graphe...
        </div>
      ) : (
        <Canvas camera={{ position: [0, 0, 400], fov: 75 }}>
          <color attach="background" args={["#000000"]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />

          <Graph graphData={graphData} />

          <OrbitControls enableDamping dampingFactor={0.25} />
        </Canvas>
      )}
    </div>
  );
}

export default ExperimentGraph;

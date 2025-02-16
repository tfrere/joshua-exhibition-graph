import { Canvas } from "@react-three/fiber";
import { FlyControls, Stats } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import ForceGraph from "../components/ForceGraph";
import { GamepadControls } from "../components/GamepadControls";
import { useSocketSync } from "../hooks/useSocketSync";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

// Interface pour les données de position des nœuds
interface NodePosition {
  id: number;
  name: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
}

function CameraSync() {
  const { camera } = useThree();
  useSocketSync(true, camera);
  return null;
}

export function Graph() {
  const forceGraphRef = useRef<any>(null);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault(); // Empêcher le défilement de la page

        // Récupérer les positions actuelles des nœuds
        if (forceGraphRef.current) {
          const graphData = forceGraphRef.current.getGraphData();
          const nodesPositions: NodePosition[] = graphData.nodes
            .filter(
              (node: any) =>
                node.x !== undefined &&
                node.y !== undefined &&
                node.z !== undefined
            )
            .map((node: any) => ({
              id: node.id,
              name: node.name,
              position: {
                x: node.x,
                y: node.y,
                z: node.z,
              },
            }));

          // Créer le blob et déclencher le téléchargement
          const dataStr = JSON.stringify(nodesPositions, null, 2);
          const blob = new Blob([dataStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `nodes-positions-${new Date().toISOString()}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          console.log(
            `${nodesPositions.length} positions de nœuds exportées !`
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas
        camera={{
          position: [0, 0, 500],
          fov: 75,
          near: 0.1,
          far: 100000,
        }}
      >
        <Stats />
        <color attach="background" args={["#000119"]} />
        <ambientLight intensity={2} />
        <pointLight position={[10, 10, 10]} />
        <ForceGraph ref={forceGraphRef} />
        <FlyControls movementSpeed={500} rollSpeed={0.5} dragToLook={true} />
        <GamepadControls />
        <CameraSync />
        <EffectComposer>
          <Bloom
            intensity={40}
            luminanceThreshold={0.001}
            luminanceSmoothing={0.2}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

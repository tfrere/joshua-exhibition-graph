import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import ForceGraph from "r3f-forcegraph";
import { OrbitControls, Stats } from "@react-three/drei";
import * as THREE from "three";
import { generateGraphData } from "../utils/generateGraphNodesAndLinks";
import { Node, Link } from "../types/graph";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Pixelation } from "@react-three/postprocessing";
import { createNodeObject, COLORS } from "../utils/createNodeObject";

function ForceGraphWrapper({
  graphData,
  showCentralJoshua,
}: {
  graphData: { nodes: Node[]; links: Link[] };
  showCentralJoshua: boolean;
}) {
  const fgRef = useRef<any>();
  const isTickingRef = useRef(false);

  useFrame(() => {
    if (fgRef.current && !isTickingRef.current) {
      isTickingRef.current = true;
      fgRef.current.tickFrame();
      isTickingRef.current = false;
    }
  });

  return (
    <ForceGraph
      ref={fgRef}
      graphData={graphData}
      nodeThreeObject={createNodeObject}
      linkColor={(link: any) =>
        link.source.id === "central-joshua" ||
        link.target.id === "central-joshua"
          ? COLORS.centralJoshua
          : link.target.type === "source"
          ? COLORS.source
          : link.target.isJoshua
          ? COLORS.joshua
          : COLORS.character
      }
      linkOpacity={0.3}
      linkWidth={(link: any) =>
        link.source.id === "central-joshua" ||
        link.target.id === "central-joshua"
          ? 1.5
          : 0.5
      }
      nodeResolution={16}
      warmupTicks={0}
      linkDirectionalParticles={0}
      linkDirectionalParticleWidth={(link: any) =>
        link.source.id === "central-joshua" ||
        link.target.id === "central-joshua"
          ? 3
          : 2
      }
      cooldownTicks={3000}
      cooldownTime={3000}
      linkDirectionalArrowLength={0}
      linkDirectionalArrowRelPos={1}
      linkDirectionalArrowColor={(link: any) =>
        link.source.id === "central-joshua" ||
        link.target.id === "central-joshua"
          ? COLORS.centralJoshua
          : link.target.type === "source"
          ? COLORS.source
          : link.target.isJoshua
          ? COLORS.joshua
          : COLORS.character
      }
      nodeVal={(node) =>
        node.id === "central-joshua" ? 30 : node.val * (node.isJoshua ? 2.5 : 2)
      }
    />
  );
}

export function LombardiGraph3D() {
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({
    nodes: [],
    links: [],
  });
  const dataLoadedRef = useRef(false);
  const [showCentralJoshua, setShowCentralJoshua] = useState(true); // Booléen pour contrôler l'affichage du nœud central

  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    fetch("/data/characters.json")
      .then((res) => res.json())
      .then((characters) => {
        let data = generateGraphData(characters);

        // Si showCentralJoshua est activé, ajouter le nœud central et ses liens
        if (showCentralJoshua) {
          // Créer le nœud central Joshua
          const centralJoshuaNode: Node = {
            id: "central-joshua",
            name: "JOSHUA",
            type: "character",
            val: 30,
            color: COLORS.centralJoshua,
            isJoshua: true,
          };

          // Ajouter le nœud central à la liste des nœuds
          data.nodes.push(centralJoshuaNode);

          // Créer des liens entre le nœud central et tous les nœuds Joshua
          const joshuaNodes = data.nodes.filter(
            (node) =>
              node.type === "character" &&
              node.isJoshua === true &&
              node.id !== "central-joshua"
          );

          // Ajouter les liens
          joshuaNodes.forEach((node) => {
            data.links.push({
              source: "central-joshua",
              target: node.id,
              type: "joshua-connection",
              value: 2,
            });
          });
        }

        console.log("Données du graphe générées:", {
          noeuds: data.nodes.length,
          liens: data.links.length,
          personnages: data.nodes.filter((n) => n.type === "character").length,
          sources: data.nodes.filter((n) => n.type === "source").length,
        });
        setGraphData(data);
      });
  }, [showCentralJoshua]);

  return (
    <div
      style={{ width: "100vw", height: "100vh", background: COLORS.background }}
    >
      <Canvas camera={{ position: [0, 0, 500], near: 0.1, far: 10000 }}>
        <Stats className="stats" showPanel={0} />
        <color attach="background" args={[COLORS.background]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 0]} intensity={0.5} />
        <pointLight position={[2000, 2000, 2000]} intensity={0.5} />
        <ForceGraphWrapper
          graphData={graphData}
          showCentralJoshua={showCentralJoshua}
        />
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxDistance={5000}
          minDistance={50}
          zoomSpeed={1.5}
          dampingFactor={0.3}
          rotateSpeed={0.8}
        />
        <EffectComposer>
          {/* <Bloom
            intensity={1.5}
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            mipmapBlur
          /> */}

          {/* <Pixelation
            granularity={10} // pixel granularity
          /> */}
        </EffectComposer>
      </Canvas>
    </div>
  );
}

import { useRef, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import ForceGraph from "r3f-forcegraph";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { generateGraphData } from "../utils/generateGraphNodesAndLinks";
import { Node, Link } from "../types/graph";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

// Palette de couleurs inspirée de CustomGraph
const COLORS = {
  source: "#4ecdc4",
  joshua: "#ff6b6b",
  character: "#fab1a0",
  contact: "#74b9ff",
  background: "#000119",
};

function ForceGraphWrapper({
  graphData,
}: {
  graphData: { nodes: Node[]; links: Link[] };
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

  const createNodeObject = (node: Node) => {
    const group = new THREE.Group();

    let geometry;
    if (node.type === "source") {
      geometry = new THREE.OctahedronGeometry(4);
    } else {
      const isJoshuaNode = node.type === "character" && node.isJoshua === true;
      geometry = isJoshuaNode
        ? new THREE.BoxGeometry(8, 8, 8)
        : new THREE.SphereGeometry(node.type === "character" ? 5 : 3);
    }

    const material = new THREE.MeshPhongMaterial({
      color:
        node.type === "source"
          ? COLORS.source
          : node.type === "character"
          ? node.isJoshua
            ? COLORS.joshua
            : COLORS.character
          : COLORS.contact,
      opacity: 0.9,
      transparent: true,
      emissive:
        node.type === "source"
          ? COLORS.source
          : node.type === "character"
          ? node.isJoshua
            ? COLORS.joshua
            : COLORS.character
          : COLORS.contact,
      emissiveIntensity: node.isJoshua ? 0.4 : 0.3,
    });
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    const textGeometry = new THREE.PlaneGeometry(1, 1);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context) {
      canvas.width = 256;
      canvas.height = 64;
      context.fillStyle = "rgba(0,0,0,0)";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.font =
        node.type === "source" ? "bold 24px Arial" : "bold 32px Arial";
      context.textAlign = "center";
      context.fillStyle = "#FFFFFF";
      context.fillText(node.name, canvas.width / 2, 40);

      const texture = new THREE.CanvasTexture(canvas);
      const textMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide,
      });

      const text = new THREE.Mesh(textGeometry, textMaterial);
      text.scale.set(20, 5, 1);
      const textHeight =
        node.type === "source"
          ? 6
          : node.type === "character" && node.isJoshua === true
          ? 6
          : 8;
      text.position.set(0, textHeight, 0);
      text.renderOrder = 1;

      text.onBeforeRender = function (renderer, scene, camera) {
        text.quaternion.copy(camera.quaternion);
      };

      group.add(text);
    }

    return group;
  };

  return (
    <ForceGraph
      ref={fgRef}
      graphData={graphData}
      nodeThreeObject={createNodeObject}
      linkColor={(link: any) =>
        link.target.type === "source"
          ? COLORS.source
          : link.target.isJoshua
          ? COLORS.joshua
          : COLORS.character
      }
      linkOpacity={0.3}
      linkWidth={0.5}
      nodeResolution={16}
      warmupTicks={0}
      linkDirectionalParticles={1}
      linkDirectionalParticleWidth={2}
      cooldownTicks={100}
      cooldownTime={1000}
      linkDirectionalArrowLength={0}
      linkDirectionalArrowRelPos={1}
      linkDirectionalArrowColor={(link: any) =>
        link.target.type === "source"
          ? COLORS.source
          : link.target.isJoshua
          ? COLORS.joshua
          : COLORS.character
      }
      nodeVal={(node) => node.val * (node.isJoshua ? 2.5 : 2)}
    />
  );
}

export function LombardiGraph3D() {
  const [graphData, setGraphData] = useState<{ nodes: Node[]; links: Link[] }>({
    nodes: [],
    links: [],
  });
  const dataLoadedRef = useRef(false);

  useEffect(() => {
    if (dataLoadedRef.current) return;
    dataLoadedRef.current = true;

    fetch("/data/characters.json")
      .then((res) => res.json())
      .then((characters) => {
        const data = generateGraphData(characters);
        console.log("Données du graphe générées:", {
          noeuds: data.nodes.length,
          liens: data.links.length,
          personnages: data.nodes.filter((n) => n.type === "character").length,
          sources: data.nodes.filter((n) => n.type === "source").length,
        });
        setGraphData(data);
      });
  }, []);

  return (
    <div
      style={{ width: "100vw", height: "100vh", background: COLORS.background }}
    >
      <Canvas camera={{ position: [0, 0, 500], near: 0.1, far: 10000 }}>
        <color attach="background" args={[COLORS.background]} />
        <ambientLight intensity={0.4} />
        <pointLight position={[0, 0, 0]} intensity={0.5} />
        <pointLight position={[2000, 2000, 2000]} intensity={0.5} />
        <ForceGraphWrapper graphData={graphData} />
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
          <Bloom
            intensity={1.5}
            luminanceThreshold={0.1}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

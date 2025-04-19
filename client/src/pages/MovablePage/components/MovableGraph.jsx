import React, {
  useState,
  useRef,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import MovableNode from "./MovableNode";

// Composant pour une ligne avec flèche directionnelle entre deux nœuds
const ArrowLine = ({ sourceNode, targetNode, color = "#FFFFFF" }) => {
  const lineRef = useRef();
  const arrowRef = useRef();
  const arrowSize = 1; // Taille de la flèche

  // Mettre à jour la position de la ligne et de la flèche à chaque frame
  useFrame(() => {
    if (lineRef.current && arrowRef.current) {
      // Points pour la ligne
      const sourcePoint = new THREE.Vector3(
        sourceNode.x,
        sourceNode.y,
        sourceNode.z
      );
      const targetPoint = new THREE.Vector3(
        targetNode.x,
        targetNode.y,
        targetNode.z
      );

      // Mettre à jour la géométrie de la ligne
      const points = [sourcePoint, targetPoint];
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      lineRef.current.geometry.dispose();
      lineRef.current.geometry = geometry;

      // Calculer la direction et position pour la flèche
      const direction = new THREE.Vector3()
        .subVectors(targetPoint, sourcePoint)
        .normalize();
      const arrowPosition = new THREE.Vector3().addVectors(
        sourcePoint,
        new THREE.Vector3().copy(direction).multiplyScalar(
          sourcePoint.distanceTo(targetPoint) * 0.7 // Positionner la flèche à 70% du chemin
        )
      );

      // Orienter la flèche dans la direction du lien
      arrowRef.current.position.copy(arrowPosition);

      // Calculer la rotation pour que la flèche pointe dans la bonne direction
      const quaternion = new THREE.Quaternion();
      // Rotation nécessaire pour que le cône pointe le long de l'axe Z
      quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0), // Orientation par défaut du cône (axe Y)
        direction // Direction vers le nœud cible
      );
      arrowRef.current.setRotationFromQuaternion(quaternion);
    }
  });

  return (
    <group>
      <line ref={lineRef}>
        <bufferGeometry
          attach="geometry"
          args={[
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
              new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z),
            ]),
          ]}
        />
        <lineBasicMaterial
          attach="material"
          color={color}
          linewidth={1}
          transparent={true}
          opacity={0.8}
        />
      </line>
      <mesh
        ref={arrowRef}
        position={[
          sourceNode.x + (targetNode.x - sourceNode.x) * 0.7,
          sourceNode.y + (targetNode.y - sourceNode.y) * 0.7,
          sourceNode.z + (targetNode.z - sourceNode.z) * 0.7,
        ]}
      >
        <coneGeometry
          args={[arrowSize * 0.5, arrowSize, 8]}
          rotation={[Math.PI / 2, 0, 0]}
        />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};

// Composant principal du graphe
const MovableGraph = forwardRef(({ data, isClusterMode }, ref) => {
  // États pour la sélection et les positions
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [activeNodeId, setActiveNodeId] = useState(null); // Nœud actif pour TransformControls
  const [nodePositions, setNodePositions] = useState({});
  const [initialPositions, setInitialPositions] = useState({}); // Positions initiales avant déplacement
  const [isMovingGroup, setIsMovingGroup] = useState(false);

  const controlsRef = useRef();
  const { camera } = useThree();

  // Exposer la méthode getNodesPositions via la réf
  useImperativeHandle(ref, () => ({
    getNodesPositions: () => {
      return data.nodes.map((node) => {
        // Appliquer les positions personnalisées si elles existent
        const position = nodePositions[node.id] || {
          x: node.x,
          y: node.y,
          z: node.z,
        };
        return {
          ...node,
          x: position.x,
          y: position.y,
          z: position.z,
        };
      });
    },
  }));

  // Gestion de la sélection de nœuds
  const handleNodeClick = useCallback(
    (node, shiftKey) => {
      console.log(
        "Click sur nœud:",
        node.id,
        "Shift:",
        shiftKey,
        "Mode cluster:",
        isClusterMode
      );

      // Mode cluster: sélectionner tous les nœuds du même cluster
      if (isClusterMode && node.cluster !== undefined) {
        console.log("Sélection du cluster:", node.cluster);

        // Récupérer tous les nœuds du même cluster
        const clusterNodes = data.nodes
          .filter((n) => n.cluster === node.cluster)
          .map((n) => n.id);

        // Si tous les nœuds du cluster sont déjà sélectionnés, désélectionner
        const allNodesInClusterSelected = clusterNodes.every((id) =>
          selectedNodes.includes(id)
        );

        if (allNodesInClusterSelected) {
          console.log("Désélection du cluster complet");
          setSelectedNodes([]);
          setActiveNodeId(null);
        } else {
          console.log("Sélection du cluster complet:", clusterNodes);
          setSelectedNodes(clusterNodes);
          setActiveNodeId(node.id); // Le nœud cliqué devient le nœud actif
        }

        return;
      }

      if (shiftKey) {
        // Mode multi-sélection avec Shift
        setSelectedNodes((prev) => {
          const isAlreadySelected = prev.includes(node.id);

          // Si déjà sélectionné, le retirer
          if (isAlreadySelected) {
            const newSelection = prev.filter((id) => id !== node.id);

            // Si on retire le nœud actif, mettre à jour activeNodeId
            if (node.id === activeNodeId) {
              // Si la sélection n'est pas vide, prendre le dernier nœud comme nœud actif
              setActiveNodeId(
                newSelection.length > 0
                  ? newSelection[newSelection.length - 1]
                  : null
              );
            }

            console.log(
              "Nœud retiré de la sélection:",
              node.id,
              "Nouvelle sélection:",
              newSelection
            );
            return newSelection;
          }
          // Sinon l'ajouter et le rendre actif
          else {
            // Le nouveau nœud sélectionné devient automatiquement le nœud actif
            setActiveNodeId(node.id);
            const newSelection = [...prev, node.id];
            console.log(
              "Nœud ajouté à la sélection:",
              node.id,
              "Nouvelle sélection:",
              newSelection
            );
            return newSelection;
          }
        });
      } else {
        // Sélection simple sans Shift
        const isSingleSelection =
          selectedNodes.length === 1 && selectedNodes[0] === node.id;

        if (isSingleSelection) {
          // Désélectionner si déjà sélectionné seul
          console.log("Désélection du nœud:", node.id);
          setSelectedNodes([]);
          setActiveNodeId(null);
        } else {
          // Nouvelle sélection unique
          console.log("Sélection unique du nœud:", node.id);
          setSelectedNodes([node.id]);
          setActiveNodeId(node.id);
        }
      }
    },
    [selectedNodes, activeNodeId, isClusterMode, data.nodes]
  );

  // Début du déplacement d'un nœud
  const handleTransformStart = useCallback(
    (nodeId) => {
      console.log("Début transformation du nœud:", nodeId);

      // Stocker les positions initiales de tous les nœuds sélectionnés
      const initPositions = {};

      selectedNodes.forEach((id) => {
        const pos = nodePositions[id] || {
          x: data.nodes.find((n) => n.id === id)?.x || 0,
          y: data.nodes.find((n) => n.id === id)?.y || 0,
          z: data.nodes.find((n) => n.id === id)?.z || 0,
        };

        initPositions[id] = { ...pos };
      });

      setInitialPositions(initPositions);

      // Marquer qu'on est en train de déplacer un groupe si nécessaire
      setIsMovingGroup(selectedNodes.length > 1 && nodeId === activeNodeId);

      // Désactiver les contrôles de caméra pendant la transformation
      if (controlsRef.current) {
        controlsRef.current.enabled = false;
      }
    },
    [selectedNodes, nodePositions, activeNodeId, data.nodes]
  );

  // Fin du déplacement d'un nœud
  const handleTransformEnd = useCallback((nodeId) => {
    console.log("Fin transformation du nœud:", nodeId);

    // Réactiver les contrôles de caméra
    if (controlsRef.current) {
      controlsRef.current.enabled = true;
    }

    setIsMovingGroup(false);
  }, []);

  // Mise à jour de la position d'un nœud
  const updateNodePosition = useCallback(
    (nodeId, newPosition) => {
      // Si ce n'est pas le nœud actif ou qu'on ne déplace pas un groupe, juste mettre à jour ce nœud
      if (nodeId !== activeNodeId || !isMovingGroup) {
        setNodePositions((prev) => ({
          ...prev,
          [nodeId]: newPosition,
        }));
        return;
      }

      // Si on déplace le nœud actif dans un groupe de sélection
      console.log("Déplacement groupé depuis le nœud:", nodeId);

      // Calculer le delta par rapport à la position initiale
      const initialPos = initialPositions[nodeId] || { x: 0, y: 0, z: 0 };
      const delta = {
        x: newPosition.x - initialPos.x,
        y: newPosition.y - initialPos.y,
        z: newPosition.z - initialPos.z,
      };

      // Mettre à jour tous les nœuds sélectionnés avec ce delta
      const newPositions = { ...nodePositions };

      selectedNodes.forEach((id) => {
        if (id !== nodeId) {
          const initialNodePos = initialPositions[id] || { x: 0, y: 0, z: 0 };
          newPositions[id] = {
            x: initialNodePos.x + delta.x,
            y: initialNodePos.y + delta.y,
            z: initialNodePos.z + delta.z,
          };
        }
      });

      // Ajouter la position du nœud actif
      newPositions[nodeId] = newPosition;

      // Mettre à jour toutes les positions d'un coup
      setNodePositions(newPositions);
    },
    [
      activeNodeId,
      isMovingGroup,
      initialPositions,
      selectedNodes,
      nodePositions,
    ]
  );

  // Créer une map pour accéder rapidement aux nœuds par ID
  const nodeMap = {};
  data.nodes.forEach((node) => {
    // Appliquer les positions personnalisées si elles existent
    if (nodePositions[node.id]) {
      node.x = nodePositions[node.id].x;
      node.y = nodePositions[node.id].y;
      node.z = nodePositions[node.id].z;
    }
    nodeMap[node.id] = node;
  });

  return (
    <group>
      {/* Contrôles de caméra */}
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        target={[0, 0, 0]}
      />

      {/* Rendu de tous les liens avec des flèches directionnelles */}
      {data.links.map((link, index) => {
        const sourceNode = nodeMap[link.source];
        const targetNode = nodeMap[link.target];

        if (!sourceNode || !targetNode) return null;

        // Définir une couleur pour le lien (basée sur la relation ou une valeur par défaut)
        const linkColor = link.color || "#FFFFFF";

        return (
          <ArrowLine
            key={`link-${link.id || `${link.source}-${link.target}-${index}`}`}
            sourceNode={sourceNode}
            targetNode={targetNode}
            color={linkColor}
          />
        );
      })}

      {/* Rendu de tous les nœuds */}
      {data.nodes.map((node) => {
        node.size = 1;
        const isSelected = selectedNodes.includes(node.id);
        const isActiveNode = node.id === activeNodeId;

        return (
          <MovableNode
            key={`node-${node.id}`}
            node={node}
            onClick={(node, shiftKey) => handleNodeClick(node, shiftKey)}
            isSelected={isSelected}
            isMultiSelected={selectedNodes.length > 1 && isSelected}
            isActiveNode={isActiveNode}
            onPositionUpdate={(newPos) => updateNodePosition(node.id, newPos)}
            onTransformStart={() => handleTransformStart(node.id)}
            onTransformEnd={() => handleTransformEnd(node.id)}
            controlsRef={controlsRef}
          />
        );
      })}
    </group>
  );
});

export default MovableGraph;

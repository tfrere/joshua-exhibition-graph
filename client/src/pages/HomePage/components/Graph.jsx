import React, { useState, useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import Node from "./Node";
import { Link, ArcLink } from "./Link";
import {
  activePostRef,
  updateActivePost,
  initSocketSync,
} from "./activePostRef";

// Composant qui gère la détection du post le plus proche de la caméra
const NearestPostDetector = ({ data, posts }) => {
  const { camera } = useThree();
  const prevNearestPostRef = React.useRef(null);
  // Limiter les mises à jour pour améliorer les performances
  const frameCountRef = React.useRef(0);
  const UPDATE_INTERVAL = 1; // Nombre de frames entre chaque mise à jour
  const targetPositionRef = useRef(new THREE.Vector3());

  // Initialiser la connexion socket
  useEffect(() => {
    console.log("NearestPostDetector - Initialisation de la connexion socket");
    initSocketSync();
  }, []);

  // Log initial pour vérifier les données reçues
  useEffect(() => {
    console.log("NearestPostDetector - Posts reçus:", posts);
    if (posts && posts.length > 0) {
      console.log("Premier post:", posts[0]);
      // Vérifier si les posts ont des coordonnées
      const postsWithCoordinates = posts.filter(
        (post) =>
          (post.x !== undefined &&
            post.y !== undefined &&
            post.z !== undefined) ||
          (post.coordinates && post.coordinates.x !== undefined)
      );
      console.log(
        `Posts avec coordonnées: ${postsWithCoordinates.length}/${posts.length}`
      );

      // Vérifier si les posts ont un postUID
      const postsWithUID = posts.filter((post) => post.postUID !== undefined);
      console.log(`Posts avec postUID: ${postsWithUID.length}/${posts.length}`);

      // Si certains posts n'ont pas de postUID, ajouter un avertissement
      if (postsWithUID.length < posts.length) {
        console.warn(
          "Certains posts n'ont pas de postUID, ce qui empêchera la détection correcte."
        );
        const postsWithoutUID = posts.filter(
          (post) => post.postUID === undefined
        );
        console.log("Exemple de post sans postUID:", postsWithoutUID[0]);
      }
    }
  }, [posts]);

  useFrame(() => {
    if (!posts || posts.length === 0) {
      // Si pas de posts, on log une fois toutes les 100 frames
      if (frameCountRef.current % 100 === 0) {
        console.log("NearestPostDetector - Aucun post disponible");
      }
      frameCountRef.current += 1;
      return;
    }

    // Mettre à jour uniquement toutes les X frames pour optimiser les performances
    frameCountRef.current += 1;
    if (frameCountRef.current % UPDATE_INTERVAL !== 0) return;

    // Position de la caméra
    const cameraPosition = camera.position.clone();

    // Créer un point situé 50 unités devant la caméra dans la direction où elle regarde
    const targetPosition = new THREE.Vector3();

    // Direction dans laquelle la caméra regarde (vecteur unitaire)
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);

    // Calcul de la position cible: position caméra + (direction * distance)
    targetPosition.copy(cameraPosition);
    targetPosition.addScaledVector(cameraDirection, 50);

    // Mettre à jour la référence de position pour la sphère
    targetPositionRef.current.copy(targetPosition);

    // Trouver le post le plus proche
    let nearestPost = null;
    let minDistance = Infinity;

    posts.forEach((post) => {
      // Vérifier si le post a des coordonnées valides
      if (!post) return;

      const postPosition = new THREE.Vector3(
        post.x !== undefined
          ? post.x
          : post.coordinates
          ? post.coordinates.x
          : 0,
        post.y !== undefined
          ? post.y
          : post.coordinates
          ? post.coordinates.y
          : 0,
        post.z !== undefined
          ? post.z
          : post.coordinates
          ? post.coordinates.z
          : 0
      );

      // Log pour debugging (une fois toutes les 100 frames)
      if (frameCountRef.current % 100 === 0 && post === posts[0]) {
        console.log("Position du premier post:", postPosition);
        console.log("Position cible:", targetPosition);
        console.log("Propriétés de position du premier post:", {
          directX: post.x,
          directY: post.y,
          directZ: post.z,
          coordinates: post.coordinates,
        });
      }

      // Calculer la distance entre le point cible et le post
      const distance = targetPosition.distanceTo(postPosition);

      // Mettre à jour le post le plus proche
      if (distance < minDistance) {
        minDistance = distance;
        nearestPost = post;
      }
    });

    // Log pour debugging (une fois toutes les 100 frames)
    if (frameCountRef.current % 100 === 0) {
      console.log("Post le plus proche trouvé:", nearestPost);
      console.log("Distance minimale:", minDistance);
    }

    // Si le post le plus proche a changé, le logger et mettre à jour la référence partagée
    if (
      nearestPost &&
      (!prevNearestPostRef.current ||
        prevNearestPostRef.current.postUID !== nearestPost.postUID)
    ) {
      console.log("Post actif le plus proche:", nearestPost);
      prevNearestPostRef.current = nearestPost;

      // Mettre à jour la référence partagée et envoyer via socket
      updateActivePost(nearestPost);
    }
  });

  // Composant de la sphère cible
  const TargetSphere = () => {
    const sphereRef = useRef();

    // Mettre à jour la position de la sphère à chaque frame
    useFrame(() => {
      if (sphereRef.current) {
        sphereRef.current.position.copy(targetPositionRef.current);
      }
    });

    return (
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="red" transparent={true} opacity={0.7} />
      </mesh>
    );
  };

  // Rendu de la sphère cible
  // return <TargetSphere />;
};

// Main Graph component
const Graph = ({ data }) => {
  const [selectedNode, setSelectedNode] = useState(null);

  // Handle node click
  const handleNodeClick = (node) => {
    setSelectedNode(node.id === selectedNode ? null : node.id);
    console.log(`Node clicked: ${node.label}`);
  };

  // Create a lookup map for faster access to nodes by ID
  const nodeMap = {};
  data.nodes.forEach((node) => {
    nodeMap[node.id] = node;
  });

  // S'assurer que data contient des posts en les extrayant de postsData du contexte
  // Si postsData est disponible dans props, l'utiliser
  const postsData = data.posts || [];

  // Log pour déboguer
  useEffect(() => {
    console.log("Graph - Données reçues:", data);
    console.log("Graph - Posts disponibles:", postsData.length);
    if (postsData.length > 0) {
      console.log("Graph - Exemple de post:", postsData[0]);
    }
  }, [data, postsData]);

  return (
    <group>
      {/* Détecteur de post le plus proche */}
      <NearestPostDetector data={data} posts={postsData} />

      {/* Render all links */}
      {data.links.map((link, index) => {
        const sourceNode = nodeMap[link.source];
        const targetNode = nodeMap[link.target];

        if (!sourceNode || !targetNode) return null;

        // Utiliser ArcLink pour les liens courbes ou Link pour les liens droits
        // Vous pouvez choisir en fonction d'une propriété du lien ou d'une autre logique
        const LinkComponent = link.style === "arc" ? ArcLink : Link;

        return (
          <LinkComponent
            key={`link-${index}`}
            link={link}
            sourceNode={sourceNode}
            targetNode={targetNode}
            // Vous pouvez personnaliser l'intensité de l'arc pour les liens ArcLink
            arcHeight={link.arcHeight || 0.3}
          />
        );
      })}

      {/* Render all nodes */}
      {data.nodes.map((node) => {
        node.size = 1;
        return (
          <Node
            key={`node-${node.id}`}
            node={node}
            onClick={handleNodeClick}
            isSelected={selectedNode === node.id}
          />
        );
      })}
    </group>
  );
};

export default Graph;

import { useThree, useFrame } from "@react-three/fiber";
import { Vector3, MathUtils } from "three";
import { useState, useEffect, useRef } from "react";

/**
 * Calculates the position to focus on a node with a given distance
 * @param {Object} node - The node to focus on
 * @param {number} distance - The distance from the node
 * @returns {Object} - Object containing target position and camera position
 */
export const calculateFocusPosition = (node, distance = 50) => {
  if (!node || !node.x) return null;

  // Calculate the distance ratio for positioning
  const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

  // Create the target position (directly on the node)
  const targetPosition = new Vector3(node.x, node.y, node.z);

  // Create the camera position (at a distance from the node)
  const cameraPosition = new Vector3(
    node.x * distRatio,
    node.y * distRatio,
    node.z * distRatio
  );

  return {
    targetPosition,
    cameraPosition,
  };
};

/**
 * Custom hook to animate camera to a node using R3F's useFrame
 * @param {Object} node - The node to focus on
 * @param {Object} options - Animation options
 * @returns {Object} - Animation state and controls
 */
export const useCameraAnimation = (node, options = {}) => {
  const { camera, controls } = useThree();
  const animationRef = useRef({
    active: false,
    startTime: 0,
    startPosition: new Vector3(),
    startTarget: new Vector3(),
    endPosition: new Vector3(),
    endTarget: new Vector3(),
    duration: options.duration || 1.5,
  });

  // Start animation with new target
  const startAnimation = (targetNode) => {
    if (!targetNode || !camera || !controls) return;

    const focusData = calculateFocusPosition(
      targetNode,
      options.distance || 50
    );
    if (!focusData) return;

    const anim = animationRef.current;
    anim.active = true;
    anim.startTime = Date.now();
    anim.startPosition.copy(camera.position);
    anim.startTarget.copy(controls.target);
    anim.endPosition.copy(focusData.cameraPosition);
    anim.endTarget.copy(focusData.targetPosition);
  };

  // Handle animation frame updates
  useFrame(() => {
    const anim = animationRef.current;
    if (!anim.active) return;

    const elapsed = (Date.now() - anim.startTime) / 1000;
    const progress = Math.min(elapsed / anim.duration, 1);

    // Ease function - cubic ease in-out
    const eased =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    if (progress >= 1) {
      // Animation complete
      anim.active = false;
      camera.position.copy(anim.endPosition);
      controls.target.copy(anim.endTarget);
    } else {
      // Interpolate camera position
      camera.position.lerpVectors(anim.startPosition, anim.endPosition, eased);

      // Interpolate controls target
      controls.target.lerpVectors(anim.startTarget, anim.endTarget, eased);
    }

    controls.update();
  });

  return {
    isAnimating: animationRef.current.active,
    animateTo: startAnimation,
  };
};

/**
 * Find the next node in a specified direction
 * @param {Array} nodes - Array of all nodes
 * @param {Object} currentNode - Current focused node
 * @param {string} direction - Direction ('left' or 'right')
 * @returns {Object} The next node to focus on
 */
export const findNextNode = (nodes, currentNode, direction) => {
  if (!nodes || !nodes.length || !currentNode) return null;

  // Find the current node's index
  const currentIndex = nodes.findIndex((node) => node.id === currentNode.id);
  if (currentIndex === -1) return nodes[0];

  // Calculate next index based on direction
  let nextIndex;
  if (direction === "right") {
    nextIndex = (currentIndex + 1) % nodes.length;
  } else if (direction === "left") {
    nextIndex = (currentIndex - 1 + nodes.length) % nodes.length;
  } else {
    return null;
  }

  return nodes[nextIndex];
};

/**
 * Custom hook to manage node navigation with keyboard controls
 * @param {Object} graphData - Graph data with nodes
 * @param {Object} options - Animation options
 * @returns {Object} - Navigation controls and state
 */
export const useNodeNavigation = (graphData, options = {}) => {
  const [focusedNode, setFocusedNode] = useState(null);
  const cameraAnimation = useCameraAnimation(focusedNode, options);

  // Initialize with the first node if none is focused
  useEffect(() => {
    if (!focusedNode && graphData?.nodes?.length > 0) {
      setFocusedNode(graphData.nodes[0]);
      cameraAnimation.animateTo(graphData.nodes[0]);
    }
  }, [graphData, focusedNode]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (!graphData?.nodes || cameraAnimation.isAnimating) return;

      if (event.key === "ArrowRight") {
        const nextNode = findNextNode(graphData.nodes, focusedNode, "right");
        if (nextNode) {
          setFocusedNode(nextNode);
          cameraAnimation.animateTo(nextNode);
        }
      }

      if (event.key === "ArrowLeft") {
        const prevNode = findNextNode(graphData.nodes, focusedNode, "left");
        if (prevNode) {
          setFocusedNode(prevNode);
          cameraAnimation.animateTo(prevNode);
        }
      }
    };

    // Ajouter l'option passive: true pour améliorer les performances
    window.addEventListener("keydown", handleKeyDown, { passive: true });
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [graphData, focusedNode, cameraAnimation]);

  return {
    focusedNode,
    setFocusedNode,
    focusOnNode: (node) => {
      if (node) {
        setFocusedNode(node);
        cameraAnimation.animateTo(node);
      }
    },
    isAnimating: cameraAnimation.isAnimating,
  };
};

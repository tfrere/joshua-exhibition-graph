import { useRef, useState, useEffect } from "react";
import { Vector3, Camera } from "three";
import { io, Socket } from "socket.io-client";
import { SOCKET_SERVER_URL } from "../config";
import { useDebugMode } from "./useDebugMode";
import { CoordinateType } from "../types/coordinates";

interface Coordinates {
  x: number;
  y: number;
  z: number;
}

interface CoordinateTypes {
  origin: Coordinates;
  originUp: Coordinates;
  exploded: Coordinates;
  spiral: Coordinates;
  sphere: Coordinates;
  calendar: Coordinates;
  calendarStaged: Coordinates;
  tree: Coordinates;
  treeDiffuse: Coordinates;
  map: Coordinates;
  mapDiffuse: Coordinates;
  mapLevel: Coordinates;
}

interface Post {
  creationDate: number;
  thematic: string;
  uid: string;
  coordinates: CoordinateTypes;
}

const SOCKET_UPDATE_INTERVAL = 1000 / 30;
const HYSTERESIS_DISTANCE = 1;
const TARGET_DISTANCE = 20; // Distance du point cible devant la caméra

export function useClosestNode(posts: Post[], camera: Camera, coordinateType: CoordinateType) {
  const [activePost, setActivePost] = useState<Post | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const tempVector = useRef(new Vector3());
  const targetPosition = useRef(new Vector3());
  const direction = useRef(new Vector3());
  const lastUpdateTime = useRef(0);
  const { debugLog } = useDebugMode();

  // Initialiser la connexion socket
  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER_URL);
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Fonction pour trouver le nœud le plus proche
  const findClosestNode = (currentTime: number) => {
    if (posts.length === 0) return;

    let closestPost: Post | null = null;
    let minDistance = Infinity;

    // Calculer le point cible devant la caméra
    direction.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    targetPosition.current
      .copy(camera.position)
      .add(direction.current.multiplyScalar(TARGET_DISTANCE));

    // D'abord, trouver le nœud réellement le plus proche
    for (const post of posts) {
      tempVector.current.set(
        post.coordinates[coordinateType].x,
        post.coordinates[coordinateType].y,
        post.coordinates[coordinateType].z
      );
      const distance = tempVector.current.distanceTo(targetPosition.current);

      if (distance < minDistance) {
        minDistance = distance;
        closestPost = post;
      }
    }

    // Ensuite, appliquer l'hystérésis
    if (closestPost) {
      // Si on a déjà un nœud actif, vérifier si le nouveau est significativement plus proche
      if (activePost) {
        tempVector.current.set(
          activePost.coordinates[coordinateType].x,
          activePost.coordinates[coordinateType].y,
          activePost.coordinates[coordinateType].z
        );
        const activeDistance = tempVector.current.distanceTo(targetPosition.current);

        // Garder l'ancien nœud sauf si le nouveau est significativement plus proche
        if (minDistance > activeDistance - HYSTERESIS_DISTANCE) {
          closestPost = activePost;
          minDistance = activeDistance;
        }
      }

      // Mettre à jour le post actif si nécessaire
      if (closestPost.creationDate !== activePost?.creationDate) {
        debugLog("Changement de nœud actif:", {
          de: activePost?.creationDate,
          vers: closestPost.creationDate,
          distance: minDistance,
          targetPos: {
            x: targetPosition.current.x.toFixed(2),
            y: targetPosition.current.y.toFixed(2),
            z: targetPosition.current.z.toFixed(2),
          },
        });
        setActivePost(closestPost);
      }
    }

    // Envoyer les données via socket si on a un nœud actif
    if (
      currentTime - lastUpdateTime.current >= SOCKET_UPDATE_INTERVAL &&
      activePost &&
      socketRef.current
    ) {
      lastUpdateTime.current = currentTime;

      socketRef.current.emit("updateState", {
        cameraPosition: [camera.position.x, camera.position.y, camera.position.z],
        cameraRotation: [
          camera.quaternion.x,
          camera.quaternion.y,
          camera.quaternion.z,
          camera.quaternion.w,
        ],
        closestNodeId: activePost.creationDate,
        closestNodeName: activePost.thematic,
        closestNodePosition: [
          activePost.coordinates[coordinateType].x,
          activePost.coordinates[coordinateType].y,
          activePost.coordinates[coordinateType].z,
        ],
        targetPosition: [
          targetPosition.current.x,
          targetPosition.current.y,
          targetPosition.current.z,
        ],
      });
    }
  };

  return {
    activePost,
    findClosestNode,
  };
}

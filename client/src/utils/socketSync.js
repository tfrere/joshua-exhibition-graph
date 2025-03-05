import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Quaternion } from "three";
import { SOCKET_SERVER_URL } from "../config";

/**
 * Hook pour synchroniser la caméra entre différentes vues
 * @param {boolean} isMainView - Si c'est la vue principale qui envoie les mises à jour
 * @param {Object} camera - La caméra Three.js à synchroniser
 * @returns {Object} La référence au socket
 */
export function useSocketSync(isMainView, camera) {
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialiser la connexion Socket.IO
    socketRef.current = io(SOCKET_SERVER_URL);

    const socket = socketRef.current;

    if (isMainView && camera) {
      // Vue principale : envoyer les mises à jour
      const updateInterval = setInterval(() => {
        const position = camera.position;
        const rotation = new Quaternion();
        camera.getWorldQuaternion(rotation);

        const state = {
          cameraPosition: [position.x, position.y, position.z],
          cameraRotation: [rotation.x, rotation.y, rotation.z, rotation.w],
        };

        socket.emit("updateState", state);
      }, 1000 / 30); // 30 fps

      return () => {
        clearInterval(updateInterval);
      };
    } else if (camera) {
      // Vue secondaire : recevoir les mises à jour
      socket.on("initialState", (state) => {
        camera.position.set(...state.cameraPosition);
        camera.setRotationFromQuaternion(
          new Quaternion(...state.cameraRotation)
        );
      });

      socket.on("stateUpdated", (state) => {
        camera.position.set(...state.cameraPosition);
        camera.setRotationFromQuaternion(
          new Quaternion(...state.cameraRotation)
        );
      });
    }

    return () => {
      socket.disconnect();
    };
  }, [isMainView, camera]);

  return socketRef.current;
}

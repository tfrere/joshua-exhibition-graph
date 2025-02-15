import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Vector3, Quaternion, Camera } from "three";

interface SharedState {
  cameraPosition: [number, number, number];
  cameraRotation: [number, number, number, number];
}

const SOCKET_SERVER_URL = "http://localhost:3000";

export function useSocketSync(isMainView: boolean, camera?: Camera) {
  const socketRef = useRef<Socket | null>(null);

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

        const state: SharedState = {
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
      socket.on("initialState", (state: SharedState) => {
        camera.position.set(...state.cameraPosition);
        camera.setRotationFromQuaternion(
          new Quaternion(...state.cameraRotation)
        );
      });

      socket.on("stateUpdated", (state: SharedState) => {
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

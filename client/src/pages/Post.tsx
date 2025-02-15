import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import { SOCKET_SERVER_URL } from "../config";

interface CameraState {
  cameraPosition: [number, number, number];
  cameraRotation: [number, number, number, number];
}

export function Post() {
  const [cameraState, setCameraState] = useState<CameraState>({
    cameraPosition: [0, 0, 0],
    cameraRotation: [0, 0, 0, 1],
  });

  useEffect(() => {
    const socket = io(SOCKET_SERVER_URL);

    socket.on("initialState", (state: CameraState) => {
      setCameraState(state);
    });

    socket.on("stateUpdated", (state: CameraState) => {
      setCameraState(state);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        background: "#000119",
        color: "#fff",
        fontFamily: "monospace",
      }}
    >
      <h1
        style={{
          fontSize: "5rem",
          marginBottom: "2rem",
        }}
      >
        POST
      </h1>
      <div
        style={{
          background: "rgba(255,255,255,0.1)",
          padding: "2rem",
          borderRadius: "1rem",
          fontSize: "1.2rem",
          lineHeight: "1.5",
        }}
      >
        <h2 style={{ marginBottom: "1rem" }}>Position de la caméra:</h2>
        <p>X: {cameraState.cameraPosition[0].toFixed(2)}</p>
        <p>Y: {cameraState.cameraPosition[1].toFixed(2)}</p>
        <p>Z: {cameraState.cameraPosition[2].toFixed(2)}</p>

        <h2 style={{ marginTop: "1.5rem", marginBottom: "1rem" }}>
          Rotation (Quaternion):
        </h2>
        <p>X: {cameraState.cameraRotation[0].toFixed(2)}</p>
        <p>Y: {cameraState.cameraRotation[1].toFixed(2)}</p>
        <p>Z: {cameraState.cameraRotation[2].toFixed(2)}</p>
        <p>W: {cameraState.cameraRotation[3].toFixed(2)}</p>
      </div>
    </div>
  );
}

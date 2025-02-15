import { useState, useEffect, useCallback } from "react";
import { io } from "socket.io-client";
import { SOCKET_SERVER_URL } from "../config";

interface CameraState {
  cameraPosition: [number, number, number];
  cameraRotation: [number, number, number, number];
  closestNodeId?: number;
  closestNodeName?: string;
  closestNodePosition?: [number, number, number];
}

interface Post {
  url: string;
  title: string;
  content: string;
  date: string;
  author: string;
}

export function Post() {
  const [cameraState, setCameraState] = useState<CameraState>({
    cameraPosition: [0, 0, 0],
    cameraRotation: [0, 0, 0, 1],
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [currentPost, setCurrentPost] = useState<Post | null>(null);

  // Charger les posts au démarrage
  useEffect(() => {
    fetch("/data/posts.json")
      .then((response) => response.json())
      .then((data: Post[]) => {
        setPosts(data);
      })
      .catch((error) =>
        console.error("Erreur lors du chargement des posts:", error)
      );
  }, []);

  // Mettre à jour le post courant quand l'ID du nœud change
  useEffect(() => {
    if (cameraState?.closestNodeId !== undefined && posts.length > 0) {
      const post = posts.find(
        (p) => p.url === cameraState.closestNodeId.toString()
      );
      setCurrentPost(post || null);
    }
  }, [cameraState.closestNodeId, posts]);

  const updateState = useCallback(
    (newState: CameraState) => {
      if (
        newState.closestNodeId &&
        newState.closestNodeId !== cameraState.closestNodeId
      ) {
        setCameraState(newState);
      }
    },
    [cameraState.closestNodeId]
  );

  useEffect(() => {
    const socket = io(SOCKET_SERVER_URL);

    socket.on("initialState", (state: CameraState) => {
      if (state.closestNodeId) {
        setCameraState(state);
      }
    });

    socket.on("stateUpdated", updateState);

    return () => {
      socket.disconnect();
    };
  }, [updateState]);

  // Styles communs pour le conteneur principal
  const containerStyle = {
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    background: "#000119",
    color: "#fff",
    fontFamily: "monospace",
  };

  // Si nous n'avons jamais reçu de nœud, afficher le message de chargement
  if (!cameraState.closestNodeId) {
    return (
      <div style={containerStyle}>
        <h1 style={{ fontSize: "5rem", marginBottom: "2rem" }}>POST</h1>
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            padding: "2rem",
            borderRadius: "1rem",
            fontSize: "1.2rem",
            lineHeight: "1.5",
            width: "80%",
            maxWidth: "600px",
          }}
        >
          <p>Recherche du nœud le plus proche...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <h1 style={{ fontSize: "5rem", marginBottom: "2rem" }}>POST</h1>
      <div
        style={{
          background: "rgba(255,255,255,0.1)",
          padding: "2rem",
          borderRadius: "1rem",
          fontSize: "1.2rem",
          lineHeight: "1.5",
          width: "80%",
          maxWidth: "800px",
          overflow: "auto",
          maxHeight: "70vh",
        }}
      >
        {currentPost ? (
          <>
            <h2
              style={{
                marginBottom: "1rem",
                fontSize: "2rem",
                color: "#ff6b6b",
              }}
            >
              {currentPost.title}
            </h2>
            <div style={{ marginBottom: "1.5rem", opacity: 0.7 }}>
              <p>Par {currentPost.author}</p>
              <p>Le {new Date(currentPost.date).toLocaleDateString("fr-FR")}</p>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.05)",
                padding: "1.5rem",
                borderRadius: "0.5rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {currentPost.content}
            </div>
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1rem",
                background: "rgba(0,0,0,0.2)",
                borderRadius: "0.5rem",
                fontSize: "0.9rem",
                opacity: 0.7,
              }}
            >
              <p>ID du nœud: {cameraState.closestNodeId}</p>
              <p>URL du post: {currentPost.url}</p>
              {cameraState.closestNodePosition && (
                <>
                  <p>Position du nœud:</p>
                  <p>X: {cameraState.closestNodePosition[0].toFixed(2)}</p>
                  <p>Y: {cameraState.closestNodePosition[1].toFixed(2)}</p>
                  <p>Z: {cameraState.closestNodePosition[2].toFixed(2)}</p>
                </>
              )}
            </div>
          </>
        ) : (
          <p>
            Aucun contenu trouvé pour ce nœud (ID: {cameraState.closestNodeId})
          </p>
        )}
      </div>
    </div>
  );
}

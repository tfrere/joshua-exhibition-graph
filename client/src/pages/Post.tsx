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
  uid: string;
  character: string;
  content: string;
  creationDate: number;
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
        (p) => p.uid === cameraState.closestNodeId?.toString()
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
    padding: "2rem",
    minHeight: "100vh",
    background: "#000119",
    color: "#fff",
    fontFamily: "monospace",
  };

  // Si nous n'avons jamais reçu de nœud, afficher le message de chargement
  if (!cameraState.closestNodeId) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            padding: "2rem",
            borderRadius: "1rem",
            fontSize: "1.2rem",
            lineHeight: "1.5",
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
      <div
        style={{
          background: "rgba(255,255,255,0.1)",
          padding: "2rem",
          borderRadius: "1rem",
          fontSize: "1.2rem",
          lineHeight: "1.5",
          maxWidth: "800px",
          overflow: "auto",
          maxHeight: "calc(100vh - 4rem)",
        }}
      >
        {currentPost ? (
          <>
            <label
              style={{
                marginBottom: 0,
                fontSize: "1rem",
              }}
            >
              {currentPost.thematic}
            </label>
            <h2
              style={{
                marginBottom: "1rem",
                marginTop: 0,
                fontSize: "2rem",
                color: "#ff6b6b",
              }}
            >
              {currentPost.character || "Inconnu"}
            </h2>
            <div style={{ marginBottom: "1.5rem", opacity: 0.7 }}>
              <p>{currentPost.sourceType}</p>
              <p>
                Le{" "}
                {new Date(currentPost.creationDate * 1000).toLocaleDateString(
                  "fr-FR"
                )}
              </p>
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

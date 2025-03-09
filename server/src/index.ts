import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const ALLOWED_ORIGINS =
  process.env.NODE_ENV === "production"
    ? process.env.CLIENT_URL
      ? [process.env.CLIENT_URL]
      : []
    : ["http://localhost:5173"];

app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  })
);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// État partagé entre les clients
interface SharedState {
  cameraPosition: [number, number, number];
  cameraRotation: [number, number, number, number];
  closestNodeId?: number;
  closestNodeName?: string;
  closestNodePosition?: [number, number, number];
  activeNode?: ActiveNode;
}

// Interface pour le nœud actif
interface ActiveNode {
  id: string;
  slug: string;
  name?: string;
  x?: number;
  y?: number;
  z?: number;
}

let currentState: SharedState = {
  cameraPosition: [0, 0, 500],
  cameraRotation: [0, 0, 0, 1],
};

io.on("connection", (socket) => {
  console.log("Client connecté");

  socket.emit("initialState", currentState);

  // Si un nœud actif existe déjà, l'envoyer au nouveau client
  if (currentState.activeNode) {
    socket.emit("activeNodeUpdated", currentState.activeNode);
  }

  socket.on("updateState", (newState: SharedState) => {
    currentState = newState;
    socket.broadcast.emit("stateUpdated", newState);

    // Log du nœud le plus proche si changement
    if (newState.closestNodeId) {
      console.log(
        `Nœud le plus proche : ${newState.closestNodeName} (ID: ${newState.closestNodeId})`
      );
    }
  });

  // Gérer les mises à jour du nœud actif
  socket.on("updateActiveNode", (node: ActiveNode) => {
    console.log(
      `Nœud actif mis à jour: ${node.name || node.slug} (ID: ${node.id})`
    );
    currentState.activeNode = node;
    socket.broadcast.emit("activeNodeUpdated", node);
  });

  socket.on("disconnect", () => {
    console.log("Client déconnecté");
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
  console.log("Origins autorisés:", ALLOWED_ORIGINS);
});

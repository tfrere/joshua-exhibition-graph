import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();

// Autoriser toutes les origines
console.log("Configuration CORS: Toutes les origines autorisées");

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
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
  activePost?: ActivePost;
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

// Interface pour le post actif
interface ActivePost {
  id: string;
  postUID: number;
  slug: string;
  impact?: number;
  x?: number;
  y?: number;
  z?: number;
}

let currentState: SharedState = {
  cameraPosition: [0, 0, 500],
  cameraRotation: [0, 0, 0, 1],
};

io.on("connection", (socket) => {
  console.log(
    "Client connecté, ID:",
    socket.id,
    "Origine:",
    socket.handshake.headers.origin
  );

  socket.emit("initialState", currentState);

  // Si un nœud actif existe déjà, l'envoyer au nouveau client
  if (currentState.activeNode) {
    socket.emit("activeNodeUpdated", currentState.activeNode);
  }

  // Si un post actif existe déjà, l'envoyer au nouveau client
  if (currentState.activePost) {
    socket.emit("activePostUpdated", currentState.activePost);
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

  // Gérer les mises à jour du post actif
  socket.on("updateActivePost", (post: ActivePost) => {
    console.log(
      `Post actif mis à jour: ${post.id} (UID: ${post.postUID}, Slug: ${post.slug})`
    );
    currentState.activePost = post;
    socket.broadcast.emit("activePostUpdated", post);
  });

  // Gérer le signal de réinitialisation de la vue
  socket.on("resetView", (data: any) => {
    console.log(`Signal de réinitialisation de la vue reçu:`, data);
    // Relayer l'événement à tous les autres clients
    socket.broadcast.emit("resetView", data);
  });

  // Gérer le signal de démarrage du comptage
  socket.on("startCounting", (data: any) => {
    console.log(`Signal de démarrage du comptage reçu:`, data);
    // Relayer l'événement à tous les autres clients
    socket.broadcast.emit("startCounting", data);
    // Envoyer un accusé de réception au client émetteur
    socket.emit("startCountingAck", { received: true, timestamp: Date.now() });
  });

  // Gestionnaire d'événement pour les tests de connexion
  socket.on("test", (data: any) => {
    console.log(`Test de connexion socket reçu:`, data);
    // Envoyer un accusé de réception au client émetteur
    socket.emit("testAck", { received: true, timestamp: Date.now() });
  });

  socket.on("disconnect", () => {
    console.log("Client déconnecté, ID:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
  console.log("Configuration CORS: Toutes les origines autorisées");
});

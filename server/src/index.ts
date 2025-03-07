import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

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

// Configuration pour servir les fichiers statiques du client en production
if (process.env.NODE_ENV === "production") {
  // Obtenir le chemin du répertoire courant en ESM
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Chemin vers les fichiers statiques du client (correspond à outDir dans vite.config.js)
  const staticPath = path.join(__dirname, "../client");
  
  // Configurer les en-têtes de sécurité pour permettre l'exécution d'évaluations et autres ressources
  app.use((req, res, next) => {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-eval'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' wss: ws:;"
    );
    next();
  });
  
  // Servir les fichiers statiques
  app.use(express.static(staticPath));
  
  // Pour SPA, rediriger toutes les routes non-API vers index.html
  app.get("*", (req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });
  
  console.log(`Servir les fichiers statiques depuis ${staticPath}`);
}

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
}

let currentState: SharedState = {
  cameraPosition: [0, 0, 500],
  cameraRotation: [0, 0, 0, 1],
};

io.on("connection", (socket) => {
  console.log("Client connecté");

  socket.emit("initialState", currentState);

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

  socket.on("disconnect", () => {
    console.log("Client déconnecté");
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
  console.log("Origins autorisés:", ALLOWED_ORIGINS);
});

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // URL du client Vite
    methods: ["GET", "POST"],
  },
});

// État partagé entre les clients
interface SharedState {
  cameraPosition: [number, number, number];
  cameraRotation: [number, number, number, number]; // Quaternion
}

let currentState: SharedState = {
  cameraPosition: [0, 0, 500],
  cameraRotation: [0, 0, 0, 1], // Quaternion par défaut
};

io.on("connection", (socket) => {
  console.log("Client connecté");

  // Envoyer l'état actuel au nouveau client
  socket.emit("initialState", currentState);

  // Écouter les mises à jour de l'état depuis la vue principale (/)
  socket.on("updateState", (newState: SharedState) => {
    currentState = newState;
    // Diffuser la mise à jour à tous les autres clients
    socket.broadcast.emit("stateUpdated", newState);
  });

  socket.on("disconnect", () => {
    console.log("Client déconnecté");
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
});

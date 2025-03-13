import React, { useState, useEffect, useRef } from "react";
import { initSocketSync } from "../HomePage/components/Posts/hooks/useNearestPostDetection";

function SocketDebugger() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [filter, setFilter] = useState("");
  const scrollRef = useRef(null);
  const socketRef = useRef(null);

  // Styles
  const styles = {
    container: {
      width: "100vw",
      height: "100vh",
      background: "#000000",
      color: "#FFFFFF",
      display: "flex",
      flexDirection: "column",
      padding: "1rem",
      fontFamily: "monospace",
      overflow: "hidden",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "1rem",
      borderBottom: "1px solid #333",
      paddingBottom: "0.5rem",
    },
    title: {
      fontSize: "1.5rem",
      margin: 0,
    },
    status: {
      padding: "0.25rem 0.5rem",
      borderRadius: "0.25rem",
      fontSize: "0.75rem",
      fontWeight: "bold",
    },
    connected: {
      backgroundColor: "#2a2",
      color: "#fff",
    },
    disconnected: {
      backgroundColor: "#a22",
      color: "#fff",
    },
    actions: {
      display: "flex",
      gap: "0.5rem",
      marginBottom: "0.5rem",
    },
    button: {
      backgroundColor: "#333",
      border: "none",
      color: "#fff",
      padding: "0.25rem 0.5rem",
      borderRadius: "0.25rem",
      cursor: "pointer",
    },
    filterInput: {
      backgroundColor: "#222",
      border: "1px solid #444",
      color: "#fff",
      padding: "0.25rem 0.5rem",
      borderRadius: "0.25rem",
      flex: 1,
    },
    eventsList: {
      flex: 1,
      overflowY: "auto",
      backgroundColor: "#111",
      borderRadius: "0.25rem",
      padding: "0.5rem",
      marginBottom: "0.5rem",
    },
    event: {
      margin: "0.25rem 0",
      padding: "0.5rem",
      borderRadius: "0.25rem",
      backgroundColor: "#1a1a1a",
      borderLeft: "3px solid",
    },
    eventTime: {
      opacity: 0.7,
      fontSize: "0.8rem",
      marginRight: "0.5rem",
    },
    eventName: {
      fontWeight: "bold",
      marginRight: "0.5rem",
    },
    activeNodeEvent: {
      borderLeftColor: "#4a4",
    },
    activePostEvent: {
      borderLeftColor: "#44a",
    },
    connectionEvent: {
      borderLeftColor: "#aa4",
    },
    otherEvent: {
      borderLeftColor: "#a4a",
    },
    stats: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: "0.75rem",
      padding: "0.5rem",
      backgroundColor: "#222",
      borderRadius: "0.25rem",
      marginBottom: "0.5rem",
    },
    json: {
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      fontSize: "0.8rem",
      marginTop: "0.25rem",
      padding: "0.25rem",
      backgroundColor: "rgba(0,0,0,0.2)",
      borderRadius: "0.25rem",
      maxHeight: "150px",
      overflowY: "auto",
    },
  };

  // Initialisation du socket
  useEffect(() => {
    const addEvent = (eventName, data) => {
      const timestamp = new Date();
      setEvents((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          timestamp,
          eventName,
          data,
        },
      ]);
    };

    console.log("Initializing socket for debugging");
    const socket = initSocketSync();
    socketRef.current = socket;

    if (socket) {
      // Status de connexion
      socket.on("connect", () => {
        setConnected(true);
        addEvent("connect", { socketId: socket.id });
      });

      socket.on("disconnect", () => {
        setConnected(false);
        addEvent("disconnect", {});
      });

      socket.on("connect_error", (error) => {
        addEvent("connect_error", { message: error.message });
      });

      // Événements liés aux posts
      socket.on("activePostUpdated", (data) => {
        addEvent("activePostUpdated", data);
      });

      // Événements liés aux nœuds
      socket.on("activeNodeUpdated", (data) => {
        addEvent("activeNodeUpdated", data);
      });

      // Autres événements
      socket.on("resetView", (data) => {
        addEvent("resetView", data);
      });

      socket.on("startCounting", (data) => {
        addEvent("startCounting", data);
      });

      // Écouter les événements DOM personnalisés aussi
      const handleActiveNodeChanged = (event) => {
        addEvent("DOM:activeNodeChanged", { detail: event.detail });
      };

      const handleActivePostChanged = (event) => {
        addEvent("DOM:activePostChanged", { detail: event.detail });
      };

      window.addEventListener("activeNodeChanged", handleActiveNodeChanged);
      window.addEventListener("activePostChanged", handleActivePostChanged);

      // Cleanup
      return () => {
        window.removeEventListener(
          "activeNodeChanged",
          handleActiveNodeChanged
        );
        window.removeEventListener(
          "activePostChanged",
          handleActivePostChanged
        );
      };
    }
  }, []);

  // Auto-scroll à chaque nouvel événement
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  // Événements filtrés
  const filteredEvents = events.filter((event) => {
    if (!filter) return true;
    return (
      event.eventName.toLowerCase().includes(filter.toLowerCase()) ||
      JSON.stringify(event.data).toLowerCase().includes(filter.toLowerCase())
    );
  });

  // Statistiques des événements
  const eventCounts = events.reduce((acc, event) => {
    acc[event.eventName] = (acc[event.eventName] || 0) + 1;
    return acc;
  }, {});

  // Formater l'heure
  const formatTime = (date) => {
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  };

  // Déterminer la classe de style en fonction du type d'événement
  const getEventStyle = (eventName) => {
    if (eventName.includes("Node")) return styles.activeNodeEvent;
    if (eventName.includes("Post")) return styles.activePostEvent;
    if (["connect", "disconnect", "connect_error"].includes(eventName))
      return styles.connectionEvent;
    return styles.otherEvent;
  };

  // Effacer tous les événements
  const clearEvents = () => {
    setEvents([]);
  };

  // Envoyer un événement de test
  const sendTestEvent = (eventType) => {
    if (!socketRef.current) return;

    switch (eventType) {
      case "resetView":
        socketRef.current.emit("resetView", { timestamp: Date.now() });
        break;
      case "startCounting":
        socketRef.current.emit("startCounting", { timestamp: Date.now() });
        break;
      default:
        break;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Débogueur Socket</h1>
        <div
          style={{
            ...styles.status,
            ...(connected ? styles.connected : styles.disconnected),
          }}
        >
          {connected ? "Connecté" : "Déconnecté"}
        </div>
      </div>

      <div style={styles.actions}>
        <button style={styles.button} onClick={clearEvents}>
          Effacer
        </button>
        <button
          style={styles.button}
          onClick={() => sendTestEvent("resetView")}
        >
          Tester resetView
        </button>
        <button
          style={styles.button}
          onClick={() => sendTestEvent("startCounting")}
        >
          Tester startCounting
        </button>
        <input
          style={styles.filterInput}
          type="text"
          placeholder="Filtrer les événements..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div style={styles.stats}>
        <div>Total: {events.length} événements</div>
        <div>
          {Object.entries(eventCounts)
            .map(([name, count]) => `${name}: ${count}`)
            .join(" | ")}
        </div>
      </div>

      <div style={styles.eventsList} ref={scrollRef}>
        {filteredEvents.length === 0 ? (
          <div style={{ padding: "1rem", opacity: 0.5, textAlign: "center" }}>
            Aucun événement{filter ? " correspondant au filtre" : ""}
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              style={{ ...styles.event, ...getEventStyle(event.eventName) }}
            >
              <div>
                <span style={styles.eventTime}>
                  {formatTime(event.timestamp)}
                </span>
                <span style={styles.eventName}>{event.eventName}</span>
              </div>
              {event.data && (
                <div style={styles.json}>
                  {JSON.stringify(event.data, null, 2)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div style={{ fontSize: "0.75rem", opacity: 0.7, textAlign: "center" }}>
        Surveille les événements socket et DOM pour faciliter le débogage
      </div>
    </div>
  );
}

export default SocketDebugger;

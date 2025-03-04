const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { v4: uuidv4 } = require('uuid'); // Modificado para usar uuid

const app = express();
const server = http.createServer(app);

// Configuração crucial para WebSockets no Render
const io = new Server(server, {
  cors: {
    origin: "https://site-estrangeiro.onrender.com",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ["websocket"],
  allowUpgrades: false,
  pingInterval: 25000,
  pingTimeout: 20000,
  cookie: false
});

const cors = require('cors');
app.use(cors({
  origin: "https://site-estrangeiro.onrender.com",
  methods: ["GET", "POST"]
}));

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const rooms = new Map();

// Função auxiliar
function getAvailableRooms() {
  return Array.from(rooms.entries())
    .filter(([_, room]) => room.users.size < 2)
    .map(([id, room]) => ({
      id,
      name: room.name,
      users: room.users.size
    }));
}

function logRooms() {
  console.log("\n═ Salas Atuais ════════════════════════");
  rooms.forEach((room, id) => {
    console.log(` ${id.slice(0,6)} (${room.name}) → ${room.users.size} usuário(s)`);
  });
  console.log("═══════════════════════════════════════\n");
}

io.on("connection", (socket) => {
  console.log(`→ Nova conexão: ${socket.id}`);

  // Evento para criar sala
  socket.on("createRoom", (roomName) => {
    const roomId = uuidv4();
    rooms.set(roomId, {
      name: roomName,
      users: new Set([socket.id]),
      messages: [],
      createdAt: Date.now()
    });
    io.emit('updateRooms', getAvailableRooms());
    logRooms();
  });

  // Evento para entrar na sala
  socket.on("joinRoom", (roomId) => {
    const room = rooms.get(roomId);
    if (!room || room.users.size >= 2) return;

    // Sair de outras salas
    Array.from(socket.rooms).forEach(r => {
      if (r !== socket.id && rooms.has(r)) {
        const oldRoom = rooms.get(r);
        oldRoom.users.delete(socket.id);
        if (oldRoom.users.size === 0) rooms.delete(r);
        socket.leave(r);
      }
    });

    socket.join(roomId);
    room.users.add(socket.id);
    io.emit('updateRooms', getAvailableRooms());
    socket.emit("chatHistory", room.messages);
    logRooms();
  });

  // WebRTC Handlers
  socket.on("offer", (data) => {
    socket.to(data.room).emit("offer", data.offer);
    console.log(`↘ Offer de ${socket.id.slice(0,8)} para ${data.room}`);
  });

  socket.on("answer", (data) => {
    socket.to(data.room).emit("answer", data.answer);
    console.log(`↙ Answer de ${socket.id.slice(0,8)} para ${data.room}`);
  });

  socket.on("candidate", (data) => {
    socket.to(data.room).emit("candidate", data.candidate);
    console.log(`↔ ICE Candidate de ${socket.id.slice(0,8)}`);
  });

  // Chat Handler
  socket.on("chatMessage", (data) => {
    const room = rooms.get(data.room);
    if (!room) return;
    
    const message = {
      text: data.text,
      sender: socket.id,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })
    };
    
    room.messages.push(message);
    io.to(data.room).emit("chatMessage", message);
  });

  // Disconnect Handler
  socket.on("disconnect", () => {
    rooms.forEach((room, roomId) => {
      if (room.users.delete(socket.id)) {
        if (room.users.size === 0) rooms.delete(roomId);
        io.emit('updateRooms', getAvailableRooms());
      }
    });
    console.log(`← ${socket.id.slice(0,8)} desconectado`);
    logRooms();
  });
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://site-estrangeiro.onrender.com");
  res.header("Access-Control-Allow-Methods", "GET, POST");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});
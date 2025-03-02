const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

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

const rooms = {
  sala1: { users: new Set(), messages: [] },
  sala2: { users: new Set(), messages: [] },
  sala3: { users: new Set(), messages: [] }
};

function logRooms() {
  console.log("\n═ Salas Atuais ════════════════════════");
  Object.entries(rooms).forEach(([name, room]) => {
    console.log(` ${name.padEnd(6)} → ${room.users.size} usuário(s)`);
  });
  console.log("═══════════════════════════════════════\n");
}

io.on("connection", (socket) => {
  console.log(`\n→ Nova conexão: ${socket.id}`);

  socket.on("joinRoom", (room) => {
    console.log(`Tentativa de entrar na sala ${room}`);
    
    Array.from(socket.rooms).forEach(r => {
      if (r !== socket.id && rooms[r]) {
        rooms[r].users.delete(socket.id);
        socket.leave(r);
      }
    });

    socket.join(room);
    rooms[room].users.add(socket.id);
    
    io.emit("updateRooms", {
      sala1: rooms.sala1.users.size,
      sala2: rooms.sala2.users.size,
      sala3: rooms.sala3.users.size
    });
    
    socket.emit("chatHistory", rooms[room].messages);
    console.log(`→ ${socket.id.slice(0,8)} entrou na ${room}`);
    logRooms();
  });

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

  socket.on("chatMessage", (data) => {
    const message = {
      text: data.text,
      sender: socket.id,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })
    };
    rooms[data.room].messages.push(message);
    io.to(data.room).emit("chatMessage", message);
  });

  socket.on("disconnect", () => {
    Object.keys(rooms).forEach(room => {
      if (rooms[room].users.delete(socket.id)) {
        io.emit("updateRooms", {
          sala1: rooms.sala1.users.size,
          sala2: rooms.sala2.users.size,
          sala3: rooms.sala3.users.size
        });
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
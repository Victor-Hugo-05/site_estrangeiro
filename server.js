const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Configuração essencial para serviços em nuvem
  transports: ["websocket", "polling"],
  allowEIO3: true
});

// Configuração essencial para o Render
const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0"; // Obrigatório para serviços em nuvem

// Configurar arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

// Rota principal
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// Sistema de salas
const rooms = {
  sala1: { users: new Set(), messages: [] },
  sala2: { users: new Set(), messages: [] },
  sala3: { users: new Set(), messages: [] }
};

// Função para log das salas
function logRooms() {
  console.log("\n═ Salas Atuais ════════════════════════");
  Object.entries(rooms).forEach(([name, room]) => {
    console.log(` ${name.padEnd(6)} → ${room.users.size} usuário(s)`);
  });
  console.log("═══════════════════════════════════════\n");
}

// Eventos do Socket.io
io.on("connection", (socket) => {
  console.log(`\n→ Nova conexão: ${socket.id}`);

    // Adicione no evento 'connection':
    socket.on("joinRoom", (room) => {
      console.log(`Tentativa de entrar na sala ${room}`);
      console.log("Salas disponíveis:", rooms);
    });

    // Adicione handlers de erro:
    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE Connection State:', peerConnection.iceConnectionState);
    };
    peerConnection.onicegatheringstatechange = () => {
      console.log('ICE Gathering State:', peerConnection.iceGatheringState);
    };

    // Entrar na nova sala
    socket.join(room);
    rooms[room].users.add(socket.id);
    
    // Atualizar todos os clientes
    io.emit("updateRooms", {
      sala1: rooms.sala1.users.size,
      sala2: rooms.sala2.users.size,
      sala3: rooms.sala3.users.size
    });
    
    // Enviar histórico do chat
    socket.emit("chatHistory", rooms[room].messages);
    
    console.log(`→ ${socket.id.slice(0,8)} entrou na ${room}`);
    logRooms();
  });

  // WebRTC Signaling
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

  // Sistema de Chat
  socket.on("chatMessage", (data) => {
    const message = {
      text: data.text,
      sender: socket.id,
      timestamp: new Date().toLocaleTimeString("pt-BR", { hour: '2-digit', minute: '2-digit' })
    };
    rooms[data.room].messages.push(message);
    io.to(data.room).emit("chatMessage", message);
  });

  // Desconexão
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

// Iniciar servidor
server.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});
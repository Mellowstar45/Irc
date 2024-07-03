const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

const PORT = 3001;

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

const users = {};

const rooms = {};
const roomMessages = {};
const roomUsers = {};

const addNewMessageToRooms = (newMessage) => {
  for (const room in roomMessages) {
    if (roomMessages.hasOwnProperty(room)){
      if (!roomMessages[room].some(msg => msg.message === newMessage)) {
        roomMessages[room].push({ roomName: room, message: newMessage });
      }
    }
  }
};

const updateRoomUsers = (roomName) => {
  const usersInRoom = rooms[roomName].members.map(memberId => users[memberId]);
  roomUsers[roomName] = usersInRoom;
  io.to(roomName).emit("users_in_room", roomUsers[roomName]);
};

const checkInactiveRooms = () => {
  const now = Date.now();
  for (const roomName in rooms) {
    if (rooms.hasOwnProperty(roomName)) {
      const room = rooms[roomName];
      if (room.active && now - room.lastUpdated > 2 * 60 * 1000) {
        room.members.forEach((memberId) => {
          io.sockets.sockets.get(memberId).leave(roomName);
        });
        rooms[roomName].active = false;
        const newMessage = "INFO: " + roomName + " was automatically deleted due to inactivity.";
        addNewMessageToRooms(newMessage);
        io.emit("room_deleted", roomName);
        delete roomMessages[roomName];
        delete rooms[roomName];
        console.log("deleted "+ roomName );
      }
    }
  }
};

setInterval(checkInactiveRooms,  60 * 100);

app.get("/api/rooms", (req, res) => {
  const activeRooms = Object.keys(rooms).filter((roomName) => rooms[roomName].active);
  res.json(activeRooms);
});

io.on("connection", (socket) => {
  socket.on("send_message", (data) => {
    const { roomName, message } = data;
    if (!roomMessages[roomName]) {
      roomMessages[roomName] = [];
    }
    roomMessages[roomName].push({ ...data });
    rooms[roomName].lastUpdated = Date.now(); 
    io.to(roomName).emit("display", roomMessages[roomName]);
  });

  socket.on("register", (username) => {
    users[socket.id] = username;
    io.emit("display", roomMessages); 
  });

  socket.on("user", ({last, nv}) => {
    users[socket.id] = nv;
    for (const room in roomMessages) {
      if (roomMessages.hasOwnProperty(room)) {
        roomMessages[room].forEach(msg => {
          msg.message = msg.message.replace(last, nv);
        });
      }
    }
    const newMessage = "INFO: " + last + " changed username to " + nv;
    addNewMessageToRooms(newMessage);
    io.emit("refresh_all_rooms");
  });

  socket.on("create_room", (roomName) => {
    if (!rooms[roomName] || rooms[roomName].active === false) {
      rooms[roomName] = {
        owner: socket.id,
        members: [],
        active: true,
        lastUpdated: Date.now(), 
      };
      socket.join(roomName);
      roomMessages[roomName] = [];
      const newMessage = "INFO: " + users[socket.id] + " created the channel " + roomName;
      addNewMessageToRooms(newMessage);
      io.emit("room_created", roomName);
      io.emit("refresh_all_rooms");
      io.emit("display", roomMessages);
      updateRoomUsers(roomName);
    }
  });

  socket.on("modify_room", ({ roomName, newRoomName }) => {
    const room = rooms[roomName];
    if (room && room.owner === socket.id) {
      rooms[newRoomName] = rooms[roomName];
      roomMessages[newRoomName] = roomMessages[roomName];
      delete rooms[roomName];
      const newMessage = "INFO: Room " + roomName + " renamed to " + newRoomName + " by " + users[socket.id];
      addNewMessageToRooms(newMessage);
      io.emit("display", roomMessages[newRoomName] || []);
      io.emit("room_modified", { oldRoomName: roomName, newRoomName });
    }
  });

  socket.on("delete_room", (roomName) => {
    const room = rooms[roomName];
    if (room && room.owner === socket.id) {
      room.members.forEach((memberId) => {
        io.sockets.sockets.get(memberId).leave(roomName);
      });
      rooms[roomName].active = false;
      const newMessage = "INFO: " + users[socket.id] + " deleted the channel " + roomName;
      addNewMessageToRooms(newMessage);
      io.emit("display", roomMessages[roomName] || []);
      roomMessages[roomName] = [];
      io.emit("room_deleted", roomName);
    }
  });

  socket.on("refresh_all_rooms", () => {
    for (const roomName in rooms) {
      if (rooms.hasOwnProperty(roomName)) {
        io.to(roomName).emit("display", roomMessages[roomName]);
        updateRoomUsers(roomName);
      }
    }
  });

  socket.on("join_room", (roomName) => {
    const room = rooms[roomName];
    if (room && room.active) {
      roomMessages[roomName].push({ roomName: roomName, message: "INFO: " + users[socket.id] + " joined the channel " + roomName });
      rooms[roomName].members.push(socket.id);
      socket.join(roomName);
      rooms[roomName].lastUpdated = Date.now(); 
      io.emit("display", roomMessages[roomName] || []);
      updateRoomUsers(roomName);
    }
  });

  socket.on("join_r", (roomName) => {
    const room = rooms[roomName];
    if (room && room.active) {
      rooms[roomName].members.push(socket.id);
      socket.join(roomName);
      updateRoomUsers(roomName);
    }
    io.emit("display", roomMessages[roomName] || []);
  });

  socket.on("leave_room", (roomName) => {
    const room = rooms[roomName];
    if (room && room.active) {
      roomMessages[roomName].push({ roomName: roomName, message: "INFO: " + users[socket.id] + " left the channel " + roomName });
      room.members = room.members.filter((memberId) => memberId !== socket.id);
      socket.leave(roomName);
      io.emit("display", roomMessages[roomName] || []);
      io.to(roomName).emit("user_left", socket.id);
      updateRoomUsers(roomName);
    }
  });

  socket.on("disconnect", () => {
    for (const roomName in rooms) {
      if (rooms[roomName].members.includes(socket.id)) {
        rooms[roomName].members = rooms[roomName].members.filter(memberId => memberId !== socket.id);
        updateRoomUsers(roomName); 
      }
    }
    delete users[socket.id];
  });

});

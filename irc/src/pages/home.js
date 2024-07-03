import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { socket } from "../socket.js";
import "../css/home.css";

export function Home({ initial }) {
  const navigate = useNavigate();
  const [message, setMessage] = useState("");
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState("");
  const [roomName, setRoomName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [Username, setUsername] = useState("");
  const [username, setUser] = useState(initial);
  const [display, setDisplay] = useState([]);
  const [usersInRoom, setUsersInRoom] = useState([]);

  const sendMessage = () => {
    const commands = {
      "/create": (name) => socket.emit("create_room", name),
      "/delete": (name) => {
        socket.emit("delete_room", name);
        setCurrentRoom("");
      },
      "/change": (name, newname) => {
        console.log(newname);
        socket.emit("modify_room", ({ roomName: name, newRoomName: newname }));
      },
      "/join": (name) => {
        socket.emit("join_room", name);
        setCurrentRoom(name);
        setMessage("");
      },
      "/leave": () => {
        socket.emit("leave_room", currentRoom);
        setCurrentRoom("");
        setMessage("");
      },
      "/nick": (name) => {
        socket.emit("user", { last: username, nv: name });
        setUser(name);
        setUsername("");
      },
      "/list": (name) => {
        if(typeof name === 'undefined' || name.trim() === ""){
          alert("All rooms : \n" + rooms.map((rooms) => rooms).join("\n"));
        }
        else{
          const filteredRooms = rooms.filter((room) =>
            room.toLowerCase().includes(name.toLowerCase())
          );
          alert("Rooms containing '" + name + "' :\n" + filteredRooms.join("\n"));
        }
      },
      "/users": () => {
        alert("Users : \n" + usersInRoom.map((users) => users).join("\n"));
      },
      "/msg": (name) => {},
    };

    if (message.startsWith("/")) {
      const [command, name, newname] = message.split(" ");
      var nvn = name;
      if (commands[command]) {
        commands[command](name, newname);
      }
    }
    var fullMessage = "";
    if(nvn){
      fullMessage = `${nvn} : ${message}`;
      nvn = "";
    } else{
      fullMessage = `${username} : ${message}`;
    }

    socket.emit("send_message", {
      roomName: currentRoom,
      message: fullMessage,
    });
    setMessage("");
  };

  const createRoom = () => {
    socket.emit("create_room", roomName);
  };

  const modifyRoom = () => {
    socket.emit("modify_room", { roomName: currentRoom, newRoomName });
  };

  const deleteRoom = () => {
    socket.emit("delete_room", currentRoom);
    setCurrentRoom("");
  };

  const joinRoom = (room) => {
    socket.emit("join_room", room);
    setCurrentRoom(room);
    setMessage("");
  };

  const leaveRoom = () => {
    socket.emit("leave_room", currentRoom);
    setCurrentRoom("");
    setMessage("");
  };

  const changeUsername = () => {
    socket.emit("user", { last: username, nv: Username });
    setUser(Username);
    setUsername("");
  };

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await fetch("/api/rooms");
        if (!response.ok) {
          throw new Error("Failed to fetch rooms");
        }
        const fetchedRooms = await response.json();
        setRooms(fetchedRooms);
      } catch (error) {
        console.error("Error fetching rooms:", error);
      }
    };

    socket.on("room_created", (roomName) => {
      setRooms((prevRooms) => [...prevRooms, roomName]);
    });

    socket.on("room_modified", ({ oldRoomName, newRoomName }) => {
      setRooms((prevRooms) =>
        prevRooms.map((room) => (room === oldRoomName ? newRoomName : room))
      );
      if (currentRoom === oldRoomName) {
        setCurrentRoom(newRoomName);
        socket.emit("join_r", newRoomName);
      }
    });

    socket.on("room_deleted", (roomName) => {
      setRooms((prevRooms) => prevRooms.filter((room) => room !== roomName));
    });

    if (!username || username.trim() === "") {
      navigate("/");
    }

    fetchRooms();

    return () => {
      socket.off("room_created");
      socket.off("room_modified");
      socket.off("room_deleted");
      socket.off("user_joined");
      socket.off("user_left");
    };
  }, [username, navigate, currentRoom]);

  useEffect(() => {
    socket.on("display", (data) => {
      setDisplay(data);
    });

    return () => {
      socket.off("display");
    };
  }, []);
  
  useEffect(() => {
    socket.on("users_in_room", (users) => {
      let tmp = [];
      for(let i = 0; i < users.length; i++){
        if(!tmp.includes(users[i])){
          tmp.push(users[i]);
        }
      }
      setUsersInRoom(tmp);
    });
  
    return () => {
      socket.off("users_in_room");
    };
  }, []);
  

  return (
    <div className="main">
      <h1>Welcome {username}!</h1>
      {currentRoom ? (
        <div>
          <h2 className="modify">Modify Room</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              type="text"
              value={newRoomName}
              onChange={(event) => setNewRoomName(event.target.value)}
              placeholder="New room name"
            />
            <button onClick={modifyRoom}>Modify Room</button>
          </form>
          <div className="chatroom">
          
          <button onClick={leaveRoom}>Leave Room</button>
          <button onClick={deleteRoom}>Delete Room</button>

          <div>
            <h3>Users in Room:</h3>
            <ul className="ulUser">
              {usersInRoom.map((user, index) => (
                <li key={index}>{user}</li>
              ))}
            </ul>
          </div>
          <h2>Room: {currentRoom}</h2>
          <div className="chat">
            {Array.isArray(display) &&
              display.map((msg, index) => {
                if (msg.message.includes('@' + username)) {
                  return <p key={index}>{msg.message}</p>;
                } else if (!msg.message.includes('@')) {
                  return <p key={index}>{msg.message}</p>;
                }
              })}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              type="text"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Send a message"
            />
            <button onClick={sendMessage}>Send</button>
          </form>
          </div>
        </div>
      ) : (
        <div className="options">
          <h2>Change Username</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              type="text"
              value={Username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
            />
            <button onClick={changeUsername}>Change</button>
          </form>
          <h2>Create Room</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              type="text"
              value={roomName}
              onChange={(event) => setRoomName(event.target.value)}
              placeholder="Room name"
            />
            <button onClick={createRoom}>Create Room</button>
          </form>
          <div className="roomlist">
            <h2>Rooms</h2>
            <ul>
              {rooms.map((room) => (
                <li key={room}>
                  {room} <button onClick={() => joinRoom(room)}>Join</button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

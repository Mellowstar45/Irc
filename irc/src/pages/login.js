import React, { useState } from "react";
import { socket } from "../socket.js";
import { useNavigate } from "react-router-dom";
import "../css/login.css";

export function Login({ setUsername }) {
  const [username, setUsernameState] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (username) {
      socket.emit("register", username);
      setUsername(username);
      navigate("/home");
    }
  };

  return (
    <div className="container">
      <div className="login">
        <h1>Login</h1>
        <form onSubmit={handleSubmit}>
          <label  className="user"htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            className="user"
            name="username"
            value={username}
            onChange={(e) => setUsernameState(e.target.value)}
          />
          <input className="submit" type="submit" value="Login" />
        </form>
      </div>
    </div>
  );
}

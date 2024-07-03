import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Login } from "./pages/login";
import { Home } from "./pages/home";

function App() {
  const [username, setUsername] = useState("");

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={<Login setUsername={setUsername} />}
        />
        <Route
          path="/home"
          element={<Home initial={username} />}
        />
      </Routes>
    </Router>
  );
}

export default App;

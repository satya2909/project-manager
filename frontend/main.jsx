import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider } from "./context/authcontext.jsx";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);

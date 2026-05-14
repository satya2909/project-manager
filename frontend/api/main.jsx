import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "../../backend/src/App.js";
import { AuthProvider } from "../../backend/src/context/AuthContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);

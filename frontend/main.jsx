import React from "react";
import ReactDOM from "react-dom/client";
import { ThemeProvider } from "./context/theme.jsx";
import { ToastProvider } from "./components/ui/Toast.jsx";
import { AuthProvider } from "./context/authcontext.jsx";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

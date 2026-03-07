import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initializeAppSettings } from "./utils/appSettings";
import "./styles/theme.css";

initializeAppSettings();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
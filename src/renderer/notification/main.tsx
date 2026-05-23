import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/global.css";
import { Popup } from "./Popup";

const container = document.getElementById("root");
if (!container) throw new Error("#root not found");

createRoot(container).render(
  <StrictMode>
    <Popup text="سُبْحَانَ اللَّهِ وَبِحَمْدِهِ" />
  </StrictMode>,
);

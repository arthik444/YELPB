import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Disable console logs in production
if (import.meta.env.PROD) {
  console.log = () => { };
  console.debug = () => { };
  console.info = () => { };
  // Keep console.warn and console.error for important issues
}

createRoot(document.getElementById("root")!).render(<App />);
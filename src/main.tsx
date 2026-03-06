import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Hide the inline loading screen once React renders
const hideLoader = () => {
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.classList.add('fade-out');
    setTimeout(() => loader.remove(), 400);
  }
};

createRoot(document.getElementById("root")!).render(<App />);

// Hide loader after first paint
requestAnimationFrame(() => {
  requestAnimationFrame(hideLoader);
});

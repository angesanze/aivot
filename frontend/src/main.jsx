import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Embed from "./components/Embed.jsx";
import "./index.css";

/* /embed/<token> è la pagina pubblica del widget (iframe): niente login,
   niente app — solo la griglia della pianificazione condivisa. */
const embed = window.location.pathname.match(/^\/embed\/([\w-]+)\/?$/);

ReactDOM.createRoot(document.getElementById("root")).render(
  embed ? <Embed token={embed[1]} /> : <App />
);

import { createRoot } from "react-dom/client";
import Panel from "./Panel";
import panelCss from "./panel.css?inline";

// Use a shadow root so SalahSync styles are fully isolated from the page
const host = document.createElement("div");
host.id = "salahsync-host";
document.body.appendChild(host);

const shadow = host.attachShadow({ mode: "open" });

const styleEl = document.createElement("style");
styleEl.textContent = panelCss;
shadow.appendChild(styleEl);

const mountEl = document.createElement("div");
shadow.appendChild(mountEl);

createRoot(mountEl).render(<Panel />);

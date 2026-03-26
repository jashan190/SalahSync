import { createRoot } from "react-dom/client";
import Panel from "./Panel";
import panelCss from "./panel.css?inline";

function inject(target) {
  if (document.getElementById("salahsync-host")) return;

  const host = document.createElement("div");
  host.id = "salahsync-host";
  target.parentNode.insertBefore(host, target);

  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = panelCss;
  shadow.appendChild(styleEl);

  const mountEl = document.createElement("div");
  shadow.appendChild(mountEl);

  createRoot(mountEl).render(<Panel />);
}

function tryInject() {
  const target = document.getElementById("MessageContainer");
  if (target) inject(target);
}

tryInject();

// Schedule Builder is a SPA — watch for MessageContainer to appear
const observer = new MutationObserver(tryInject);
observer.observe(document.body, { childList: true, subtree: true });

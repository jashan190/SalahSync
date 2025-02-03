// Ensure the offscreen document is created
function ensureOffscreen() {
  chrome.offscreen.hasDocument((hasDocument) => {
    console.log("Offscreen document exists:", hasDocument);
    if (!hasDocument) {
      chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["GEOLOCATION"],
        justification: "Fetch user location for prayer times."
      }).then(() => {
        console.log("Offscreen document created successfully.");
      }).catch((err) => {
        console.error("Failed to create offscreen document:", err.message);
      });
    }
  });
}

// Handle messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "get-geolocation") {
    ensureOffscreen();

    // Send a message to the offscreen document
    chrome.runtime.sendMessage(
      { target: "offscreen", type: "get-geolocation" },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending message to offscreen:", chrome.runtime.lastError.message);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else if (response?.success) {
          console.log("Geolocation received:", response.location);
          sendResponse(response);
        } else {
          console.error("Invalid response from offscreen:", response);
          sendResponse({ error: "No valid response from offscreen." });
        }
      }
    );

    return true; // Keep the message channel open
  }
});

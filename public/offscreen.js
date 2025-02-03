chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.target !== "offscreen" || message.type !== "get-geolocation") {
      console.warn("Received unexpected message:", message);
      return;
    }
  
    console.log("Geolocation request received in offscreen.js");
  
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        console.log(`Geolocation success: Latitude ${latitude}, Longitude ${longitude}`);
        sendResponse({ success: true, location: { latitude, longitude } });
      },
      (error) => {
        console.error("Error getting geolocation:", error.message);
        sendResponse({ success: false, error: error.message });
      }
    );
  
    return true; // Keeps the message channel open for async responses
  });
  
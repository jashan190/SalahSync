import React from "react";
import ReactDOM from "react-dom/client";
import PrayerTimes from "./components/PrayerTimes";  // ← your popup component
import "./components/PrayerTimes.css"; 
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <PrayerTimes />
  </React.StrictMode>
);

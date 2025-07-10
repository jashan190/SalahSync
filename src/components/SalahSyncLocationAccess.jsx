import React from "react";
import "./PrayerTimes.css";

/**
 * Landing page matching Figma design.
 * Props:
 * - onRequestLocation: () => void
 * - loading: boolean
 */
export default function SalahSyncLocationAccessPage({ onRequestLocation, loading }) {
  return (
    <div className="PrayerTimes-Container">
      {/* Allow Location Access Button */}
      <div className="frame">
        <div className="allow-location-access">
          <button
            onClick={loading ? undefined : onRequestLocation}
            disabled={loading}
          >
            {loading ? 'Locating...' : 'Allow Location Access'}
          </button>
        </div>
      </div>
    </div>
  );
}
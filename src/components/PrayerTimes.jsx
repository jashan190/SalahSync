import React, { useState, useEffect } from "react";

const PrayerTimes = () => {
  const [prayerTimes, setPrayerTimes] = useState({});
  const [nextPrayer, setNextPrayer] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useState(null);
  const [locationAccessGranted, setLocationAccessGranted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch stored location and prayer times when component loads
  useEffect(() => {
    function handleStorageChange(changes, areaName) {
      if (areaName === "local" && changes.prayerTimes) {
        console.log("Storage changed! Updating prayer times.");
        setPrayerTimes(changes.prayerTimes.newValue);
        setNextPrayer(findNextPrayer(changes.prayerTimes.newValue));
      }
    }
  
    chrome.storage.onChanged.addListener(handleStorageChange);
  
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);
  

  useEffect(() => {
    if (nextPrayer) {
      const interval = setInterval(() => {
        updateCountdown(nextPrayer);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [nextPrayer]);

  const updatePrayerTimes = (prayerData) => {
    setPrayerTimes(prayerData);
    const nextPrayerTime = findNextPrayer(prayerData);
    setNextPrayer(nextPrayerTime);
  };

  const requestGeolocation = () => {
    if ("geolocation" in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log("User's location:", latitude, longitude);
          const userLocation = { latitude, longitude };
  
          // Reverse geocode to get city and state
          const humanReadableLocation = await reverseGeocode(latitude, longitude);
          if (humanReadableLocation) {
            userLocation.cityState = humanReadableLocation;
          }
  
          // Store location in Chrome storage
          chrome.storage.local.set({ userLocation }, () => {
            console.log("Location saved:", userLocation);
          });
  
          setLocation(userLocation);
          setLocationAccessGranted(true);
          fetchPrayerTimes(latitude, longitude);
        },
        (err) => {
          console.error("Error getting location:", err.message);
          setError("Failed to get your location. Please enable location services.");
          setLoading(false);
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
      setError("Geolocation is not supported by your browser.");
    }
  };
  
  function convertCoordinates(latitude,longitude){
    
  }

  const fetchPrayerTimes = async (latitude, longitude) => {
    try {
      if (!latitude || !longitude) {
        throw new Error("Missing coordinates for prayer times.");
      }

      const url = `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=2`;
      console.log("Fetching prayer times from:", url);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();
      if (data?.data?.timings) {
        console.log("Prayer times fetched:", data.data.timings);
        const timings = filterPrayerTimes(data.data.timings);
        updatePrayerTimes(timings);

        chrome.storage.local.set({ prayerTimes: timings }, () => {
          console.log("Prayer times saved to storage:", timings);
        });
      } else {
        throw new Error("Invalid API response format.");
      }
    } catch (err) {
      console.error("Failed to fetch prayer times:", err.message);
      setError("Failed to fetch prayer times. Please try again.");
    }
  };

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const apiKey = "YOUR_API_KEY"; // Replace with OpenCage Geocoder API key
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}`;
      console.log("Fetching location from:", url);
  
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Geocoding API returned status ${response.status}`);
      }
  
      const data = await response.json();
      console.log("Geolocation API Response:", data);
  
      if (data?.results?.length > 0) {
        const components = data.results[0].components;
        const city = components.city || components.town || components.village;
        const state = components.state;
        if (city && state) {
          return `${city}, ${state}`;
        }
      }
      throw new Error("No valid location data found.");
    } catch (err) {
      console.error("Failed to reverse geocode:", err.message);
      return null;
    }
  };
  
  

  const filterPrayerTimes = (timings) => {
    return Object.fromEntries(
      Object.entries(timings).filter(
        ([key]) => !["Midnight", "Imsak", "Firstthird", "Lastthird"].includes(key)
      )
    );
  };

  const findNextPrayer = (timings) => {
    const now = new Date();
  
    // Order prayers properly
    const prayerOrder = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    const filteredTimings = Object.entries(timings).filter(([name]) =>
      prayerOrder.includes(name)
    );
  
    for (const [name, time] of filteredTimings) {
      const prayerTime = new Date(`${now.toDateString()} ${time}`);
      if (prayerTime > now) {
        return { name, time: prayerTime };
      }
    }
  
    // If no upcoming prayers today, return Fajr of the next day
    return { name: "Fajr", time: new Date(now.setDate(now.getDate() + 1)) };
  };
  
  

  const updateCountdown = (nextPrayer) => {
    const now = new Date();
    const timeDiff = nextPrayer.time - now;

    if (timeDiff <= 0) {
      setCountdown("It's time to pray!");
    } else {
      const hours = Math.floor((timeDiff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((timeDiff / (1000 * 60)) % 60);
      const seconds = Math.floor((timeDiff / 1000) % 60);
      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    }
  };

  return (
    <div>
      <h2>Prayer Times</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      {!locationAccessGranted && (
        <button onClick={requestGeolocation}>Allow Location Access</button>
      )}

      {locationAccessGranted && location && (
        <p>
          Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
        </p>
      )}
      {loading && <p>Fetching prayer times...</p>}

      {Object.entries(prayerTimes).length > 0 && !loading && (
        <>
          <ul>
            {Object.entries(prayerTimes).map(([name, time]) => (
              <li key={name}>
                {name}: {time}
              </li>
            ))}
          </ul>
          {nextPrayer && (
            <p>
              Next prayer: {nextPrayer.name} ({nextPrayer.time.toLocaleTimeString()})
            </p>
          )}
          <p>Time remaining: {countdown}</p>
        </>
      )}
    </div>
  );
};

export default PrayerTimes;

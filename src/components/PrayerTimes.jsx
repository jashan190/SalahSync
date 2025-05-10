import React, { useState, useEffect } from "react";
import { Bell, Settings } from "lucide-react";


const PrayerTimes = () => {
  const [prayerTimes, setPrayerTimes] = useState({});
  const [nextPrayer, setNextPrayer] = useState(null);
  const [countdown, setCountdown] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useState(null);
  const [locationAccessGranted, setLocationAccessGranted] = useState(false);
  const [loading, setLoading] = useState(false);
  const apiKey = import.meta.env.VITE_OPENCAGE_API_KEY;


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
      }, 10);
      return () => clearInterval(interval);
      console.log("🖥 UI Updated! Current prayer times:", prayerTimes);
    }
  }, [nextPrayer]);

  const updatePrayerTimes = (prayerData) => {
    console.log("⚡ Updating UI with new prayer times:", prayerData);
    
    // Ensure prayerData is valid before updating state
    if (!prayerData || typeof prayerData !== "object") {
      console.error("❌ Invalid prayerData:", prayerData);
      return;
    }
  
    setPrayerTimes((prev) => ({ ...prev, ...prayerData })); // Force React to detect a state change
    setLoading(false); // Stop showing "Fetching prayer times..."
 // Ensure React sees a new object
    setLoading(false); // Stop showing "Fetching prayer times..."
  
    setNextPrayer(findNextPrayer(prayerData));
  };
  
  
  const reverseGeocode = async (latitude, longitude) => {
    try {
      
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${apiKey}`;
      //console.log("📍 Fetching city/state from:", url);
  
      const response = await fetch(url);
      //console.log("🌎 Reverse Geocode Status:", response.status);
  
      if (!response.ok) {
        throw new Error(`Geocoding API returned status ${response.status}`);
      }
  
      const data = await response.json();
      console.log("📜 Geolocation API Response:", data);
  
      if (data?.results?.length > 0) {
        const components = data.results[0].components;
        const city = components.city || components.town || components.village;
        const state = components.state;
        if (city && state) {
          console.log(`✅ Found location: ${city}, ${state}`);
          return `${city}, ${state}`;
        }
      }
      throw new Error("No valid location data found.");
    } catch (err) {
      console.error("❌ Failed to reverse geocode:", err.message);
      return null;
    }
  };

  const requestGeolocation = () => {
    if ("geolocation" in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          console.log("📍 User's location:", latitude, longitude);

          const userLocation = { latitude, longitude };

          // Reverse geocode to get city and state
          const humanReadableLocation = await reverseGeocode(latitude, longitude);
          if (humanReadableLocation) {
            userLocation.cityState = humanReadableLocation;
            console.log("✅ City/State found:", humanReadableLocation);
          } else {
            console.warn("⚠️ Reverse geocoding failed, using coordinates only.");
          }

          // Store in Chrome Storage
          chrome.storage.local.set({ userLocation }, () => {
            console.log("💾 Location saved:", userLocation);
          });

          // ✅ Update state correctly
          setLocation((prev) => ({
            ...prev,
            latitude,
            longitude,
            cityState: humanReadableLocation || "Unknown Location",
          }));

          setLocationAccessGranted(true);
          fetchPrayerTimes(latitude, longitude);
        },
        (err) => {
          console.error("❌ Error getting location:", err.message);
          setError("Failed to get your location. Please enable location services.");
          setLoading(false);
        }
      );
    } else {
      console.error("❌ Geolocation is not supported by this browser.");
      setError("Geolocation is not supported by your browser.");
    }
};

/*const hanafiAsrTime = async (latitude, longitude) => {
  try {
    if (!latitude || !longitude) {
      throw new Error("Missing coordinates for prayer times.");
    }


  }
  catch (err) {
    console.error("Failed to fetch Asr time:", err.message);
    setError("Failed to fetch prayer times. Please try again.");
  }
};*/
  

  

const fetchPrayerTimes = async (latitude, longitude) => {
  try {
    if (!latitude || !longitude) {
      throw new Error("Missing coordinates for prayer times.");
    }

    const url = `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=2`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();

    if (data?.data?.timings) {
      const timings = filterPrayerTimes(data.data.timings);

      setPrayerTimes({ ...timings });
      setLoading(false);
      setNextPrayer(findNextPrayer(timings));

      chrome.storage.local.set({ prayerTimes: timings }, () => {
        console.log("Prayer times saved to storage:", timings);
      });

     
      Object.entries(timings).forEach(([prayerName, time]) => {
        const [hours, minutes] = time.split(/[: ]/);
        const isPM = time.includes('PM');
        const prayerDateTime = new Date();
        prayerDateTime.setHours(
          parseInt(hours) + (isPM && hours !== '12' ? 12 : 0),
          parseInt(minutes),
          0
        );

        chrome.runtime.sendMessage({
          type: "set-prayer-alarms",
          prayerName,
          timeString: prayerDateTime.toString(),
        });
      });

    } else {
      throw new Error("Invalid API response format.");
    }
  } catch (err) {
    console.error("Failed to fetch prayer times:", err.message);
    setError("Failed to fetch prayer times. Please try again.");
  }
};

  

  
  
  
  

  const filterPrayerTimes = (timings) => {
    return Object.fromEntries(
      Object.entries(timings).filter(
        ([key]) => !["Midnight", "Imsak", "Firstthird", "Lastthird"].includes(key)
      )
    );
  };

  const findCurrentPrayer = (timings) => {
    const now = new Date();
    const prayerOrder = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

    let lastPrayer = null;

    for (const name of prayerOrder) {
        if (timings[name]) {
            const prayerTime = new Date(`${now.toDateString()} ${timings[name]}`);

            if (prayerTime <= now) {
                lastPrayer = { name, time: prayerTime };  // ✅ Keep track of the most recent prayer
            } else {
                // ✅ If the next prayer is in the future, return the last one
                return lastPrayer;
            }
        }
    }

    return lastPrayer; // Return the last prayer found (if any)
};


  const findNextPrayer = (timings) => {
    const now = new Date();
    const prayerOrder = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  
    for (const name of prayerOrder) {
      if (timings[name]) {
        const prayerTime = new Date(`${now.toDateString()} ${timings[name]}`);
        if (prayerTime > now) {
          console.log(`⏳ Next prayer found: ${name} at ${prayerTime.toLocaleTimeString()}`);
          return { name, time: prayerTime };
        }
      }
    }
  
    // Default to Fajr of the next day
    const nextFajrTime = new Date();
    nextFajrTime.setDate(now.getDate() + 1);
    nextFajrTime.setHours(5, 55, 0);
    return { name: "Fajr", time: nextFajrTime };
  };
  
  
  
  

  const updateCountdown = (nextPrayer) => {
    if (!nextPrayer || !nextPrayer.time) {
      setCountdown("No upcoming prayer.");
      return;
    }
  
    const now = new Date();
    const timeDiff = nextPrayer.time - now;
  
    if (timeDiff <= 0) {
      setCountdown("It's time to pray!");
    } else {
      const hours = Math.floor(timeDiff / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff / (1000 * 60)) % 60);
      const seconds = Math.floor((timeDiff / 1000) % 60);
      
      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    }
  };
  
 
  return (
    <div className="relative w-[250px] h-[500px] rounded-2xl overflow-hidden text-white font-[Rubik] py-8 px-6"
      style={{
        background: "linear-gradient(90deg, #6C3483 0%, #1F618D 100%)",
      }}
    >
      {/* Top Buttons */}
      <div className="flex justify-between items-center mb-6">
        {!locationAccessGranted ? (
          <button
            className="h-10 px-4 border border-white rounded-lg shadow-md text-sm"
            onClick={requestGeolocation}
          >
            Allow Location Access
          </button>
        ) : (
          <button className="h-10 px-4 border border-white rounded-lg shadow-md text-sm flex items-center gap-2">
            <Settings className="w-5 h-5 text-white" />
            <span>Settings</span>
          </button>
        )}
      </div>
  
      {/* Current Salah Name */}
      <div className="flex justify-center items-center mb-5">
        <h1 className="text-4xl font-bold tracking-tight">{nextPrayer?.name || "Loading..."}</h1>
      </div>
  
      {/* Progress Circle */}
      <div className="relative w-40 h-40 mx-auto mt-4 mb-8">
        <div className="absolute inset-0 bg-gray-400 rounded-full"></div>
        <div className="absolute inset-1 bg-white rounded-full flex items-center justify-center">
          <span className="text-lg text-center text-black">
            {countdown || "..."}
          </span>
        </div>
      </div>
  
      {/* Prayer Times */}
      <div className="flex flex-col gap-8">
        {["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].map((name) => {
          const prayerTime = prayerTimes?.[name]
            ? new Date(`1970-01-01T${prayerTimes[name]}`).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })
            : "--:--";
  
          const isNow = name === nextPrayer?.name;
  
          return (
            <div key={name} className="flex justify-between items-center pb-4 border-b border-white">
              <div className="flex items-center gap-4">
                <Bell className="w-6 h-6 text-white" />
                <span className={`text-xl ${isNow ? "font-bold" : "font-normal"}`}>
                  {name}
                </span>
              </div>
              <span className={`text-xl ${isNow ? "font-bold" : "font-normal"}`}>
                {prayerTime}
              </span>
            </div>
          );
        })}
      </div>
  
      {/* Date and Location */}
      <div className="mt-8 text-center flex flex-col items-center gap-2">
        <p className="text-lg tracking-tight">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <p className="text-lg tracking-tight">{location?.cityState || "Unknown Location"}</p>
      </div>
    </div>
  );
  
};

export default PrayerTimes;


import React, { useState, useEffect } from 'react';

const PrayerTimes = () => {
  const [location, setLocation] = useState({ city: '', country: '', state: '' });
  const [prayerTimes, setPrayerTimes] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch prayer times on mount if location is already saved
    chrome.storage.local.get(['userLocation'], (result) => {
      if (result.userLocation) {
        setLocation(result.userLocation);
        fetchPrayerTimes(result.userLocation);
      }
    });
  }, []);

  const fetchPrayerTimes = async (loc) => {
    try {
      const { city, country, state } = loc;
      const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(
        city
      )}&country=${encodeURIComponent(country)}&state=${encodeURIComponent(
        state
      )}&method=2`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();
      if (data && data.data && data.data.timings) {
        setPrayerTimes(data.data.timings);
        chrome.storage.local.set({ prayerTimes: data.data.timings });
      } else {
        throw new Error('Invalid API response format.');
      }
    } catch (err) {
      console.error('Failed to fetch prayer times:', err.message);
      setError('Failed to fetch prayer times. Please try again.');
    }
  };

  const handleLocalSubmit = (e) => {
    e.preventDefault();
    chrome.storage.local.set({ userLocation: location }, () => {
      console.log('User location saved:', location);
      fetchPrayerTimes(location); // Fetch prayer times after saving location
    });
  };

  const handleInputChange = (e) => {
    setLocation({ ...location, [e.target.name]: e.target.value });
  };

  return (
    <div>
      <form onSubmit={handleLocalSubmit}>
        <input
          type="text"
          name="city"
          value={location.city}
          onChange={handleInputChange}
          placeholder="City"
          required
        />
        <input
          type="text"
          name="country"
          value={location.country}
          onChange={handleInputChange}
          placeholder="Country"
          required
        />
        <input
          type="text"
          name="state"
          value={location.state}
          onChange={handleInputChange}
          placeholder="State (optional)"
        />
        <button type="submit">Save Location</button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div>
        <h2>Prayer Times</h2>
        {Object.entries(prayerTimes).length > 0 ? (
          Object.entries(prayerTimes).map(([name, time]) => (
            <p key={name}>
              {name}: {time}
            </p>
          ))
        ) : (
          <p>No prayer times available. Please set your location.</p>
        )}
      </div>
    </div>
  );
};

export default PrayerTimes;

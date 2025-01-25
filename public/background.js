chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed. Setting up alarms to notify . . .");
  setupPrayerAlarms();
});

function setupPrayerAlarms() {
  getPrayerTimes()
}


function getPrayerTimes() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['userLocation'], (result) => {
      if (result.userLocation) {
        const location = result.userLocation;

        const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(
          location.city
        )}&country=${encodeURIComponent(location.country)}&state=${encodeURIComponent(
          location.state
        )}&method=2`;

        // Fetch prayer times from the API
        fetch(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error(`API returned status ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            if (data && data.data && data.data.timings) {
              resolve(data.data.timings); // Resolve with timings
            } else {
              reject('Invalid API response format.');
            }
          })
          .catch((error) => {
            reject(`Failed to fetch prayer times: ${error.message}`);
          });
      } else {
        // Notify the user to set their location
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon128.png',
          title: 'Prayer Time Notifier',
          message: 'Please set your location in the extension popup.',
          priority: 2,
        });
        reject('User location is not set in storage.');
      }
    });
  });
}

  
  

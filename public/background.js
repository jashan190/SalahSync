
chrome.runtime.onInstalled.addListener(() => {
    // Setup alarms when the extension is installed/updated
    setupPrayerAlarms();
  });
  
  function setupPrayerAlarms() {
    getPrayerTimes().then(prayerTimes => {
      // Clear existing alarms
      chrome.alarms.clearAll(() => {
        for (const [prayer, time] of Object.entries(prayerTimes)) {
            // Create an alarm for each prayer
            chrome.alarms.create(prayer, { when: Date.parse(time) });
        }
      });
    }).catch(error => {
      console.error('Failed to setup alarms:', error);
      // Handle errors, perhaps by notifying the user
    });
  }
  
  
  // Listener for alarm
  chrome.alarms.onAlarm.addListener((alarm) => {
    // Show notification when alarm goes off
    chrome.notifications.create('', {
        type: 'basic',
        iconUrl: 'icon.png', // Replace with the path to your notification icon
        title: 'Prayer Time',
        message: `It's time for ${alarm.name}`,
        priority: 2
    });
  });
  
  
  // Placeholder function to simulate fetching prayer times
  function getPrayerTimes() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['userLocation'], function(result) {
        if (result.userLocation) {
          const location = result.userLocation;
  
          // Use all parts of the location in your API call
          const url = `https://api.aladhan.com/v1/timingsByCity?city=${encodeURIComponent(location.city)}&country=${encodeURIComponent(location.country)}&state=${encodeURIComponent(location.state)}&method=2`;
  
          // Rest of the function remains the same
        } else {
          reject("User location is not set in storage.");
        }
      });
    });
  }
  
  

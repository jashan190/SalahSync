

function handleSettingAlarms() {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg === "set-prayer-alarms") {
      console.log(" Alarm triggered for prayer time:", alarm);
      // Handle the alarm (e.g., show a notification)

      const when =  new Date (msg.timeString).getTime();
      chrome.alarms.create(msg.prayerName, { when });
    }
  });
};

  chrome.alarm.onAlarm.addListener((alarm) => {
    chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.png",
        title: "Prayer Time Alert",
        message: `It's time for ${alarm.data.prayerName}!`,
        priority: 1
      });
  });
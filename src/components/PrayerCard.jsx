import React from "react";

const PrayerCard = ({ prayerTimes, currentPrayer, nextPrayer, location, countdown }) => {
  const safeCurrent = currentPrayer || { name: "Unknown", time: new Date() };

  return (
    <div className="relative w-[320px] h-[600px] bg-gradient-to-r from-[#2CA95C] to-[#1F7EC2] rounded-2xl font-[Biryani] text-white shadow-lg">

      {/* Current Prayer */}
      <h1 className="absolute top-[30px] left-1/2 -translate-x-1/2 text-[40px] text-center">
        {safeCurrent.name}
      </h1>

      {/* Countdown */}
      <p className="absolute top-[90px] left-1/2 -translate-x-1/2 text-[20px] text-center">
        {countdown || "Calculating..."}
      </p>

      {/* Date */}
      <p className="absolute top-[120px] left-1/2 -translate-x-1/2 text-[14px] text-center">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      {/* Location */}
      <p className="absolute top-[145px] left-1/2 -translate-x-1/2 text-[14px] text-center truncate">
        {location?.cityState || "Unknown Location"}
      </p>

      {/* White Layered Box */}
      <div className="absolute top-[180px] left-[10px] w-[300px] h-[380px] bg-white rounded-2xl text-black px-4 py-4 shadow-lg">
        {["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].map((name) => {
          const prayerTime = prayerTimes?.[name]
            ? new Date(`1970-01-01T${prayerTimes[name]}`).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })
            : "--:--";

          return (
            <div key={name} className="flex justify-between items-center border-b border-gray-300 py-2 last:border-none">
              <span className="text-[18px]">{name}</span>
              <span className="text-[18px] font-semibold">{prayerTime}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrayerCard;

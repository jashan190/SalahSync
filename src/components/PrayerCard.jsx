import React from "react";
import { Bell, BellOff } from "lucide-react";

const PrayerCard = ({ prayerTimes, currentPrayer, nextPrayer, location, countdown }) => {
  const safeCurrent = currentPrayer || { name: "Unknown", time: new Date() };
  const safeNext = nextPrayer || { name: "Unknown", time: new Date() };

  return (
    <div className="relative w-[450px] h-[1000px] rounded-2xl bg-gradient-to-r from-[#2CA95C] to-[#1F7EC2] text-white font-[Biryani]">
      {/* Current Prayer Title */}
      <h1 className="absolute w-[117px] h-[113px] left-1/2 transform -translate-x-1/2 top-[calc(50%-404.5px)] text-[64px] leading-[113px] text-center">
        {safeCurrent.name}
      </h1>

      {/* Countdown */}
      <p className="absolute w-[233px] h-[53px] left-1/2 transform -translate-x-1/2 top-[143px] text-[30px] leading-[53px] text-center">
        {countdown || "Calculating..."}
      </p>

      {/* Date */}
      <p className="absolute w-[261px] h-[35px] left-1/2 transform -translate-x-1/2 top-[202px] text-[20px] leading-[35px] text-center">
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </p>

      {/* Location */}
      <p className="absolute w-[93px] h-[35px] left-1/2 transform -translate-x-1/2 top-[228px] text-[20px] leading-[35px] text-center">
        {location?.cityState || "Unknown Location"}
      </p>

      {/* White Inner Card */}
      <div className="absolute top-[275px] left-[1px] w-[450px] h-[725px] bg-white rounded-2xl text-black box-border p-4">
        {["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].map((name, index) => {
          const prayerTime = prayerTimes?.[name] || "--:--";
          const topOffset = 79 + index * 77; // spacing between rows

          return (
            <div
              key={name}
              className={`absolute top-[${topOffset}px] left-[82px] flex justify-between items-center w-full pr-8`}
            >
              {name === "Dhuhr" ? (
                <BellOff className="text-gray-500 mr-2" />
              ) : (
                <Bell className="text-purple-600 mr-2" />
              )}
              <span className="text-[32px] font-medium w-1/3">{name}</span>
              <span className="text-[32px] font-bold w-1/3 text-right">{prayerTime}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PrayerCard;

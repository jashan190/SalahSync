import { Bell } from "lucide-react";

const PrayerCard = ({ prayerTimes, currentPrayer, nextPrayer, location, countdown }) => {
  const safeCurrent = currentPrayer || { name: "Unknown", time: new Date() };

  return (
    <div className="relative w-[300px] h-[660px] bg-gradient-to-r from-[#6C3483] to-[#1F618D] rounded-[16px] text-white font-rubik shadow-lg p-4">

      {/* Title */}
      <h1 className="text-center text-[32px] font-extrabold mt-2">{safeCurrent.name}</h1>

      {/* Countdown inside progress ring */}
      <div className="relative w-[160px] h-[160px] mx-auto mt-2">
        <div className="absolute inset-0 rounded-full bg-[#95A5A6]"></div>
        <div className="absolute inset-[3px] rounded-full bg-[#052525] flex items-center justify-center text-center text-[16px] text-black font-medium">
          {countdown || "Calculating..."}
        </div>
      </div>

      {/* White prayer time box */}
      <div className="mt-4 bg-white bg-opacity-90 rounded-[16px] text-black px-4 py-4 shadow-md space-y-2">
        {["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"].map((name) => {
          const prayerTime = prayerTimes?.[name]
            ? new Date(`1970-01-01T${prayerTimes[name]}`).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })
            : "--:--";
          const isNow = name === safeCurrent.name;

          return (
            <div key={name} className="flex items-center justify-between border-b border-gray-300 last:border-none pb-1">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-500" />
                <span className={`text-[16px] ${isNow ? "font-bold" : "font-normal"}`}>{name}</span>
              </div>
              <span className={`text-[16px] ${isNow ? "font-bold" : ""}`}>{prayerTime}</span>
            </div>
          );
        })}
      </div>

      {/* Date & Location */}
      <div className="mt-4 text-center text-[14px] leading-tight">
        <p>{new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}</p>
        <p>{location?.cityState || "Unknown Location"}</p>
      </div>
    </div>
  );
};

export default PrayerCard;

 export const formatTo12Hour = (timeStr) => {
    if (!timeStr) return "";

    const convertSingleTime = (time) => {
      const cleanTime = time.trim();
      const [hourStr, minuteStr] = cleanTime.split(":");
      let hours = parseInt(hourStr, 10);

      if (isNaN(hours)) return cleanTime; 

      const ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12 || 12;

      return `${hours}:${minuteStr.slice(0, 2)} ${ampm}`;
    };

    if (timeStr.includes("-")) {
      return timeStr
        .split("-")
        .map((t) => convertSingleTime(t))
        .join(" - ");
    }

    return convertSingleTime(timeStr);
  };
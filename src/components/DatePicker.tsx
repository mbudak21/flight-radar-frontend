import React, { useState, useEffect } from "react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";

import { DemoContainer } from "@mui/x-date-pickers/internals/demo";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

export default function BasicDatePicker() {
  const [value, setValue] = useState<Dayjs | null>(dayjs());

  const emitDateChange = (newValue: Dayjs | null) => {
    const isoDate = newValue ? newValue.format("YYYY-MM-DD") : null;

    window.dispatchEvent(
      new CustomEvent("datechange", {
        detail: { isoDate, raw: newValue },
      }),
    );
  };

  const handleChange = (newValue: Dayjs | null) => {
    setValue(newValue);
    emitDateChange(newValue);
  };

  // 🔥 Listen for "go live" from outside (Slider / index.astro)
  useEffect(() => {
    const handleGoLive = () => {
      const today = dayjs(); // or dayjs().startOf("day") if you only care about the date
      setValue(today);
      emitDateChange(today);
    };

    window.addEventListener("flight-go-live", handleGoLive);
    return () => window.removeEventListener("flight-go-live", handleGoLive);
  }, []);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DemoContainer components={["DatePicker"]}>
        <DatePicker
          label="Flight date"
          value={value}
          onChange={handleChange}
        />
      </DemoContainer>
    </LocalizationProvider>
  );
}

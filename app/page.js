"use client";

import { useState } from "react";

export default function Home() {
  const [screen, setScreen] = useState("home");

  if (screen === "start") {
    return (
      <main>
        <h1>RTM PILOT</h1>
        <p>בחר את סוג הפעולה</p>

        <button onClick={() => setScreen("new")}>
          תהליך חדש
        </button>

        <button onClick={() => setScreen("sos")}>
          SOS
        </button>

        <button onClick={() => setScreen("checkin")}>
          Check-in
        </button>

        <button onClick={() => setScreen("home")}>
          חזרה
        </button>

        {screen === "new" && <p>תהליך חדש — המודול מוכן לחיבור.</p>}
        {screen === "sos" && <p>SOS — המודול מוכן לחיבור.</p>}
        {screen === "checkin" && <p>Check-in — המודול מוכן לחיבור.</p>}
      </main>
    );
  }

  return (
    <main>
      <h1>RTM PILOT</h1>
      <p>מערכת ההפעלה שלך לתהליך שינוי</p>

      <button onClick={() => setScreen("start")}>
        התחל
      </button>
    </main>
  );
        }

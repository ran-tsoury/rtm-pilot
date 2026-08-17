"use client";

import { useState } from "react";

export default function Home() {
  const [screen, setScreen] = useState("home");

  if (screen === "home") {
    return (
      <main dir="rtl">
        <h1>RTM PILOT</h1>
        <p>מערכת ההפעלה שלך לתהליך שינוי</p>

        <button onClick={() => setScreen("start")}>
          התחל
        </button>
      </main>
    );
  }

  if (screen === "start") {
    return (
      <main dir="rtl">
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
      </main>
    );
  }

  if (screen === "new") {
    return (
      <main dir="rtl">
        <h1>פעולת המציאות הראשונה</h1>

        <p>
          בפעם הבאה שאתה מזהה רגע דומה, אל תנסה עדיין "לנצח" אותו.
          רק עצור לעשר שניות ותן לרגע שם קצר:
        </p>

        <h2>מה קורה עכשיו?</h2>

        <p>
          זה הכול. אם אחר כך תפעל אחרת — מצוין.
          אם לא — עדיין אספנו מידע אמיתי.
        </p>

        <button onClick={() => setScreen("start")}>
          חזרה
        </button>
      </main>
    );
  }

  if (screen === "sos") {
    return (
      <main dir="rtl">
        <h1>SOS</h1>
        <p>המודול מוכן לחיבור.</p>

        <button onClick={() => setScreen("start")}>
          חזרה
        </button>
      </main>
    );
  }

  if (screen === "checkin") {
    return (
      <main dir="rtl">
        <h1>Check-in</h1>
        <p>המודול מוכן לחיבור.</p>

        <button onClick={() => setScreen("start")}>
          חזרה
        </button>
      </main>
    );
  }

  return null;
}

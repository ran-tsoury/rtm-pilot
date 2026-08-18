"use client";

import { useState } from "react";

export default function Home() {
  const [screen, setScreen] = useState("home");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendToRTM() {
    if (!message.trim()) return;

    setLoading(true);
    setReply("");

    try {
      const response = await fetch("/api/rtm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setReply(data.error || "אירעה שגיאה.");
        return;
      }

      setReply(
        data.reply ||
          data.message ||
          "המערכת קיבלה את ההודעה."
      );
    } catch (error) {
      setReply("לא ניתן כרגע להתחבר למערכת.");
    } finally {
      setLoading(false);
    }
  }

  if (screen !== "home") {
    return (
      <main
        dir="rtl"
        style={{
          maxWidth: "800px",
          margin: "40px auto",
          padding: "24px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1>
          {screen === "new" && "תהליך חדש"}
          {screen === "sos" && "SOS"}
          {screen === "checkin" && "Check-in"}
        </h1>

        <p>כתוב כאן מה קורה עכשיו.</p>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="כתוב כאן..."
          rows={7}
          style={{
            width: "100%",
            fontSize: "18px",
            padding: "12px",
            boxSizing: "border-box",
          }}
        />

        <div style={{ marginTop: "15px" }}>
          <button
            onClick={sendToRTM}
            disabled={loading}
            style={{
              fontSize: "18px",
              padding: "10px 20px",
              marginLeft: "10px",
            }}
          >
            {loading ? "חושב..." : "שלח"}
          </button>

          <button
            onClick={() => {
              setScreen("home");
              setMessage("");
              setReply("");
            }}
            style={{
              fontSize: "18px",
              padding: "10px 20px",
            }}
          >
            חזרה
          </button>
        </div>

        {reply && (
          <div
            style={{
              marginTop: "30px",
              padding: "20px",
              border: "1px solid #ccc",
              borderRadius: "8px",
              whiteSpace: "pre-wrap",
              fontSize: "18px",
              lineHeight: "1.6",
            }}
          >
            {reply}
          </div>
        )}
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: "800px",
        margin: "40px auto",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <h1>RTM PILOT</h1>

      <p style={{ fontSize: "20px" }}>בחר את סוג הפעולה</p>

      <button
        onClick={() => setScreen("new")}
        style={{ margin: "5px", fontSize: "18px" }}
      >
        תהליך חדש
      </button>

      <button
        onClick={() => setScreen("sos")}
        style={{ margin: "5px", fontSize: "18px" }}
      >
        SOS
      </button>

      <button
        onClick={() => setScreen("checkin")}
        style={{ margin: "5px", fontSize: "18px" }}
      >
        Check-in
      </button>
    </main>
  );
        }

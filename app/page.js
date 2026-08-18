"use client";

import { useState } from "react";

export default function Home() {
  const [screen, setScreen] = useState("home");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  async function sendToRTM() {
    const trimmed = message.trim();

    if (!trimmed || loading) return;

    const newUserMessage = {
      role: "user",
      content: trimmed,
    };

    const conversation = [...messages, newUserMessage];

    setMessages(conversation);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/rtm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: conversation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessages([
          ...conversation,
          {
            role: "assistant",
            content: data?.error || "אירעה שגיאה.",
          },
        ]);
        return;
      }

      const reply =
        data?.reply ||
        data?.response ||
        "לא התקבלה תשובה.";

      setMessages([
        ...conversation,
        {
          role: "assistant",
          content: reply,
        },
      ]);
    } catch (error) {
      setMessages([
        ...conversation,
        {
          role: "assistant",
          content: "לא ניתן כרגע להתחבר למערכת.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function resetConversation() {
    setMessages([]);
    setMessage("");
    setScreen("home");
  }

  if (screen === "home") {
    return (
      <main
        dir="rtl"
        style={{
          maxWidth: "900px",
          margin: "40px auto",
          padding: "24px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1>RTM PILOT</h1>

        <p style={{ fontSize: "20px" }}>
          בחר את סוג הפעולה
        </p>

        <button
          onClick={() => setScreen("new")}
          style={{
            margin: "5px",
            fontSize: "18px",
            padding: "10px 18px",
          }}
        >
          תהליך חדש
        </button>

        <button
          onClick={() => setScreen("sos")}
          style={{
            margin: "5px",
            fontSize: "18px",
            padding: "10px 18px",
          }}
        >
          SOS
        </button>

        <button
          onClick={() => setScreen("checkin")}
          style={{
            margin: "5px",
            fontSize: "18px",
            padding: "10px 18px",
          }}
        >
          Check-in
        </button>
      </main>
    );
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={resetConversation}
          style={{
            fontSize: "16px",
            padding: "8px 14px",
          }}
        >
          חזרה
        </button>
      </div>

      <h1>
        {screen === "new" && "תהליך חדש"}
        {screen === "sos" && "SOS"}
        {screen === "checkin" && "Check-in"}
      </h1>

      <div
        style={{
          flex: 1,
          marginTop: "20px",
          marginBottom: "20px",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              padding: "20px",
              border: "1px solid #ddd",
              borderRadius: "12px",
            }}
          >
            כתוב מה קורה עכשיו.
          </div>
        )}

        {messages.map((item, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              justifyContent:
                item.role === "user"
                  ? "flex-start"
                  : "flex-end",
              marginBottom: "14px",
            }}
          >
            <div
              style={{
                maxWidth: "75%",
                padding: "14px 18px",
                borderRadius: "16px",
                border: "1px solid #ccc",
                whiteSpace: "pre-wrap",
                fontSize: "18px",
                lineHeight: "1.6",
              }}
            >
              {item.content}
            </div>
          </div>
        ))}

        {loading && (
          <div
            style={{
              padding: "14px 18px",
              border: "1px solid #ccc",
              borderRadius: "16px",
              display: "inline-block",
            }}
          >
            חושב...
          </div>
        )}
      </div>

      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: "white",
          paddingTop: "12px",
          paddingBottom: "12px",
          borderTop: "1px solid #ddd",
        }}
      >
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="כתוב כאן..."
          rows={3}
          style={{
            width: "100%",
            fontSize: "18px",
            padding: "12px",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />

        <button
          onClick={sendToRTM}
          disabled={loading}
          style={{
            marginTop: "10px",
            fontSize: "18px",
            padding: "10px 22px",
          }}
        >
          {loading ? "חושב..." : "שלח"}
        </button>
      </div>
    </main>
  );
}

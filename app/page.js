"use client";

import { useState } from "react";

export default function Home() {
  const [screen, setScreen] = useState("home");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  function startProcess(type) {
    setScreen(type);
    setMessage("");
    setMessages([]);
  }

  function goHome() {
    setScreen("home");
    setMessage("");
    setMessages([]);
    setLoading(false);
  }

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
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content:
              data?.error ||
              "אירעה שגיאה בחיבור למערכת.",
          },
        ]);

        return;
      }

      const reply =
        data?.reply ||
        data?.response ||
        "לא התקבלה תשובה מהמערכת.";

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: reply,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: "לא ניתן כרגע להתחבר למערכת.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendToRTM();
    }
  }

  if (screen === "home") {
    return (
      <main
        dir="rtl"
        style={{
          maxWidth: "900px",
          margin: "60px auto",
          padding: "24px",
          fontFamily: "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontSize: "38px",
            marginBottom: "12px",
          }}
        >
          RTM PILOT
        </h1>

        <p
          style={{
            fontSize: "20px",
            marginBottom: "30px",
          }}
        >
          בחר את סוג הפעולה
        </p>

        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => startProcess("new")}
            style={buttonStyle}
          >
            תהליך חדש
          </button>

          <button
            onClick={() => startProcess("sos")}
            style={buttonStyle}
          >
            SOS
          </button>

          <button
            onClick={() => startProcess("checkin")}
            style={buttonStyle}
          >
            Check-in
          </button>
        </div>
      </main>
    );
  }

  const title =
    screen === "new"
      ? "תהליך חדש"
      : screen === "sos"
      ? "SOS"
      : "Check-in";

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: "900px",
        minHeight: "100vh",
        margin: "0 auto",
        padding: "24px",
        fontFamily: "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          marginBottom: "20px",
        }}
      >
        <button
          onClick={goHome}
          style={buttonStyle}
        >
          חזרה
        </button>
      </div>

      <h1
        style={{
          fontSize: "38px",
          marginBottom: "30px",
        }}
      >
        {title}
      </h1>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          paddingBottom: "30px",
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: "16px",
              padding: "22px",
              fontSize: "20px",
              lineHeight: "1.6",
            }}
          >
            כתוב כאן מה קורה עכשיו.
          </div>
        )}

        {messages.map((item, index) => (
          <div
            key={index}
            style={{
              alignSelf:
                item.role === "user"
                  ? "flex-start"
                  : "flex-end",
              maxWidth: "80%",
              border: "1px solid #ddd",
              borderRadius: "18px",
              padding: "16px 20px",
              fontSize: "18px",
              lineHeight: "1.6",
              whiteSpace: "pre-wrap",
              background:
                item.role === "user"
                  ? "#f7f7f7"
                  : "#ffffff",
            }}
          >
            {item.content}
          </div>
        ))}

        {loading && (
          <div
            style={{
              alignSelf: "flex-end",
              border: "1px solid #ddd",
              borderRadius: "18px",
              padding: "16px 20px",
              fontSize: "18px",
            }}
          >
            חושב...
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: "1px solid #ddd",
          paddingTop: "18px",
          position: "sticky",
          bottom: 0,
          background: "white",
        }}
      >
        <textarea
          value={message}
          onChange={(event) =>
            setMessage(event.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder="כתוב כאן..."
          rows={4}
          style={{
            width: "100%",
            boxSizing: "border-box",
            fontSize: "18px",
            padding: "14px",
            resize: "vertical",
            fontFamily: "Arial, sans-serif",
          }}
        />

        <div
          style={{
            marginTop: "12px",
          }}
        >
          <button
            onClick={sendToRTM}
            disabled={loading || !message.trim()}
            style={{
              ...buttonStyle,
              opacity:
                loading || !message.trim()
                  ? 0.5
                  : 1,
            }}
          >
            {loading ? "שולח..." : "שלח"}
          </button>
        </div>
      </div>
    </main>
  );
}

const buttonStyle = {
  fontSize: "18px",
  padding: "10px 20px",
  cursor: "pointer",
};

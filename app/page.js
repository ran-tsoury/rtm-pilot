"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function Home() {
  const supabase = useMemo(() => {
    const url =
      process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return null;
    }

    return createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }, []);

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] =
    useState(false);
  const [authError, setAuthError] =
    useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [screen, setScreen] =
    useState("home");
  const [message, setMessage] =
    useState("");
  const [messages, setMessages] =
    useState([]);
  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;

        setSession(
          data?.session ?? null
        );
        setAuthReady(true);
      });

    const {
      data: subscription,
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (!active) return;

          setSession(
            nextSession ?? null
          );
          setAuthReady(true);
        }
      );

    return () => {
      active = false;

      subscription?.subscription?.unsubscribe();
    };
  }, [supabase]);

  async function signIn() {
    if (
      !supabase ||
      authLoading
    ) {
      return;
    }

    const normalizedEmail =
      email.trim();

    if (
      !normalizedEmail ||
      !password
    ) {
      setAuthError(
        "יש להזין אימייל וסיסמה."
      );
      return;
    }

    setAuthLoading(true);
    setAuthError("");

    const {
      data,
      error,
    } =
      await supabase.auth
        .signInWithPassword({
          email: normalizedEmail,
          password,
        });

    if (error) {
      setAuthError(
        error.message ||
          "ההתחברות נכשלה."
      );
      setAuthLoading(false);
      return;
    }

    setSession(
      data?.session ?? null
    );
    setPassword("");
    setAuthLoading(false);
  }

  async function signOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();

    setSession(null);
    setScreen("home");
    setMessage("");
    setMessages([]);
    setLoading(false);
  }

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
    const trimmed =
      message.trim();

    if (
      !trimmed ||
      loading
    ) {
      return;
    }

    const accessToken =
      session?.access_token;

    if (!accessToken) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            "נדרש משתמש מאומת.",
        },
      ]);
      return;
    }

    const newUserMessage = {
      role: "user",
      content: trimmed,
    };

    const conversation = [
      ...messages,
      newUserMessage,
    ];

    setMessages(conversation);
    setMessage("");
    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/rtm",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${accessToken}`,
            },

            body: JSON.stringify({
              processType: screen,
              messages:
                conversation,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessages(
          (current) => [
            ...current,
            {
              role: "assistant",
              content:
                data?.error ||
                "אירעה שגיאה בחיבור למערכת.",
            },
          ]
        );

        return;
      }

      const reply =
        data?.reply ||
        data?.response ||
        "לא התקבלה תשובה מהמערכת.";

      setMessages(
        (current) => [
          ...current,
          {
            role: "assistant",
            content: reply,
          },
        ]
      );
    } catch {
      setMessages(
        (current) => [
          ...current,
          {
            role: "assistant",
            content:
              "לא ניתן כרגע להתחבר למערכת.",
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(
    event
  ) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();
      sendToRTM();
    }
  }

  if (!authReady) {
    return (
      <main style={centerStyle}>
        טוען...
      </main>
    );
  }

  if (!supabase) {
    return (
      <main
        dir="rtl"
        style={centerStyle}
      >
        <h1>RTM PILOT</h1>

        <p>
          חסרה הגדרת Supabase
          בדפדפן.
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main
        dir="rtl"
        style={centerStyle}
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
            marginBottom: "24px",
          }}
        >
          התחברות למשתמש בדיקה
        </p>

        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(
                event.target.value
              )
            }
            placeholder="Email"
            autoComplete="username"
            style={inputStyle}
          />

          <input
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value
              )
            }
            placeholder="Password"
            autoComplete="current-password"
            style={inputStyle}
          />

          <button
            onClick={signIn}
            disabled={authLoading}
            style={buttonStyle}
          >
            {authLoading
              ? "מתחבר..."
              : "התחבר"}
          </button>

          {authError && (
            <div
              style={{
                marginTop: "10px",
                fontSize: "16px",
              }}
            >
              {authError}
            </div>
          )}
        </div>
      </main>
    );
  }

  if (screen === "home") {
    return (
      <main
        dir="rtl"
        style={{
          maxWidth: "900px",
          margin: "60px auto",
          padding: "24px",
          fontFamily:
            "Arial, sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-start",
            marginBottom: "20px",
          }}
        >
          <button
            onClick={signOut}
            style={buttonStyle}
          >
            התנתק
          </button>
        </div>

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
            justifyContent:
              "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() =>
              startProcess("new")
            }
            style={buttonStyle}
          >
            תהליך חדש
          </button>

          <button
            onClick={() =>
              startProcess("sos")
            }
            style={buttonStyle}
          >
            SOS
          </button>

          <button
            onClick={() =>
              startProcess(
                "checkin"
              )
            }
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
        fontFamily:
          "Arial, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          gap: "12px",
        }}
      >
        <button
          onClick={goHome}
          style={buttonStyle}
        >
          חזרה
        </button>

        <button
          onClick={signOut}
          style={buttonStyle}
        >
          התנתק
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
              border:
                "1px solid #ddd",
              borderRadius: "16px",
              padding: "22px",
              fontSize: "20px",
              lineHeight: "1.6",
            }}
          >
            כתוב כאן מה קורה עכשיו.
          </div>
        )}

        {messages.map(
          (item, index) => (
            <div
              key={index}
              style={{
                alignSelf:
                  item.role ===
                  "user"
                    ? "flex-start"
                    : "flex-end",

                maxWidth: "80%",

                border:
                  "1px solid #ddd",

                borderRadius:
                  "18px",

                padding:
                  "16px 20px",

                fontSize: "18px",
                lineHeight: "1.6",

                whiteSpace:
                  "pre-wrap",

                background:
                  item.role ===
                  "user"
                    ? "#f7f7f7"
                    : "#ffffff",
              }}
            >
              {item.content}
            </div>
          )
        )}

        {loading && (
          <div
            style={{
              alignSelf:
                "flex-end",

              border:
                "1px solid #ddd",

              borderRadius:
                "18px",

              padding:
                "16px 20px",

              fontSize: "18px",
            }}
          >
            חושב...
          </div>
        )}
      </div>

      <div
        style={{
          borderTop:
            "1px solid #ddd",

          paddingTop: "18px",

          position: "sticky",
          bottom: 0,
          background: "white",
        }}
      >
        <textarea
          value={message}
          onChange={(event) =>
            setMessage(
              event.target.value
            )
          }
          onKeyDown={
            handleKeyDown
          }
          placeholder="כתוב כאן..."
          rows={4}
          style={{
            width: "100%",
            boxSizing:
              "border-box",

            fontSize: "18px",
            padding: "14px",
            resize: "vertical",

            fontFamily:
              "Arial, sans-serif",
          }}
        />

        <div
          style={{
            marginTop: "12px",
          }}
        >
          <button
            onClick={sendToRTM}
            disabled={
              loading ||
              !message.trim()
            }
            style={{
              ...buttonStyle,

              opacity:
                loading ||
                !message.trim()
                  ? 0.5
                  : 1,
            }}
          >
            {loading
              ? "שולח..."
              : "שלח"}
          </button>
        </div>
      </div>
    </main>
  );
}

const centerStyle = {
  maxWidth: "900px",
  minHeight: "70vh",
  margin: "0 auto",
  padding: "24px",
  fontFamily: "Arial, sans-serif",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  fontSize: "18px",
  padding: "12px 14px",
};

const buttonStyle = {
  fontSize: "18px",
  padding: "10px 20px",
  cursor: "pointer",
};
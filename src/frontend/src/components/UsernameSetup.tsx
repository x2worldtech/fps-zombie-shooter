import { useState } from "react";
import { useSetUsername } from "../hooks/useUsername";

interface UsernameSetupProps {
  onComplete: () => void;
}

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,20}$/;

export function UsernameSetup({ onComplete }: UsernameSetupProps) {
  const [value, setValue] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const setUsername = useSetUsername();

  const isValid = USERNAME_REGEX.test(value);
  const isDirty = value.length > 0;

  const handleSubmit = async () => {
    if (!isValid) return;
    setErrorMsg(null);
    try {
      await setUsername.mutateAsync(value.trim());
      onComplete();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Failed to set username. Try again.",
      );
    }
  };

  return (
    <div
      data-ocid="username_setup.dialog"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(255,122,0,0.12) 0%, #060606 55%)",
      }}
    >
      {/* Scan-line overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)",
        }}
      />

      <div
        className="relative z-10 flex flex-col items-center gap-5 px-8 py-10 w-full max-w-sm mx-4"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,122,0,0.25)",
          boxShadow:
            "0 4px 60px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Title */}
        <div
          style={{
            fontFamily: "'Oswald', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#ffffff",
            textShadow:
              "0 0 30px rgba(255,122,0,0.4), 0 2px 8px rgba(0,0,0,0.8)",
            lineHeight: 1,
            textAlign: "center",
          }}
        >
          SET YOUR USERNAME
        </div>

        {/* Divider */}
        <div
          style={{
            width: "100%",
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, rgba(255,122,0,0.4), transparent)",
          }}
        />

        {/* Subtitle */}
        <p
          style={{
            fontFamily: "'Sora', system-ui, sans-serif",
            fontSize: "0.78rem",
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.05em",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          This name will be shown on the leaderboard.
          <br />
          <span style={{ color: "rgba(255,122,0,0.7)" }}>
            Choose carefully — it cannot be changed.
          </span>
        </p>

        {/* Input */}
        <div className="w-full flex flex-col gap-1">
          <input
            data-ocid="username_setup.input"
            type="text"
            maxLength={20}
            placeholder="3–20 chars, letters, numbers, - _"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setErrorMsg(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && isValid && handleSubmit()}
            className="w-full px-3 py-2 outline-none"
            style={{
              fontFamily: "'Sora', system-ui, sans-serif",
              fontSize: "1rem",
              letterSpacing: "0.04em",
              background: "rgba(255,255,255,0.05)",
              border: isDirty
                ? isValid
                  ? "1px solid rgba(40,200,80,0.7)"
                  : "1px solid rgba(220,50,50,0.7)"
                : "1px solid rgba(255,122,0,0.35)",
              color: "rgba(255,255,255,0.9)",
              transition: "border-color 0.15s ease",
            }}
          />
          {isDirty && !isValid && (
            <span
              data-ocid="username_setup.field_error"
              style={{
                fontFamily: "'Sora', system-ui, sans-serif",
                fontSize: "0.7rem",
                color: "#ff5555",
                letterSpacing: "0.03em",
              }}
            >
              3–20 characters, letters, numbers, dash and underscore only
            </span>
          )}
        </div>

        {/* Backend error */}
        {errorMsg && (
          <div
            data-ocid="username_setup.error_state"
            className="w-full px-3 py-2"
            style={{
              background: "rgba(80,0,0,0.15)",
              border: "1px solid rgba(200,30,30,0.35)",
            }}
          >
            <span
              style={{
                fontFamily: "'Sora', system-ui, sans-serif",
                fontSize: "0.78rem",
                color: "#ff5555",
              }}
            >
              ✗ {errorMsg}
            </span>
          </div>
        )}

        {/* Confirm button */}
        <button
          type="button"
          data-ocid="username_setup.confirm_button"
          onClick={handleSubmit}
          disabled={!isValid || setUsername.isPending}
          className="cod-premium-btn w-full"
          style={{
            opacity: !isValid || setUsername.isPending ? 0.4 : 1,
            cursor:
              !isValid || setUsername.isPending ? "not-allowed" : "pointer",
          }}
        >
          {setUsername.isPending ? "CONFIRMING..." : "CONFIRM"}
        </button>
      </div>
    </div>
  );
}

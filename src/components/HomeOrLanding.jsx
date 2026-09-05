import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Home from "@/pages/Home";
import Start from "@/pages/Start";

// The public entry to the app: signed-in users land on their notes,
// and first-time visitors get the "What notes can do" page instead
// of a sign-in wall.
export default function HomeOrLanding() {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    base44.auth
      .isAuthenticated()
      .then(setAuthed)
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--paper)" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "rgba(60,45,25,.5)" }} />
      </div>
    );
  }

  return authed ? <Home /> : <Start />;
}
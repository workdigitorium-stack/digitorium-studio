"use client";
/* Session, membership and toasts for every screen.

   status: "loading" | "signed-out" | "no-access" | "ready"
   member: the signed-in user's row in studio_members (email, role, name) */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const Ctx = createContext(null);

export function useStudio() {
  return useContext(Ctx);
}

export default function StudioProvider({ children }) {
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [status, setStatus] = useState("loading");
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const toast = useCallback((text, opts = {}) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { id, text, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.ms || 4200);
  }, []);

  const loadMember = useCallback(async (s) => {
    if (!s) {
      setMember(null);
      setStatus("signed-out");
      return;
    }
    const email = (s.user.email || "").toLowerCase();
    const { data, error } = await supabase().from("studio_members").select("*").eq("email", email).maybeSingle();
    if (error || !data) {
      setMember(null);
      setStatus("no-access");
      return;
    }
    setMember(data);
    setStatus("ready");
    supabase().rpc("studio_touch").then(() => {}, () => {});
  }, []);

  useEffect(() => {
    const db = supabase();
    let alive = true;
    db.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      loadMember(data.session);
    });
    const { data: sub } = db.auth.onAuthStateChange((event, s) => {
      setSession(s);
      /* token refreshes keep the same person; only re-check on a real change */
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setTimeout(() => loadMember(s), 0);
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadMember]);

  const signOut = useCallback(async () => {
    await supabase().auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      member,
      role: member?.role || null,
      email: session?.user?.email?.toLowerCase() || null,
      status,
      toast,
      signOut,
      refreshMember: () => loadMember(session),
    }),
    [session, member, status, toast, signOut, loadMember],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={"toast" + (t.bad ? " bad" : "")}>
            <span>{t.text}</span>
            {t.href ? <a href={t.href}>{t.action || "Open"}</a> : null}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

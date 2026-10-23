"use client";
/* Session, membership and toasts for every screen.

   status: "loading" | "signed-out" | "no-access" | "ready"
   member: the signed-in user's row in studio_members (email, role, name),
           or in client_members for a client login (role "client", client)
   hostClient: the client whose portal address this is (e.g. cms.diptienterprise.com) */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CLIENTS, clientForHost } from "@/lib/clients";

const Ctx = createContext(null);

export function useStudio() {
  return useContext(Ctx);
}

export default function StudioProvider({ children }) {
  const [session, setSession] = useState(null);
  const [member, setMember] = useState(null);
  const [status, setStatus] = useState("loading");
  const [toasts, setToasts] = useState([]);
  const [hostClient, setHostClient] = useState(null);
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
    const db = supabase();
    const { data } = await db.from("studio_members").select("*").eq("email", email).maybeSingle();
    if (data) {
      setMember(data);
      setStatus("ready");
      db.rpc("studio_touch").then(() => {}, () => {});
      return;
    }
    /* not agency staff: maybe a client login, limited to their own site */
    const { data: cm } = await db.from("client_members").select("*").eq("email", email).maybeSingle();
    if (cm && CLIENTS[cm.client]) {
      setMember({ ...cm, role: "client" });
      setStatus("ready");
      db.rpc("client_touch").then(() => {}, () => {});
      return;
    }
    setMember(null);
    setStatus("no-access");
  }, []);

  /* a client portal address wears that client's colours */
  useEffect(() => {
    const c = clientForHost(window.location.hostname);
    setHostClient(c);
  }, []);
  const brandClient = member?.role === "client" ? member.client : hostClient;
  useEffect(() => {
    const a = brandClient && CLIENTS[brandClient]?.accent;
    const st = document.documentElement.style;
    if (a) {
      st.setProperty("--o", a.o);
      st.setProperty("--o-soft", a.soft);
      st.setProperty("--o-deep", a.deep);
      st.setProperty("--grad", "linear-gradient(135deg, " + a.soft + " 0%, " + a.o + " 100%)");
    } else ["--o", "--o-soft", "--o-deep", "--grad"].forEach((k) => st.removeProperty(k));
  }, [brandClient]);

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
      client: member?.role === "client" ? member.client : null,
      hostClient,
      brandClient,
      email: session?.user?.email?.toLowerCase() || null,
      status,
      toast,
      signOut,
      refreshMember: () => loadMember(session),
    }),
    [session, member, status, toast, signOut, loadMember, hostClient, brandClient],
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

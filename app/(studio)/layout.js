"use client";
/* The signed-in frame around every Studio screen: sidebar on desktop, a
   top bar with back and the menu everywhere, and a bottom tab bar on a
   phone or tablet that tucks away while you scroll down. It also listens for new leads while the Studio is
   open, shows a toast (and a system notification if allowed), and tells
   any open screen through a "studio:lead" window event. */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import AppMenu from "@/components/AppMenu";
import useScrollMemory, { canGoBack } from "@/components/useScrollMemory";
import { supabase, SITE_URL } from "@/lib/supabase";
import { can, canEditClient, ROLE_INFO } from "@/lib/roles";
import { CLIENTS } from "@/lib/clients";
import { NAV, CLIENT_NAV, TAB_ORDER, isOn as onPath, screenFor, parentOf } from "@/lib/nav";

/* Later phases of the plan, shown so the team knows what is coming. */
const SOON = [];

function Brand({ info }) {
  return (
    <Link href={info ? info.home : "/"} className="brand">
      {info ? (
        <>
          <img src={info.logo} alt={info.name} style={{ width: "auto", height: 28, borderRadius: 0 }} />
          <span className="pill">CMS</span>
        </>
      ) : (
        <>
          <img src="/icon-192.png" alt="" />
          <span>Studio</span>
        </>
      )}
    </Link>
  );
}

export default function StudioLayout({ children }) {
  const { status, role, member, email, signOut, toast, client, brandClient } = useStudio();
  const router = useRouter();
  const path = usePathname();
  const [newCount, setNewCount] = useState(0);
  const [menu, setMenu] = useState(false);
  const [tucked, setTucked] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  useScrollMemory(path);

  /* the bottom bar slides away while scrolling down a long screen, back on the way up */
  const lastY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY.current;
      if (Math.abs(dy) < 6) return;
      setTucked(dy > 0 && y > 120);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    setTucked(false);
    setMenu(false);
  }, [path]);

  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
  }, [status, router]);

  /* a client login stays on its own screens (the database would show it nothing elsewhere anyway) */
  useEffect(() => {
    if (status !== "ready" || role !== "client") return;
    const own = (CLIENT_NAV[client] || []).some((n) => path === n.href || path.startsWith(n.href + "/"));
    if (!own && path !== "/account") router.replace(CLIENTS[client]?.home || "/account");
  }, [status, role, client, path, router]);

  const refreshCount = useCallback(async () => {
    if (!can(role, "leads.read")) return;
    const db = supabase();
    const [a, b] = await Promise.all([
      db.from("leads").select("id", { count: "exact", head: true }).eq("status", "new"),
      db.from("client_questionnaires").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);
    setNewCount((a.count || 0) + (b.count || 0));
  }, [role]);

  useEffect(() => {
    if (status !== "ready" || !can(role, "leads.read")) return;
    refreshCount();
    const onChange = () => refreshCount();
    window.addEventListener("studio:leads-changed", onChange);

    const db = supabase();
    const channel = db
      .channel("studio-leads")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (p) => announce("lead", p.new))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "client_questionnaires" }, (p) => announce("questionnaire", p.new))
      .subscribe();

    function announce(kind, row) {
      const who = kind === "lead" ? row.name : row.contact_name + " (" + row.business_name + ")";
      const what = kind === "lead" ? "New lead" : "New discovery form";
      toast(what + ": " + who, { href: "/leads?open=" + kind + ":" + row.id, action: "View", ms: 8000 });
      try {
        if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
          new Notification(what, { body: who, icon: "/icon-192.png", tag: kind + row.id });
        }
      } catch (e) {
        /* some browsers only allow notifications from the service worker */
      }
      window.dispatchEvent(new CustomEvent("studio:lead", { detail: { kind, row } }));
      refreshCount();
    }

    return () => {
      window.removeEventListener("studio:leads-changed", onChange);
      db.removeChannel(channel);
    };
  }, [status, role, refreshCount, toast]);

  if (status === "loading" || status === "signed-out") {
    return (
      <div className="splash">
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (status === "no-access") {
    return (
      <main className="auth">
        <div className="authcard">
          <div className="authbox">
            <h1>No access yet</h1>
            <p className="muted">
              You are signed in as <b>{email}</b>, but this email has no access yet. Ask {brandClient ? "Digitorium" : "the owner"} to invite this exact address.
            </p>
            <button className="btn" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  const clientNav = Object.keys(CLIENT_NAV)
    .filter((k) => canEditClient(role, client, k))
    .map((k) => ({ client: k, items: CLIENT_NAV[k] }));
  /* a client login gets only their own screens; on a client's portal staff see that client first */
  const nav =
    role === "client"
      ? clientNav.flatMap((g) => g.items).concat({ href: "/account", label: "Account", icon: "account" })
      : NAV.filter((n) => !n.need || can(role, n.need));
  const groups = role === "client" ? [] : clientNav;
  const isOn = (href) => onPath(path, href);
  const tabSource =
    role === "client" || (brandClient && groups.length)
      ? (role === "client" ? nav : groups.find((g) => g.client === brandClient)?.items || nav).filter(
          (n) => n.href !== "/account" && n.href !== "/dipti/categories" && n.href !== "/dipti/reviews",
        )
      : TAB_ORDER.map((h) => nav.find((n) => n.href === h)).filter(Boolean);
  const tabs = tabSource.slice(0, 4).map((n) => ({ ...n, label: n.href === "/" ? "Home" : n.label }));
  const screen = screenFor(path);
  const home = brandClient && CLIENTS[brandClient] ? CLIENTS[brandClient].home : "/";
  const showBack = path !== home;
  const goBack = () => (canGoBack() ? router.back() : router.push(screen.top ? home : parentOf(path)));
  const brandInfo = brandClient ? CLIENTS[brandClient] : null;
  const viewSite = brandInfo ? brandInfo.site : SITE_URL;

  return (
    <div className="shell">
      <aside className="side">
        <Brand info={brandInfo} />
        <nav className="nav" aria-label="Studio">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={isOn(n.href) ? "on" : ""}>
              <Icon name={n.icon} />
              {n.label}
              {n.href === "/leads" && newCount > 0 ? <span className="badge">{newCount}</span> : null}
            </Link>
          ))}
          {groups.map((g) => (
            <div key={g.client} style={{ display: "contents" }}>
              <div className="navlabel">{CLIENTS[g.client].name}</div>
              {g.items.map((n) => (
                <Link key={n.href} href={n.href} className={isOn(n.href) ? "on" : ""}>
                  <Icon name={n.icon} />
                  {n.label}
                </Link>
              ))}
            </div>
          ))}
          {SOON.length ? <div className="navlabel">Coming next</div> : null}
          {SOON.map((n) => (
            <span key={n.label} className="navitem" title="Planned for a later phase">
              <Icon name={n.icon} />
              {n.label}
              <span className="pill pill--soon">Soon</span>
            </span>
          ))}
        </nav>
        <div className="me">
          <Link href="/account">{member?.name || email}</Link>
          <span className="muted tiny">{ROLE_INFO[role]?.label}</span>
        </div>
      </aside>

      <div className="col">
        <header className="topbar">
          {showBack ? (
            <button className="btn btn--icon btn--ghost" aria-label="Back" onClick={goBack}>
              <Icon name="back" />
            </button>
          ) : (
            <span className="topbar__brand">
              <Brand info={brandInfo} />
            </span>
          )}
          <h1 className={"topbar__title" + (showBack ? "" : " topbar__title--desk")}>{screen.title}</h1>
          <div className="topbar__end">
            <a href={viewSite} target="_blank" rel="noreferrer" className="btn btn--sm topbar__site">
              View site <Icon name="external" />
            </a>
            <button className="btn btn--icon btn--ghost" aria-label="Open menu" aria-expanded={menu} onClick={() => setMenu(true)}>
              <Icon name="menu" />
              {newCount > 0 && can(role, "leads.read") ? <span className="dot" /> : null}
            </button>
          </div>
        </header>

        <main className="main">{children}</main>
      </div>

      <nav className={"tabs" + (tucked && !menu ? " tucked" : "")} aria-label="Studio" style={{ gridTemplateColumns: "repeat(" + (tabs.length + 1) + ", 1fr)" }}>
        {tabs.map((n) => (
          <Link key={n.href} href={n.href} className={"tab" + (isOn(n.href) ? " on" : "")} aria-current={isOn(n.href) ? "page" : undefined} title={n.label}>
            <Icon name={n.icon} solid={isOn(n.href)} />
            <span className="sr">{n.label}</span>
            {n.href === "/leads" && newCount > 0 ? <span className="badge">{newCount > 9 ? "9+" : newCount}</span> : null}
          </Link>
        ))}
        <button className={"tab" + (menu ? " on" : "")} onClick={() => setMenu(true)} aria-label="Menu" aria-expanded={menu} title="Menu">
          <Icon name="menu" solid={menu} />
        </button>
      </nav>

      <AppMenu open={menu} onClose={closeMenu} path={path} nav={nav} groups={groups} newCount={can(role, "leads.read") ? newCount : 0} viewSite={viewSite} />
    </div>
  );
}

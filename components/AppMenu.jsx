"use client";
/* The menu behind the hamburger: who is signed in, quick actions, and every
   screen grouped with a line on what it is for. A drawer on a phone, a
   wide panel on a tablet or desktop. Closes on Escape, a tap outside, or
   when a link is followed. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { useStudio } from "@/components/StudioProvider";
import { can, ROLE_INFO } from "@/lib/roles";
import { CLIENTS } from "@/lib/clients";
import { isOn } from "@/lib/nav";
import { createPost } from "@/lib/posts";

export default function AppMenu({ open, onClose, path, nav, groups, newCount, viewSite }) {
  const { role, member, email, signOut, toast } = useStudio();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    const html = document.documentElement;
    html.classList.add("is-locked");
    return () => {
      window.removeEventListener("keydown", esc);
      html.classList.remove("is-locked");
    };
  }, [open, onClose]);

  if (!open) return null;

  async function newPost() {
    setBusy(true);
    try {
      const id = await createPost();
      onClose();
      router.push("/posts/" + id);
    } catch (e) {
      toast("Could not start a post: " + e.message, { bad: true });
    } finally {
      setBusy(false);
    }
  }

  const quick = [
    can(role, "content.edit") && role !== "client" && { label: busy ? "Starting…" : "New post", icon: "plus", onClick: newPost, hot: true },
    can(role, "media.upload") && role !== "client" && { label: "Upload", icon: "upload", href: "/media?upload=1" },
    can(role, "leads.read") && { label: "New leads", icon: "inbox", href: "/leads", badge: newCount },
    { label: "View site", icon: "external", href: viewSite, external: true },
  ].filter(Boolean);

  const name = member?.name || email || "";

  return (
    <div className="overlay overlay--menu" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="megamenu" role="dialog" aria-modal="true" aria-label="Menu">
        <div className="megamenu__head">
          <div className="avatar">{name.slice(0, 1).toUpperCase()}</div>
          <div className="grow">
            <b>{name}</b>
            <span className="tiny muted">{ROLE_INFO[role]?.label}</span>
          </div>
          <button className="btn btn--icon" aria-label="Close menu" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>

        {quick.length ? (
          <div className="quick">
            {quick.map((q) =>
              q.href ? (
                <a key={q.label} href={q.href} className={"quick__btn" + (q.hot ? " hot" : "")} target={q.external ? "_blank" : undefined} rel={q.external ? "noreferrer" : undefined} onClick={q.external ? undefined : (e) => (e.preventDefault(), onClose(), router.push(q.href))}>
                  <Icon name={q.icon} />
                  <span>{q.label}</span>
                  {q.badge ? <span className="badge">{q.badge}</span> : null}
                </a>
              ) : (
                <button key={q.label} className={"quick__btn" + (q.hot ? " hot" : "")} onClick={q.onClick} disabled={busy}>
                  <Icon name={q.icon} />
                  <span>{q.label}</span>
                </button>
              ),
            )}
          </div>
        ) : null}

        <MenuGroup title={role === "client" ? "Your website" : "Studio"} items={nav} path={path} onClose={onClose} newCount={newCount} />
        {groups.map((g) => (
          <MenuGroup key={g.client} title={CLIENTS[g.client].name} items={g.items} path={path} onClose={onClose} />
        ))}

        <button className="btn btn--block megamenu__out" onClick={signOut}>
          <Icon name="logout" /> Sign out
        </button>
      </div>
    </div>
  );
}

function MenuGroup({ title, items, path, onClose, newCount }) {
  return (
    <section className="megamenu__group">
      <div className="navlabel">{title}</div>
      <div className="megamenu__grid">
        {items.map((n) => (
          <Link key={n.href} href={n.href} className={"megamenu__item" + (isOn(path, n.href) ? " on" : "")} onClick={onClose}>
            <span className="megamenu__icon">
              <Icon name={n.icon} />
            </span>
            <span className="grow">
              <b>{n.label}</b>
              {n.desc ? <span>{n.desc}</span> : null}
            </span>
            {n.href === "/leads" && newCount > 0 ? <span className="badge">{newCount}</span> : <Icon name="next" className="megamenu__chev" />}
          </Link>
        ))}
      </div>
    </section>
  );
}

"use client";
/* Pages: every page of digitorium.in that can be edited here. Home has its
   own form (lib/content.js DOCS.home); the rest list every text, picture
   and link from the page itself (lib/site-pages). */
import Link from "next/link";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { can } from "@/lib/roles";
import { SITE_PAGES } from "@/lib/content";

const GROUPS = ["Services", "Work", "Company", "Legal"];

export default function Pages() {
  const { role } = useStudio();
  if (!can(role, "content.read")) return <div className="notice">Your role does not include editing the site.</div>;
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Pages</p>
          <h1>Pages</h1>
          <p>Change the words, pictures and links on digitorium.in. Edits save as a draft; Publish puts them live.</p>
        </div>
      </div>
      <section className="card">
        <div className="list">
          <Row href="/pages/home" title="Home" sub="/" icon="home" />
        </div>
      </section>
      {GROUPS.map((g) => (
        <section className="card" key={g}>
          <h2>{g}</h2>
          <div className="list">
            {SITE_PAGES.filter((p) => p.group === g).map((p) => (
              <Row key={p.key} href={"/pages/" + p.key} title={p.title} sub={p.path} icon="pages" />
            ))}
          </div>
        </section>
      ))}
      <p className="small muted">The logo, phone, WhatsApp, email, header menu and footer are under Brand.</p>
    </div>
  );
}

function Row({ href, title, sub, icon }) {
  return (
    <Link href={href} className="row">
      <Icon name={icon} size={18} />
      <div className="grow">
        <div className="title">{title}</div>
        <div className="sub">{sub}</div>
      </div>
      <Icon name="edit" size={16} />
    </Link>
  );
}

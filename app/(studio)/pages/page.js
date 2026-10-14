"use client";
/* Pages: the site's pages that can be edited here. Home is first; the
   others follow in the next releases and show as "Soon". */
import Link from "next/link";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { can } from "@/lib/roles";

const SOON = ["Services (6 pages)", "Work and case studies", "About", "Contact"];

export default function Pages() {
  const { role } = useStudio();
  if (!can(role, "content.read")) return <div className="notice">Your role does not include editing the site.</div>;
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Pages</p>
          <h1>Pages</h1>
          <p>Change the words on digitorium.in. Edits save as a draft; Publish puts them live.</p>
        </div>
      </div>
      <section className="card">
        <div className="list">
          <Link href="/pages/home" className="row">
            <Icon name="home" size={18} />
            <div className="grow">
              <div className="title">Home</div>
              <div className="sub">digitorium.in/</div>
            </div>
            <Icon name="edit" size={16} />
          </Link>
          {SOON.map((s) => (
            <div key={s} className="row">
              <Icon name="pages" size={18} className="muted" />
              <div className="grow">
                <div className="title muted">{s}</div>
              </div>
              <span className="pill pill--soon">Soon</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

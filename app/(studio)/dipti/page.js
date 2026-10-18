"use client";
/* Dipti Enterprise: overview of the website's content, and the way in. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { db, SITE } from "@/lib/dipti";

export default function DiptiHome() {
  const { member, email, role } = useStudio();
  const [n, setN] = useState(null);

  useEffect(() => {
    const count = (t, f) => {
      let q = db().from(t).select("*", { count: "exact", head: true });
      if (f) q = f(q);
      return q.then((r) => r.count ?? 0);
    };
    Promise.all([
      count("de_products"),
      count("de_products", (q) => q.eq("active", false)),
      count("de_products", (q) => q.is("price_inr", null)),
      count("de_gallery"),
      count("de_reviews"),
      count("de_categories"),
    ]).then(([products, hidden, noPrice, gallery, reviews, categories]) => setN({ products, hidden, noPrice, gallery, reviews, categories }));
  }, []);

  const firstName = (member?.name || email || "").split(/[ @]/)[0];
  const tiles = [
    { href: "/dipti/products", icon: "chair", title: "Products", sub: "Add chairs, change prices and photos", n: n?.products },
    { href: "/dipti/categories", icon: "tag", title: "Categories", sub: "Product groups and the website menu", n: n?.categories },
    { href: "/dipti/gallery", icon: "photo", title: "Gallery", sub: "Photos on the gallery page", n: n?.gallery },
    { href: "/dipti/reviews", icon: "star", title: "Reviews", sub: "Google reviews shown on the site", n: n?.reviews },
    { href: "/dipti/settings", icon: "settings", title: "Site details", sub: "Phone, WhatsApp, address and page text" },
  ];

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <p className="eyebrow">Dipti Enterprise</p>
          <h1>{role === "client" && firstName ? "Hello, " + firstName : "Website content"}</h1>
          <p>Everything you change here shows on diptienterprise.com straight after you save.</p>
        </div>
        <div className="actions">
          <a className="btn" href={SITE} target="_blank" rel="noreferrer">
            Open the website <Icon name="external" />
          </a>
          <Link className="btn btn--solid" href="/dipti/products/new">
            <Icon name="plus" /> Add a product
          </Link>
        </div>
      </div>

      <div className="stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <Link className="stat hot" href="/dipti/products">
          <b>{n ? n.products : "–"}</b>
          <span>Products</span>
        </Link>
        <Link className="stat" href="/dipti/products?show=hidden">
          <b>{n ? n.hidden : "–"}</b>
          <span>Hidden from the website</span>
        </Link>
        <Link className="stat" href="/dipti/products?show=noprice">
          <b>{n ? n.noPrice : "–"}</b>
          <span>Showing "Price on request"</span>
        </Link>
      </div>

      <section className="card" style={{ padding: "6px 14px" }}>
        <div className="list">
          {tiles.map((t) => (
            <Link key={t.href} href={t.href} className="row">
              <span className="dthumb">
                <Icon name={t.icon} />
              </span>
              <div className="grow">
                <div className="title">{t.title}</div>
                <div className="sub">{t.sub}</div>
              </div>
              {t.n != null ? <span className="pill">{t.n}</span> : null}
            </Link>
          ))}
        </div>
      </section>

      <p className="small muted">
        Need help or a new page? WhatsApp Digitorium. Enquiries from the website still come to you on WhatsApp as before.
      </p>
    </div>
  );
}

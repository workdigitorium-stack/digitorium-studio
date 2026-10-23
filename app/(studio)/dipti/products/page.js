"use client";
/* Dipti Enterprise products: find, filter and open one to edit. */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { db, imgUrl, price } from "@/lib/dipti";

export default function Page() {
  return (
    <Suspense fallback={<div className="empty"><div className="spinner" /></div>}>
      <Products />
    </Suspense>
  );
}

function Products() {
  const { toast } = useStudio();
  const params = useSearchParams();
  const [rows, setRows] = useState(null);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState(params.get("show") || "all");

  useEffect(() => {
    Promise.all([
      db().from("de_products").select("id,slug,name,model,category,price_inr,images,active,featured,sort").order("sort").order("id"),
      db().from("de_categories").select("slug,name").order("sort"),
    ]).then(([p, c]) => {
      if (p.error) toast("Could not load products: " + p.error.message, { bad: true });
      setRows(p.data || []);
      setCats(c.data || []);
    });
  }, [toast]);

  const catName = (s) => cats.find((c) => c.slug === s)?.name || s;
  const shown = useMemo(() => {
    if (!rows) return [];
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (cat === "hidden" && r.active) return false;
      if (cat === "noprice" && r.price_inr != null) return false;
      if (cat === "featured" && !r.featured) return false;
      if (!["all", "hidden", "noprice", "featured"].includes(cat) && r.category !== cat) return false;
      return !term || (r.name + " " + (r.model || "") + " " + r.slug).toLowerCase().includes(term);
    });
  }, [rows, q, cat]);

  const chips = [
    { k: "all", label: "All", n: rows?.length },
    ...cats.map((c) => ({ k: c.slug, label: c.name, n: rows?.filter((r) => r.category === c.slug).length })),
    { k: "featured", label: "On home page", n: rows?.filter((r) => r.featured).length },
    { k: "hidden", label: "Hidden", n: rows?.filter((r) => !r.active).length },
    { k: "noprice", label: "No price", n: rows?.filter((r) => r.price_inr == null).length },
  ];

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <p className="eyebrow">Dipti Enterprise</p>
          <h1>Products</h1>
          <p>Tap a product to change its price, photos or details.</p>
        </div>
        <div className="actions">
          <Link className="btn btn--solid" href="/dipti/products/new">
            <Icon name="plus" /> Add a product
          </Link>
        </div>
      </div>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" />
          <input className="input" type="search" placeholder="Search by name or model" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" />
        </label>
        <div className="chips">
          {chips.map((c) => (
            <button key={c.k} type="button" className={"chip" + (cat === c.k ? " on" : "")} onClick={() => setCat(c.k)}>
              {c.label}
              {c.n != null ? <b>{c.n}</b> : null}
            </button>
          ))}
        </div>
      </div>

      <section className="card" style={{ padding: "6px 14px" }}>
        {!rows ? (
          <div className="empty">
            <div className="spinner" />
          </div>
        ) : !shown.length ? (
          <div className="empty">
            <Icon name="chair" />
            <p>No products match.</p>
          </div>
        ) : (
          <div className="list">
            {shown.map((r) => (
              <Link key={r.id} href={"/dipti/products/" + r.id} className={"row" + (r.active ? "" : " is-off")}>
                <span className="dthumb">{r.images?.[0] ? <img src={imgUrl(r.images[0].src)} alt="" loading="lazy" /> : <Icon name="photo" />}</span>
                <div className="grow">
                  <div className="title">{r.name}</div>
                  <div className="sub">
                    {price(r.price_inr)} · {catName(r.category)}
                    {r.model && !r.name.includes(r.model) ? " · " + r.model : ""}
                  </div>
                </div>
                {r.featured ? <span className="pill pill--new">Home page</span> : null}
                {!r.active ? <span className="pill">Hidden</span> : null}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

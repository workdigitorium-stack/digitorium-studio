"use client";
/* Dipti Enterprise categories: the filter tabs and the Products menu on the site. */
import { useCallback, useEffect, useState } from "react";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { db, saved, slugify, swapSort } from "@/lib/dipti";

export default function Categories() {
  const { toast } = useStudio();
  const [rows, setRows] = useState(null);
  const [counts, setCounts] = useState({});
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([db().from("de_categories").select("*").order("sort"), db().from("de_products").select("category")]);
    if (c.error) toast("Could not load categories: " + c.error.message, { bad: true });
    setRows(c.data || []);
    const n = {};
    (p.data || []).forEach((r) => (n[r.category] = (n[r.category] || 0) + 1));
    setCounts(n);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function add(e) {
    e.preventDefault();
    const n = name.trim();
    const slug = slugify(n);
    if (!slug) return toast("Type a category name.", { bad: true });
    if (rows.some((r) => r.slug === slug)) return toast("There is already a category called that.", { bad: true });
    setBusy(true);
    const sort = (rows.at(-1)?.sort ?? 0) + 10;
    const res = await db().from("de_categories").insert({ slug, name: n, sort });
    await saved(res, "dipti.category.add", n, toast);
    setBusy(false);
    if (!res.error) {
      setName("");
      load();
    }
  }

  async function rename(r) {
    const n = prompt("New name for " + r.name + ":", r.name);
    if (!n || !n.trim() || n.trim() === r.name) return;
    const res = await db().from("de_categories").update({ name: n.trim() }).eq("slug", r.slug);
    await saved(res, "dipti.category.rename", r.name + " → " + n.trim(), toast);
    load();
  }

  async function toggle(r) {
    const res = await db().from("de_categories").update({ active: !r.active }).eq("slug", r.slug);
    await saved(res, "dipti.category." + (r.active ? "hide" : "show"), r.name, toast);
    load();
  }

  async function move(i, d) {
    const a = rows[i];
    const b = rows[i + d];
    if (!b) return;
    const res = await swapSort("de_categories", a, b, "slug");
    await saved(res, "dipti.category.move", a.name, toast);
    load();
  }

  async function remove(r) {
    if (counts[r.slug]) return toast(r.name + " still has " + counts[r.slug] + " products. Move them to another category first.", { bad: true });
    if (!confirm("Delete the category " + r.name + "?")) return;
    const res = await db().from("de_categories").delete().eq("slug", r.slug);
    await saved(res, "dipti.category.delete", r.name, toast);
    load();
  }

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Dipti Enterprise</p>
          <h1>Categories</h1>
          <p>These are the tabs on the Products page and the Products menu. Categories with no products are not shown on the site.</p>
        </div>
      </div>

      <section className="card" style={{ padding: "6px 14px" }}>
        {!rows ? (
          <div className="empty">
            <div className="spinner" />
          </div>
        ) : (
          <div className="list">
            {rows.map((r, i) => (
              <div key={r.slug} className={"row" + (r.active ? "" : " is-off")}>
                <span className="dthumb">
                  <Icon name="tag" />
                </span>
                <div className="grow">
                  <div className="title">{r.name}</div>
                  <div className="sub">
                    {counts[r.slug] || 0} products{r.active ? "" : " · hidden"}
                  </div>
                </div>
                <div className="itemtools">
                  <button className="btn btn--sm btn--icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    <Icon name="up" />
                  </button>
                  <button className="btn btn--sm btn--icon" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                    <Icon name="down" />
                  </button>
                  <button className="btn btn--sm btn--icon" onClick={() => rename(r)} aria-label={"Rename " + r.name}>
                    <Icon name="edit" />
                  </button>
                  <button className="btn btn--sm btn--icon" onClick={() => toggle(r)} aria-label={r.active ? "Hide " + r.name : "Show " + r.name} title={r.active ? "Hide" : "Show"}>
                    <Icon name="eye" />
                  </button>
                  <button className="btn btn--sm btn--icon btn--danger" onClick={() => remove(r)} aria-label={"Delete " + r.name}>
                    <Icon name="trash" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <form className="card" onSubmit={add}>
        <h2>Add a category</h2>
        <div className="btnrow">
          <input className="input" style={{ flex: 1, minWidth: 200 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office Sofas" maxLength={80} />
          <button className="btn btn--solid" disabled={busy}>
            <Icon name="plus" /> Add
          </button>
        </div>
      </form>
    </div>
  );
}

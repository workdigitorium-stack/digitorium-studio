"use client";
/* Dipti Enterprise reviews: real Google reviews shown on the home and about pages. */
import { useCallback, useEffect, useState } from "react";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { can } from "@/lib/roles";
import { db, saved, swapSort } from "@/lib/dipti";

const BLANK = { name: "", rating: 5, text: "", date: new Date().toISOString().slice(0, 10), active: true };

export default function Reviews() {
  const { role, toast } = useStudio();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await db().from("de_reviews").select("*").order("sort");
    if (error) toast("Could not load reviews: " + error.message, { bad: true });
    setRows(data || []);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function toggle(r) {
    const res = await db().from("de_reviews").update({ active: !r.active }).eq("id", r.id);
    await saved(res, "dipti.review." + (r.active ? "hide" : "show"), r.name, toast);
    load();
  }
  async function move(i, d) {
    const b = rows[i + d];
    if (!b) return;
    const res = await swapSort("de_reviews", rows[i], b);
    await saved(res, "dipti.review.move", rows[i].name, toast);
    load();
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Dipti Enterprise</p>
          <h1>Reviews</h1>
          <p>Copy real reviews from your Google listing. Reviews with no text are not shown on the site.</p>
        </div>
        <div className="actions">
          <button className="btn btn--solid" onClick={() => setEdit(BLANK)}>
            <Icon name="plus" /> Add a review
          </button>
        </div>
      </div>

      <section className="card" style={{ padding: "6px 14px" }}>
        {!rows ? (
          <div className="empty">
            <div className="spinner" />
          </div>
        ) : !rows.length ? (
          <div className="empty">
            <Icon name="star" />
            <p>No reviews yet.</p>
          </div>
        ) : (
          <div className="list">
            {rows.map((r, i) => (
              <div key={r.id} className={"row" + (r.active ? "" : " is-off")}>
                <button className="grow" style={{ background: "none", border: 0, padding: 0, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }} onClick={() => setEdit(r)}>
                  <div className="title">
                    {r.name} <span className="stars small">{"★".repeat(Math.round(r.rating))}</span>
                  </div>
                  <div className="sub">{r.text?.trim() ? r.text.replace(/\s+/g, " ") : "No text (not shown on the site)"}</div>
                </button>
                <div className="itemtools">
                  <button className="btn btn--sm btn--icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                    <Icon name="up" />
                  </button>
                  <button className="btn btn--sm btn--icon" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">
                    <Icon name="down" />
                  </button>
                  <button className="btn btn--sm btn--icon" onClick={() => toggle(r)} aria-label={r.active ? "Hide review" : "Show review"} title={r.active ? "Hide" : "Show"}>
                    <Icon name="eye" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {edit ? <ReviewSheet review={edit} rows={rows} canDelete={can(role, "dipti.delete")} onClose={() => setEdit(null)} onDone={load} /> : null}
    </div>
  );
}

function ReviewSheet({ review, rows, canDelete, onClose, onDone }) {
  const { toast } = useStudio();
  const [r, setR] = useState(review);
  const [busy, setBusy] = useState(false);
  const isNew = !review.id;
  const set = (k, v) => setR((x) => ({ ...x, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!r.name.trim()) return toast("Add the reviewer's name.", { bad: true });
    const row = { name: r.name.trim(), rating: Number(r.rating), text: r.text.trim(), date: r.date || null, active: r.active };
    setBusy(true);
    let res;
    if (isNew) res = await db().from("de_reviews").insert({ ...row, sort: (rows[0]?.sort ?? 0) - 10 });
    else res = await db().from("de_reviews").update(row).eq("id", r.id);
    await saved(res, isNew ? "dipti.review.add" : "dipti.review.edit", row.name, toast);
    setBusy(false);
    if (!res.error) {
      onDone();
      onClose();
    }
  }

  async function remove() {
    if (!confirm("Delete the review from " + r.name + "?")) return;
    setBusy(true);
    const res = await db().from("de_reviews").delete().eq("id", r.id);
    await saved(res, "dipti.review.delete", r.name, toast);
    setBusy(false);
    if (!res.error) {
      onDone();
      onClose();
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="sheet" role="dialog" aria-modal="true" aria-label={isNew ? "Add a review" : "Edit review"} onSubmit={submit} noValidate>
        <div className="sheethead">
          <div>
            <p className="eyebrow">Review</p>
            <h2>{isNew ? "Add a review" : "Edit review"}</h2>
          </div>
          <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <label className="field">
          <span>Name</span>
          <input className="input" value={r.name} onChange={(e) => set("name", e.target.value)} maxLength={120} autoFocus />
        </label>
        <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label className="field">
            <span>Stars</span>
            <select className="select" value={r.rating} onChange={(e) => set("rating", e.target.value)}>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)} ({n})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" value={r.date || ""} onChange={(e) => set("date", e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Review text</span>
          <textarea className="textarea" value={r.text} onChange={(e) => set("text", e.target.value)} maxLength={2000} />
        </label>
        <label className="check">
          <input type="checkbox" checked={r.active} onChange={(e) => set("active", e.target.checked)} /> Show on the website
        </label>
        <div className="btnrow end">
          {!isNew && canDelete ? (
            <button type="button" className="btn btn--danger" onClick={remove} disabled={busy} style={{ marginRight: "auto" }}>
              <Icon name="trash" /> Delete
            </button>
          ) : null}
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--solid" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

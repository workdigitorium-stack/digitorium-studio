"use client";
/* Dipti Enterprise gallery page photos. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { can } from "@/lib/roles";
import { db, friendly, imgUrl, refreshSite, saved, swapSort, uploadImage } from "@/lib/dipti";
import { logActivity } from "@/lib/supabase";

export default function Gallery() {
  const { role, toast } = useStudio();
  const [rows, setRows] = useState(null);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    const { data, error } = await db().from("de_gallery").select("*").order("sort");
    if (error) toast("Could not load the gallery: " + error.message, { bad: true });
    setRows(data || []);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function add(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    setUploading(list.length);
    /* new photos go first */
    let sort = (rows[0]?.sort ?? 0) - 10 * list.length;
    let ok = 0;
    for (const f of list) {
      try {
        const img = await uploadImage(f, "gallery");
        const { error } = await db().from("de_gallery").insert({ ...img, sort: (sort += 10) });
        if (error) throw error;
        ok++;
      } catch (e) {
        toast(friendly(e.message), { bad: true });
      }
      setUploading((n) => n - 1);
    }
    if (ok) {
      logActivity("dipti.gallery.add", ok + " photos");
      const live = await refreshSite();
      toast(ok + (ok === 1 ? " photo" : " photos") + " added" + (live ? ". Live on the website now." : ". They will show within 5 minutes."));
    }
    load();
  }

  async function toggle(r) {
    const res = await db().from("de_gallery").update({ active: !r.active }).eq("id", r.id);
    await saved(res, "dipti.gallery." + (r.active ? "hide" : "show"), r.src, toast);
    load();
  }
  async function move(i, d) {
    const b = rows[i + d];
    if (!b) return;
    const res = await swapSort("de_gallery", rows[i], b);
    await saved(res, "dipti.gallery.move", rows[i].src, toast);
    load();
  }
  async function remove(r) {
    if (!confirm("Delete this photo from the gallery?")) return;
    const res = await db().from("de_gallery").delete().eq("id", r.id);
    await saved(res, "dipti.gallery.delete", r.src, toast);
    load();
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <p className="eyebrow">Dipti Enterprise</p>
          <h1>Gallery</h1>
          <p>Photos on the Gallery page, in this order. New photos go first.</p>
        </div>
        <div className="actions">
          <button className="btn btn--solid" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
            <Icon name="upload" /> {uploading > 0 ? "Uploading " + uploading + "…" : "Add photos"}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        </div>
      </div>

      {!rows ? (
        <div className="empty">
          <div className="spinner" />
        </div>
      ) : (
        <div className="imgrid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
          {rows.map((r, i) => (
            <div key={r.id} className={"imgcell" + (r.active ? "" : " is-off")}>
              <div className="pic">
                <img src={imgUrl(r.src)} alt="" loading="lazy" />
                {!r.active ? <span className="pill">Hidden</span> : null}
              </div>
              <div className="tools">
                <button className="btn btn--sm btn--icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move earlier">
                  <Icon name="back" />
                </button>
                <button className="btn btn--sm btn--icon" onClick={() => toggle(r)} aria-label={r.active ? "Hide photo" : "Show photo"} title={r.active ? "Hide" : "Show"}>
                  <Icon name="eye" />
                </button>
                {can(role, "dipti.delete") ? (
                  <button className="btn btn--sm btn--icon btn--danger" onClick={() => remove(r)} aria-label="Delete photo">
                    <Icon name="trash" />
                  </button>
                ) : null}
                <button className="btn btn--sm btn--icon" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move later">
                  <Icon name="back" style={{ transform: "rotate(180deg)" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

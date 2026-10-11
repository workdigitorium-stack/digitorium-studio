"use client";
/* Media library: the photos and videos the live site shows, by client and section. */
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { can } from "@/lib/roles";
import { logActivity } from "@/lib/supabase";
import {
  ACCEPT, BIN_DAYS, CLIENTS, SECTIONS, clientName, fetchBin, fetchLibrary, groupItems,
  isExpired, move, purge, toBin, uniqueName, upload,
} from "@/lib/media";
import { bytes, dateTime, humanize, slugify, timeAgo } from "@/lib/format";

const MAX_MB = 50; /* Supabase's per-file upload limit on this plan */
const REEL_MB = 3; /* the brief's reel export spec */

export default function MediaPage() {
  return (
    <Suspense fallback={<div className="spinner" />}>
      <Media />
    </Suspense>
  );
}

function Media() {
  const { role, toast } = useStudio();
  const router = useRouter();
  const params = useSearchParams();
  const [lib, setLib] = useState(null);
  const [error, setError] = useState("");
  const [openKey, setOpenKey] = useState(null);
  const [uploading, setUploading] = useState(params.get("upload") === "1");
  const folder = params.get("folder") || "all";
  const kind = params.get("kind") || "all";
  const view = params.get("view") || "library";

  const setParam = useCallback(
    (k, v) => {
      const p = new URLSearchParams(params.toString());
      p.delete("upload");
      if (v == null || v === "all") p.delete(k);
      else p.set(k, v);
      router.replace("/media" + (p.toString() ? "?" + p : ""), { scroll: false });
    },
    [params, router],
  );

  const load = useCallback(async () => {
    try {
      const r = await fetchLibrary();
      setLib({ ...r, items: groupItems(r.files) });
      setError("");
    } catch (e) {
      setError(e.message || "Could not load the library.");
      setLib({ files: [], folders: [], items: [] });
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const tree = useMemo(() => {
    const t = new Map();
    for (const f of lib?.folders || []) {
      if (!t.has(f.client)) t.set(f.client, []);
      t.get(f.client).push(f.section);
    }
    return t;
  }, [lib]);

  const items = useMemo(() => {
    const all = (lib?.items || []).filter((i) => i.kind !== "other");
    return all.filter((i) => {
      if (folder !== "all") {
        const [c, s] = folder.split("/");
        if (i.client !== c || (s && i.section !== s)) return false;
      }
      if (kind === "photos") return i.kind === "photo" || i.kind === "backdrop";
      if (kind === "videos") return i.kind === "video";
      return true;
    });
  }, [lib, folder, kind]);

  const countIn = (c, s) => (lib?.items || []).filter((i) => i.client === c && (!s || i.section === s)).length;
  const open = lib?.items.find((i) => i.key === openKey) || null;
  const [fc, fs] = folder === "all" ? [] : folder.split("/");

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <p className="eyebrow">Media</p>
          <h1>Photos and videos</h1>
          <p>Files here are what digitorium.in shows. Changes appear on the site within a minute.</p>
        </div>
        <div className="actions">
          <button className={"btn" + (view === "bin" ? " btn--solid" : "")} onClick={() => setParam("view", view === "bin" ? null : "bin")}>
            <Icon name="bin" /> {view === "bin" ? "Back to library" : "Bin"}
          </button>
          {can(role, "media.upload") && view !== "bin" ? (
            <button className="btn btn--solid" onClick={() => setUploading(true)}>
              <Icon name="upload" /> Upload
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="notice notice--bad">{error}</p> : null}

      {view === "bin" ? (
        <Bin onRestored={load} />
      ) : (
        <div className="media">
          <nav className="folders" aria-label="Folders">
            <button className={folder === "all" ? "on" : ""} onClick={() => setParam("folder", null)}>
              All media <span className="count">{lib?.items.length ?? ""}</span>
            </button>
            {[...tree.entries()].map(([c, secs]) => (
              <div key={c} style={{ display: "contents" }}>
                <button className={folder === c ? "on" : ""} onClick={() => setParam("folder", c)}>
                  {clientName(c)} <span className="count">{countIn(c)}</span>
                </button>
                {secs.map((s) => (
                  <button key={s} className={"sub" + (folder === c + "/" + s ? " on" : "")} onClick={() => setParam("folder", c + "/" + s)} title={SECTIONS[s] || s}>
                    {humanize(s)} <span className="count">{countIn(c, s)}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="page" style={{ gap: 14 }}>
            <div className="folder-select">
              <select className="select" value={fc || "all"} onChange={(e) => setParam("folder", e.target.value)} aria-label="Client">
                <option value="all">All clients</option>
                {[...tree.keys()].map((c) => (
                  <option key={c} value={c}>
                    {clientName(c)}
                  </option>
                ))}
              </select>
              <select className="select" value={fs || ""} onChange={(e) => setParam("folder", e.target.value ? fc + "/" + e.target.value : fc)} aria-label="Section" disabled={!fc}>
                <option value="">All sections</option>
                {(tree.get(fc) || []).map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </select>
            </div>

            <div className="chips" role="tablist" aria-label="Type">
              {[
                ["all", "All"],
                ["photos", "Photos"],
                ["videos", "Videos"],
              ].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={kind === k} className={"chip" + (kind === k ? " on" : "")} onClick={() => setParam("kind", k)}>
                  {l}
                </button>
              ))}
            </div>

            {fs ? (
              <p className="small muted">
                <b style={{ color: "var(--ink2)" }}>{clientName(fc)} / {humanize(fs)}</b> shows on: {SECTIONS[fs] || "a section the site code reads by this folder name"}.
              </p>
            ) : null}

            {!lib ? (
              <div className="empty">
                <div className="spinner" />
              </div>
            ) : items.length === 0 ? (
              <div className="empty card">
                <Icon name="media" />
                <p>Nothing here yet.</p>
                {can(role, "media.upload") ? (
                  <button className="btn btn--solid" onClick={() => setUploading(true)}>
                    <Icon name="upload" /> Upload to this folder
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="tiles">
                {items.map((i) => (
                  <button key={i.key} className="tile" onClick={() => setOpenKey(i.key)}>
                    <div className="thumb">
                      {i.kind === "video" ? (
                        i.poster ? (
                          <img src={i.poster} alt="" loading="lazy" />
                        ) : (
                          <video src={i.src + "#t=0.5"} muted playsInline preload="metadata" />
                        )
                      ) : (
                        <img src={i.src} alt="" loading="lazy" />
                      )}
                      <span className="kind">
                        <Icon name={i.kind === "video" ? "video" : "photo"} />
                        {i.kind === "backdrop" ? "Background" : i.kind === "video" ? "Video" : "Photo"}
                      </span>
                    </div>
                    <div className="meta">
                      <b>{humanize(i.name)}</b>
                      <span>
                        {clientName(i.client)} · {humanize(i.section)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {open ? <ItemSheet item={open} files={lib.files} onClose={() => setOpenKey(null)} onChanged={load} /> : null}
      {uploading ? (
        <UploadSheet
          tree={tree}
          files={lib?.files || []}
          initial={{ client: fc, section: fs }}
          onClose={() => {
            setUploading(false);
            if (params.get("upload")) setParam("upload", null);
          }}
          onDone={(n) => {
            load();
            if (n) toast(n + (n === 1 ? " file" : " files") + " uploaded. Live on the site within a minute.");
          }}
        />
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- one item */

function ItemSheet({ item, files, onClose, onChanged }) {
  const { role, toast } = useStudio();
  const [name, setName] = useState(item.name);
  const [busy, setBusy] = useState(false);
  const coverInput = useRef(null);
  const canEdit = can(role, "media.upload");
  useEscape(onClose);

  async function rename() {
    const base = slugify(name);
    if (!base || base === item.name) return;
    const folderFiles = new Set(files.filter((f) => f.client === item.client && f.section === item.section).map((f) => f.base.toLowerCase()));
    if (folderFiles.has(base)) return toast("A file called " + base + " is already in this folder.", { bad: true });
    setBusy(true);
    try {
      for (const f of item.files) {
        const ext = f.file.slice(f.base.length);
        await move(f.path, item.client + "/" + item.section + "/" + base + ext);
      }
      logActivity("media.rename", item.key + " → " + base);
      toast("Renamed. The caption on the site now reads “" + humanize(base) + "”.");
      onChanged();
      onClose();
    } catch (e) {
      toast("Could not rename: " + e.message, { bad: true });
    }
    setBusy(false);
  }

  async function setCover(file) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast("Covers must be JPG, PNG or WebP.", { bad: true });
    setBusy(true);
    try {
      if (item.cover) await toBin(item.cover.path);
      const ext = "." + (file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1]);
      await upload(item.client + "/" + item.section + "/" + item.name + ext, file);
      logActivity("media.upload", item.key + " cover");
      toast("Cover updated");
      onChanged();
    } catch (e) {
      toast("Could not set the cover: " + e.message, { bad: true });
    }
    setBusy(false);
  }

  async function remove() {
    if (!confirm("Move “" + humanize(item.name) + "” to the bin? It disappears from the site within a minute. You can restore it for " + BIN_DAYS + " days.")) return;
    setBusy(true);
    try {
      for (const f of item.files) await toBin(f.path);
      logActivity("media.delete", item.key);
      toast("Moved to the bin");
      onChanged();
      onClose();
    } catch (e) {
      toast("Could not delete: " + e.message, { bad: true });
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet sheet--wide" role="dialog" aria-modal="true" aria-label={humanize(item.name)}>
        <div className="sheethead">
          <div>
            <p className="eyebrow">{item.kind === "backdrop" ? "Section background" : item.kind}</p>
            <h2>{humanize(item.name)}</h2>
            <p className="small muted">
              {clientName(item.client)} / {humanize(item.section)} · {SECTIONS[item.section] || item.section}
            </p>
          </div>
          <button className="btn btn--icon" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="preview">
          {item.kind === "video" ? <video src={item.video.url} poster={item.poster || undefined} controls playsInline preload="metadata" /> : <img src={item.src} alt="" />}
        </div>

        <dl className="kv">
          {item.files.map((f) => (
            <div key={f.path} style={{ display: "contents" }}>
              <dt>{f.type === "video" ? "Video" : item.kind === "video" ? "Cover" : "File"}</dt>
              <dd>
                <a href={f.url} target="_blank" rel="noreferrer" className="mono">
                  {f.file}
                </a>{" "}
                <span className="muted small">
                  {bytes(f.size)}
                  {f.type === "video" && f.size > REEL_MB * 1048576 ? " · over the " + REEL_MB + " MB reel guideline" : ""}
                </span>
              </dd>
            </div>
          ))}
          <dt>Uploaded</dt>
          <dd>{dateTime(item.created_at)}</dd>
        </dl>

        {canEdit ? (
          <>
            <label className="field">
              <span>Name (the site uses it as the caption unless the site code sets one)</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                <button className="btn" onClick={rename} disabled={busy || !slugify(name) || slugify(name) === item.name}>
                  Rename
                </button>
              </div>
            </label>
            <div className="btnrow">
              {item.kind === "video" ? (
                <>
                  <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => setCover(e.target.files[0])} />
                  <button className="btn" onClick={() => coverInput.current.click()} disabled={busy}>
                    <Icon name="photo" /> {item.cover ? "Replace cover" : "Add cover image"}
                  </button>
                </>
              ) : null}
              <button className="btn" onClick={() => navigator.clipboard.writeText(item.src).then(() => toast("Link copied"))}>
                <Icon name="copy" /> Copy link
              </button>
              <button className="btn btn--danger" onClick={remove} disabled={busy} style={{ marginLeft: "auto" }}>
                <Icon name="trash" /> Delete
              </button>
            </div>
          </>
        ) : (
          <p className="small muted">Your role can view media but not change it.</p>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- upload */

function UploadSheet({ tree, files, initial, onClose, onDone }) {
  const { toast } = useStudio();
  const clients = useMemo(() => [...new Set([...tree.keys(), ...Object.keys(CLIENTS)])], [tree]);
  const [client, setClient] = useState(initial.client || clients[0] || "");
  const [newClient, setNewClient] = useState("");
  const [section, setSection] = useState(initial.section || "home-reels");
  const [newSection, setNewSection] = useState("");
  const [queue, setQueue] = useState([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  useEscape(() => !busy && onClose());

  const sections = useMemo(() => [...new Set([...Object.keys(SECTIONS), ...[...tree.values()].flat()])], [tree]);
  const c = client === "__new" ? slugify(newClient) : client;
  const s = section === "__new" ? slugify(newSection) : section;

  function add(list) {
    const next = [];
    for (const f of list) {
      const okType = /^(image\/(jpeg|png|webp)|video\/mp4)$/.test(f.type);
      const tooBig = f.size > MAX_MB * 1048576;
      next.push({
        id: Math.random().toString(36).slice(2),
        file: f,
        state: !okType ? "error" : tooBig ? "error" : "ready",
        note: !okType ? "Only JPG, PNG, WebP or MP4" : tooBig ? "Over " + MAX_MB + " MB" : f.type === "video/mp4" && f.size > REEL_MB * 1048576 ? "Over " + REEL_MB + " MB, may load slowly" : "",
      });
    }
    setQueue((q) => [...q, ...next]);
  }

  async function start() {
    if (!c || !s) return toast("Choose a client and a section first.", { bad: true });
    setBusy(true);
    const taken = new Set(files.filter((f) => f.client === c && f.section === s).map((f) => f.file.toLowerCase()));
    /* "tour.mp4" and "tour.jpg" keep their shared name so they pair up as
       video + cover; a name is only changed on a clash with an existing file */
    let done = 0;
    for (const item of queue) {
      if (item.state !== "ready") continue;
      const f = item.file;
      const dot = f.name.lastIndexOf(".");
      const base = slugify(dot > 0 ? f.name.slice(0, dot) : f.name) || "file";
      const ext = f.type === "video/mp4" ? ".mp4" : f.type === "image/jpeg" ? ".jpg" : "." + f.type.split("/")[1];
      const name = uniqueName(base, ext, taken);
      setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: "uploading" } : x)));
      try {
        await upload(c + "/" + s + "/" + name, f);
        done++;
        logActivity("media.upload", c + "/" + s + "/" + name, { size: f.size });
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: "done", note: name } : x)));
      } catch (e) {
        setQueue((q) => q.map((x) => (x.id === item.id ? { ...x, state: "error", note: e.message } : x)));
      }
    }
    setBusy(false);
    onDone(done);
  }

  const ready = queue.filter((x) => x.state === "ready").length;
  const finished = queue.length > 0 && queue.every((x) => x.state === "done" || x.state === "error");

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Upload media">
        <div className="sheethead">
          <div>
            <p className="eyebrow">Upload</p>
            <h2>Add photos and videos</h2>
          </div>
          <button className="btn btn--icon" onClick={onClose} aria-label="Close" disabled={busy}>
            <Icon name="close" />
          </button>
        </div>

        <div className="formgrid two">
          <label className="field">
            <span>Client</span>
            <select className="select" value={client} onChange={(e) => setClient(e.target.value)} disabled={busy}>
              {clients.map((x) => (
                <option key={x} value={x}>
                  {clientName(x)}
                </option>
              ))}
              <option value="__new">+ New client…</option>
            </select>
            {client === "__new" ? <input className="input" placeholder="Client name" value={newClient} onChange={(e) => setNewClient(e.target.value)} /> : null}
          </label>
          <label className="field">
            <span>Section of the site</span>
            <select className="select" value={section} onChange={(e) => setSection(e.target.value)} disabled={busy}>
              {sections.map((x) => (
                <option key={x} value={x}>
                  {humanize(x)}
                </option>
              ))}
              <option value="__new">+ New section…</option>
            </select>
            {section === "__new" ? <input className="input" placeholder="folder-name" value={newSection} onChange={(e) => setNewSection(e.target.value)} /> : null}
          </label>
        </div>
        <p className="small muted" style={{ marginTop: -6 }}>
          {s && SECTIONS[s] ? "Shows on: " + SECTIONS[s] + "." : "A new section only shows once the site code reads that folder."}
        </p>

        <div
          className={"drop" + (over ? " over" : "")}
          onClick={() => input.current.click()}
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => (e.preventDefault(), setOver(false), add(e.dataTransfer.files))}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current.click()}
        >
          <Icon name="upload" />
          <b>Drop files here or tap to choose</b>
          <span className="small muted">JPG, PNG, WebP or MP4. Reels: 1080×1920, under {REEL_MB} MB.</span>
          <span className="tiny muted">Upload “tour.mp4” with “tour.jpg” and the photo becomes the video’s cover.</span>
          <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />
        </div>

        {queue.length ? (
          <div className="queue">
            {queue.map((x) => (
              <div key={x.id} className="qitem">
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.file.name}</span>
                <span className={"pill" + (x.state === "done" ? " pill--won" : x.state === "error" ? " pill--warn" : "")}>
                  {x.state === "ready" ? bytes(x.file.size) : x.state === "uploading" ? "Uploading…" : x.state === "done" ? "Done" : "Skipped"}
                </span>
                {x.note ? <span className="tiny muted" style={{ gridColumn: "1 / -1" }}>{x.state === "done" ? "Saved as " + x.note : x.note}</span> : null}
                <div className="bar">
                  <i style={{ width: x.state === "done" ? "100%" : x.state === "uploading" ? "60%" : "0%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="btnrow end">
          {finished ? (
            <button className="btn btn--solid" onClick={onClose}>
              Done
            </button>
          ) : (
            <>
              <button className="btn" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn--solid" onClick={start} disabled={busy || !ready || !c || !s}>
                {busy ? "Uploading…" : "Upload " + (ready || "") + (ready === 1 ? " file" : " files")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- bin */

function Bin({ onRestored }) {
  const { role, toast } = useStudio();
  const [items, setItems] = useState(null);
  const canPurge = can(role, "media.purge");

  const load = useCallback(async () => {
    try {
      let list = await fetchBin();
      /* owners and admins clear out anything older than BIN_DAYS on the way in */
      if (canPurge) {
        const old = list.filter(isExpired);
        if (old.length) {
          await purge(old.map((x) => x.path));
          list = list.filter((x) => !isExpired(x));
        }
      }
      setItems(list);
    } catch (e) {
      toast("Could not open the bin: " + e.message, { bad: true });
      setItems([]);
    }
  }, [canPurge, toast]);
  useEffect(() => {
    load();
  }, [load]);

  async function restore(x) {
    try {
      await move(x.path, x.restoreTo);
      logActivity("media.restore", x.restoreTo);
      toast("Restored. Back on the site within a minute.");
      load();
      onRestored();
    } catch (e) {
      toast(/exists/i.test(e.message) ? "A file with that name is back in the folder already. Rename it first." : "Could not restore: " + e.message, { bad: true });
    }
  }

  async function destroy(x) {
    if (!confirm("Delete " + x.file + " for good? This cannot be undone.")) return;
    try {
      await purge([x.path]);
      logActivity("media.purge", x.restoreTo);
      load();
    } catch (e) {
      toast("Could not delete: " + e.message, { bad: true });
    }
  }

  return (
    <section className="card" style={{ padding: "6px 14px" }}>
      <p className="small muted" style={{ padding: "10px 2px 4px" }}>
        Deleted files stay here for {BIN_DAYS} days, then go for good. Nothing in the bin shows on the site.
      </p>
      {!items ? (
        <div className="empty">
          <div className="spinner" />
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <Icon name="bin" />
          <p>The bin is empty.</p>
        </div>
      ) : (
        <div className="list">
          {items.map((x) => (
            <div key={x.path} className="row">
              <div className="avatar" style={{ borderRadius: 8, overflow: "hidden", background: "var(--line2)" }}>
                {x.type === "image" ? <img src={x.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon name="video" size={16} />}
              </div>
              <div className="grow">
                <div className="title">{x.file}</div>
                <div className="sub">
                  {clientName(x.client)} / {humanize(x.section)} · deleted {timeAgo(x.deleted_at)} · {bytes(x.size)}
                </div>
              </div>
              {can(role, "media.upload") ? (
                <button className="btn btn--sm" onClick={() => restore(x)}>
                  <Icon name="restore" /> Restore
                </button>
              ) : null}
              {canPurge ? (
                <button className="btn btn--sm btn--icon btn--danger" onClick={() => destroy(x)} aria-label={"Delete " + x.file + " for good"}>
                  <Icon name="trash" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function useEscape(fn) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && fn();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fn]);
}

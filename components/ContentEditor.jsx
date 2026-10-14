"use client";
/* The editor behind Pages → Home and Brand: a form built from a document's
   definition in lib/content.js. Every change autosaves to the draft; the
   live site only changes on Publish. Preview opens the real page with the
   draft showing, History puts back an earlier published version. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { can } from "@/lib/roles";
import { logActivity } from "@/lib/supabase";
import { dateTime, timeAgo } from "@/lib/format";
import {
  fetchDoc,
  saveDraft,
  publishDoc,
  fetchVersions,
  restoreVersion,
  openPreview,
  uploadSiteImage,
  linkProblem,
  problems,
  SEO_LIMITS,
  same,
} from "@/lib/content";

const SAVE_DELAY = 900;

/* A copy of obj with the value at path (a list of keys and indexes)
   replaced, or removed when the value is undefined. */
function setIn(obj, path, value) {
  if (!path.length) return value;
  const [k, ...rest] = path;
  const copy = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  if (!rest.length && value === undefined) delete copy[k];
  else copy[k] = setIn(copy[k], rest, value);
  return copy;
}

export default function ContentEditor({ def }) {
  const { role, session, toast } = useStudio();
  const canEdit = can(role, def.edit);
  const canPublish = can(role, "content.publish");

  const [row, setRow] = useState(null);
  const [doc, setDoc] = useState(null);
  /* loading | saved | dirty | saving | conflict | error */
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(false);

  const docRef = useRef(null);
  const stamp = useRef(null);
  const timer = useRef(null);
  const saving = useRef(false);
  /* set when someone else saved first; nothing saves until Load their version */
  const conflict = useRef(false);

  const load = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      const r = await fetchDoc(def.key);
      if (!r) throw new Error("missing");
      setRow(r);
      setDoc(r.draft);
      docRef.current = r.draft;
      stamp.current = r.draft_updated_at;
      conflict.current = false;
      setState("saved");
    } catch (e) {
      setState("error");
    }
  }, [def.key]);

  useEffect(() => {
    load();
    return () => clearTimeout(timer.current);
  }, [load]);

  const save = useCallback(async () => {
    if (saving.current || conflict.current) return;
    saving.current = true;
    const sent = docRef.current;
    setState("saving");
    try {
      const res = await saveDraft(def.key, sent, stamp.current);
      if (!res) {
        conflict.current = true;
        setState("conflict");
        return;
      }
      stamp.current = res.draft_updated_at;
      setRow((r) => ({ ...r, draft: sent, ...res }));
      if (docRef.current === sent) setState("saved");
      else {
        setState("dirty");
        timer.current = setTimeout(save, SAVE_DELAY);
      }
    } catch (e) {
      setState("dirty");
      toast("Could not save: " + (e.message || "check your connection") + ". Trying again shortly.", { bad: true });
      timer.current = setTimeout(save, SAVE_DELAY * 5);
    } finally {
      saving.current = false;
    }
  }, [def.key, toast]);

  const change = useCallback(
    (path, value) => {
      const next = setIn(docRef.current, path, value);
      docRef.current = next;
      setDoc(next);
      if (conflict.current) return;
      setState("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(save, SAVE_DELAY);
    },
    [save],
  );

  /* warn before leaving with a change that has not reached the database */
  useEffect(() => {
    const warn = (e) => {
      if (state === "dirty" || state === "saving") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [state]);

  if (state === "loading") {
    return (
      <div className="splash" style={{ minHeight: "40dvh" }}>
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="page">
        <div className="notice notice--bad">Could not load {def.title}. Check your connection and reload the page.</div>
      </div>
    );
  }

  const settled = state === "saved";
  const live = same(row.draft, row.published);
  const bad = problems(doc, def);

  async function publish() {
    if (!confirm("Publish " + def.title + " to digitorium.in? Visitors see it straight away.")) return;
    setBusy(true);
    try {
      const fresh = await publishDoc(def.key);
      logActivity("content.publish", def.title);
      toast(fresh ? "Published. The site shows it now." : "Published. The site shows it within a minute.");
      await load();
    } catch (e) {
      toast("Could not publish: " + e.message, { bad: true });
    } finally {
      setBusy(false);
    }
  }

  function discard() {
    if (!confirm("Throw away every change since the last publish? The draft goes back to what the site shows now.")) return;
    change([], row.published);
    logActivity("content.discard", def.title);
  }

  return (
    <div className="page editor">
      <div className="pagehead">
        <div>
          <p className="eyebrow">{def.key === "brand" ? "Brand" : def.key === "seo" ? "Search and sharing" : def.group ? "Pages · " + def.group : "Pages"}</p>
          <h1>{def.title}</h1>
          <p>{def.blurb}</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => openPreview(def.path, session?.access_token)} disabled={!settled} title={settled ? "" : "Saving first…"}>
            <Icon name="eye" /> Preview
          </button>
          <button className="btn" onClick={() => setHistory(true)}>
            <Icon name="history" /> History
          </button>
          {canPublish ? (
            <button className="btn btn--solid" onClick={publish} disabled={!settled || live || busy || bad.length > 0}>
              <Icon name="publish" /> {busy ? "Publishing…" : "Publish"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="statusline">
        <SaveState state={state} live={live} row={row} />
        {canEdit && settled && !live ? (
          <button className="linkbtn" onClick={discard}>
            Discard changes
          </button>
        ) : null}
      </div>

      {state === "conflict" ? (
        <div className="notice notice--warn">
          Someone else saved {def.title} while you were editing, so your last change was not saved.{" "}
          <button className="linkbtn" onClick={load}>
            Load their version
          </button>
        </div>
      ) : null}
      {!canEdit ? (
        <div className="notice">
          {def.key === "brand" ? "Only an owner or admin can change the brand." : def.key === "seo" ? "Only an owner or admin can change SEO." : "Your role can read this page but not change it."}
        </div>
      ) : null}
      {canEdit && !canPublish && !live ? (
        <div className="notice">Your changes are saved as a draft. An owner or admin publishes them to the site.</div>
      ) : null}
      {bad.length ? (
        <div className="notice notice--bad">
          Fix {bad.length === 1 ? "this link" : "these links"} before publishing: {bad.join(", ")}.
        </div>
      ) : null}

      {def.slots ? <SlotForm def={def} doc={doc} change={change} readOnly={!canEdit} toast={toast} /> : null}
      {def.seo ? <SeoForm def={def} doc={doc} change={change} readOnly={!canEdit} toast={toast} /> : null}

      {(def.sections || []).map((s, i) => {
        const base = s.key ? [s.key] : [];
        const value = s.key ? doc[s.key] || {} : doc;
        return (
          <details key={s.title} className="card sect" open={i === 0}>
            <summary>
              <h2>{s.title}</h2>
              {s.hideable && value.hidden ? <span className="pill">Hidden</span> : null}
            </summary>
            {s.hint ? <p className="small muted">{s.hint}</p> : null}
            {s.hideable ? (
              <label className="check">
                <input type="checkbox" checked={!value.hidden} disabled={!canEdit} onChange={(e) => change([...base, "hidden"], !e.target.checked)} />
                Show this section on the site
              </label>
            ) : null}
            <Fields fields={s.fields} value={value} path={base} change={change} readOnly={!canEdit} toast={toast} />
          </details>
        );
      })}

      {history ? <History def={def} canRestore={canPublish} onClose={() => setHistory(false)} onRestored={load} toast={toast} /> : null}
    </div>
  );
}

/* The other pages: every text, picture and link from the page's code, in
   page order. The document stores only the fields that differ from the
   original; setting a field back to the original removes it. */
function SlotForm({ def, doc, change, readOnly, toast }) {
  const [query, setQuery] = useState("");
  const [changedOnly, setChangedOnly] = useState(false);
  const q = query.trim().toLowerCase();
  const changed = Object.keys(doc || {}).length;

  const set = (item, v) => change([item.id], v === item.value ? undefined : v);

  const sections = def.slots
    .map((s) => ({
      ...s,
      items: s.items.filter((it) => {
        const v = typeof doc[it.id] === "string" ? doc[it.id] : it.value;
        if (changedOnly && typeof doc[it.id] !== "string") return false;
        return !q || v.toLowerCase().includes(q) || it.value.toLowerCase().includes(q) || it.kind.toLowerCase().includes(q);
      }),
    }))
    .filter((s) => s.items.length);

  return (
    <>
      <div className="slotbar">
        <div className="search grow">
          <Icon name="search" />
          <input className="input" type="search" placeholder="Find text on this page" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <label className="check small">
          <input type="checkbox" checked={changedOnly} onChange={(e) => setChangedOnly(e.target.checked)} />
          Only changed ({changed})
        </label>
      </div>
      {!sections.length ? <div className="empty">Nothing on this page matches.</div> : null}
      {sections.map((s, i) => {
        const n = s.items.filter((it) => typeof doc[it.id] === "string").length;
        return (
          <details key={i + s.title} className="card sect" open={i === 0 || !!q || changedOnly}>
            <summary>
              <h2>{s.title}</h2>
              {n ? <span className="pill pill--new">{n} changed</span> : null}
            </summary>
            <div className="formgrid">
              {s.items.map((it) => (
                <Slot key={it.id} item={it} value={typeof doc[it.id] === "string" ? doc[it.id] : it.value} changed={typeof doc[it.id] === "string"} set={(v) => set(it, v)} readOnly={readOnly} toast={toast} />
              ))}
            </div>
          </details>
        );
      })}
    </>
  );
}

function Slot({ item, value, changed, set, readOnly, toast }) {
  const id = "s-" + item.id;
  const label = (
    <span className="slotlabel">
      <label htmlFor={id}>{item.kind}</label>
      {changed ? <span className="pill pill--new">Changed</span> : null}
      {changed && !readOnly ? (
        <button type="button" className="linkbtn" onClick={() => set(item.value)}>
          Reset to original
        </button>
      ) : null}
    </span>
  );
  if (item.image) {
    return (
      <div className={"slot" + (changed ? " is-changed" : "")}>
        <ImageField id={id} f={{ label }} value={value} set={set} readOnly={readOnly} toast={toast} />
      </div>
    );
  }
  const long = value.length > 90 || item.value.length > 90;
  const problem = item.link ? linkProblem(value) : null;
  return (
    <div className={"field slot" + (changed ? " is-changed" : "")}>
      {label}
      {long ? (
        <textarea id={id} className="textarea" value={value} readOnly={readOnly} onChange={(e) => set(e.target.value)} />
      ) : (
        <input id={id} className="input" value={value} readOnly={readOnly} inputMode={item.link ? "url" : undefined} onChange={(e) => set(e.target.value)} />
      )}
      {problem ? <span className="tiny fielderr">{problem}</span> : changed ? <span className="tiny muted">Original: {item.value}</span> : null}
    </div>
  );
}

/* Studio → SEO. Each page shows what Google and a shared link show now;
   an empty field keeps the page's own value from its code. */
function SeoForm({ def, doc, change, readOnly, toast }) {
  const [query, setQuery] = useState("");
  const pages = doc.pages || {};
  const redirects = Array.isArray(doc.redirects) ? doc.redirects : [];
  const q = query.trim().toLowerCase();
  const list = def.pages.filter((p) => !q || (p.path + " " + p.title + " " + (pages[p.path]?.title || "")).toLowerCase().includes(q));

  /* set one field; a page with nothing set is removed from the document */
  const setField = (path, field, value) => {
    const cur = { ...(pages[path] || {}), [field]: value };
    for (const k of Object.keys(cur)) if (cur[k] === "" || cur[k] === false || cur[k] == null) delete cur[k];
    change(["pages", path], Object.keys(cur).length ? cur : undefined);
  };

  return (
    <>
      <div className="slotbar">
        <div className="search grow">
          <Icon name="search" />
          <input className="input" type="search" placeholder="Find a page" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <section className="card">
        <h2>Pages</h2>
        <p className="small muted">Leave a field empty to keep the page's own text. Google shows about {SEO_LIMITS.title} characters of a title and {SEO_LIMITS.description} of a description.</p>
        <div className="items">
          {list.map((p) => {
            const o = pages[p.path] || {};
            const set = Object.keys(o).length;
            return (
              <details key={p.path} className="item">
                <summary>
                  <span className="grow">
                    <b>{p.path}</b> <span className="muted small">· {o.title || p.title}</span>
                  </span>
                  {o.noindex ? <span className="pill pill--warn">Hidden from Google</span> : null}
                  {set ? <span className="pill pill--new">Changed</span> : null}
                </summary>
                <div className="formgrid">
                  <SeoPreview path={p.path} title={o.title || p.title} description={o.description || p.description} image={o.image || p.image} />
                  <Counted label="Title in Google" value={o.title || ""} placeholder={p.title} max={SEO_LIMITS.title} readOnly={readOnly} onChange={(v) => setField(p.path, "title", v)} />
                  <Counted label="Description in Google" value={o.description || ""} placeholder={p.description} max={SEO_LIMITS.description} readOnly={readOnly} long onChange={(v) => setField(p.path, "description", v)} />
                  <ImageField id={"seo-img-" + p.path} f={{ label: "Picture when shared (1200 × 630 works best)", hint: p.image ? "Empty keeps the page's own picture." : "Empty: no picture." }} value={o.image || ""} set={(v) => setField(p.path, "image", v)} readOnly={readOnly} toast={toast} />
                  <label className="check">
                    <input type="checkbox" checked={!!o.noindex} disabled={readOnly} onChange={(e) => setField(p.path, "noindex", e.target.checked)} />
                    Hide this page from Google (and leave it out of the sitemap)
                  </label>
                  <div className="field">
                    <span>Canonical address (advanced)</span>
                    <input className="input" value={o.canonical || ""} placeholder={p.path} readOnly={readOnly} onChange={(e) => setField(p.path, "canonical", e.target.value)} />
                    <span className="tiny muted">Only if this page copies another one: the address Google should rank instead.</span>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Redirects</h2>
        <p className="small muted">
          Send an old or removed address to a new one, for example after renaming a page, or a short address for a campaign. A redirect only
          applies to addresses that have no page of their own.
        </p>
        <div className="items">
          {redirects.map((r, i) => (
            <div key={i} className="redirect">
              <input className="input" value={r.from || ""} placeholder="/old-address/" readOnly={readOnly} onChange={(e) => change(["redirects", i, "from"], e.target.value)} aria-label="From" />
              <span className="muted" aria-hidden="true">→</span>
              <input className="input" value={r.to || ""} placeholder="/new-address/ or https://…" readOnly={readOnly} onChange={(e) => change(["redirects", i, "to"], e.target.value)} aria-label="To" />
              <select className="select" value={r.permanent === false ? "temp" : "perm"} disabled={readOnly} onChange={(e) => change(["redirects", i, "permanent"], e.target.value === "perm")} aria-label="Kind">
                <option value="perm">Permanent (moved)</option>
                <option value="temp">Temporary</option>
              </select>
              {!readOnly ? (
                <button type="button" className="btn btn--sm btn--icon btn--danger" aria-label="Remove" onClick={() => change(["redirects"], redirects.filter((_, j) => j !== i))}>
                  <Icon name="trash" />
                </button>
              ) : null}
            </div>
          ))}
          {!readOnly ? (
            <button type="button" className="btn btn--sm" onClick={() => change(["redirects"], [...redirects, { from: "", to: "", permanent: true }])}>
              <Icon name="plus" /> Add redirect
            </button>
          ) : null}
        </div>
      </section>
    </>
  );
}

export function Counted({ label, value, placeholder, max, long, readOnly, onChange }) {
  const n = (value || placeholder || "").length;
  const Tag = long ? "textarea" : "input";
  return (
    <div className="field">
      <span className="slotlabel">
        {label}
        <span className={"tiny " + (n > max ? "fielderr" : "muted")}>
          {n} / {max}
        </span>
      </span>
      <Tag className={long ? "textarea" : "input"} value={value} placeholder={placeholder} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} />
      {n > max ? <span className="tiny fielderr">Longer than Google usually shows; the end may be cut off.</span> : null}
    </div>
  );
}

/* Roughly how Google and a shared link will show the page. */
export function SeoPreview({ path, title, description, image }) {
  const cut = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || "");
  return (
    <div className="seoprev">
      <div className="serp">
        <div className="serp__site">
          <span className="serp__fav">D</span>
          <span>
            <b>Digitorium</b>
            <br />
            <span className="muted">https://digitorium.in{path !== "/" ? " › " + path.replace(/^\/|\/$/g, "").split("/").join(" › ") : ""}</span>
          </span>
        </div>
        <div className="serp__title">{cut(title, 62)}</div>
        <div className="serp__desc">{cut(description, 160)}</div>
      </div>
      <div className="share">
        <div className="share__img">{image ? <img src={image} alt="" /> : <span className="muted small">No picture</span>}</div>
        <div className="share__text">
          <span className="tiny muted">DIGITORIUM.IN</span>
          <b>{cut(title, 70)}</b>
          <span className="small muted">{cut(description, 110)}</span>
        </div>
      </div>
    </div>
  );
}

function SaveState({ state, live, row }) {
  if (state === "dirty" || state === "saving") return <span className="pill">Saving…</span>;
  if (state === "conflict") return <span className="pill pill--warn">Not saved</span>;
  return (
    <span className="small muted">
      {live ? <span className="pill pill--won">Live</span> : <span className="pill pill--new">Unpublished changes</span>}{" "}
      {live
        ? row.published_at
          ? "Published " + timeAgo(row.published_at) + (row.published_by && row.published_by !== "setup" ? " by " + row.published_by : "")
          : ""
        : "Draft saved " + timeAgo(row.draft_updated_at) + (row.draft_updated_by && row.draft_updated_by !== "setup" ? " by " + row.draft_updated_by : "")}
    </span>
  );
}

function Fields({ fields, value, path, change, readOnly, toast }) {
  return (
    <div className="formgrid">
      {fields.map((f) => (
        <Field key={f.key} f={f} value={value?.[f.key]} path={[...path, f.key]} change={change} readOnly={readOnly} toast={toast} />
      ))}
    </div>
  );
}

function Field({ f, value, path, change, readOnly, toast }) {
  const id = "f-" + path.join("-");
  const set = (v) => change(path, v);

  if (f.type === "list") return <List f={f} items={Array.isArray(value) ? value : []} path={path} change={change} readOnly={readOnly} toast={toast} />;

  if (f.type === "toggle") {
    return (
      <label className="check">
        <input type="checkbox" checked={!!value} disabled={readOnly} onChange={(e) => set(e.target.checked)} />
        {f.label}
      </label>
    );
  }

  let input;
  if (f.type === "textarea") {
    input = <textarea id={id} className="textarea" value={value || ""} maxLength={f.max} readOnly={readOnly} onChange={(e) => set(e.target.value)} />;
  } else if (f.type === "lines") {
    input = (
      <textarea
        id={id}
        className="textarea"
        rows={4}
        value={(value || []).join("\n")}
        readOnly={readOnly}
        onChange={(e) => set(e.target.value.split("\n").map((x) => x.slice(0, 40)))}
      />
    );
  } else if (f.type === "select") {
    input = (
      <select id={id} className="select" value={value || ""} disabled={readOnly} onChange={(e) => set(e.target.value)}>
        {f.options.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
    );
  } else if (f.type === "image") {
    return <ImageField id={id} f={f} value={value} set={set} readOnly={readOnly} toast={toast} />;
  } else {
    input = (
      <input
        id={id}
        className="input"
        value={value || ""}
        maxLength={f.max || 300}
        readOnly={readOnly}
        placeholder={f.type === "link" ? "/page/ or https://…" : ""}
        inputMode={f.type === "link" ? "url" : undefined}
        onChange={(e) => set(e.target.value)}
      />
    );
  }

  const problem = f.type === "link" ? linkProblem(value) : null;
  return (
    <div className="field">
      <span>
        <label htmlFor={id}>{f.label}</label>
      </span>
      {input}
      {problem ? <span className="tiny fielderr">{problem}</span> : f.hint ? <span className="tiny muted">{f.hint}</span> : null}
    </div>
  );
}

export function ImageField({ id, f, value, set, readOnly, toast }) {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif|avif|svg\+xml)$/.test(file.type)) return toast("Choose a JPG, PNG, WebP or SVG picture.", { bad: true });
    if (file.size > 8 * 1024 * 1024) return toast("That picture is over 8 MB. Make it smaller first.", { bad: true });
    setBusy(true);
    try {
      set(await uploadSiteImage(file));
      logActivity("media.upload", "site picture " + file.name, { size: file.size });
    } catch (err) {
      toast("Upload failed: " + err.message, { bad: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="field">
      {typeof f.label === "string" ? (
        <span>
          <label htmlFor={id}>{f.label}</label>
        </span>
      ) : (
        f.label
      )}
      <div className="imgfield">
        <div className="imgthumb">{value ? <img src={value} alt="" /> : <Icon name="photo" />}</div>
        <div className="grow">
          <input id={id} className="input" value={value || ""} readOnly={readOnly} placeholder="https://…" onChange={(e) => set(e.target.value)} />
          {!readOnly ? (
            <div className="btnrow">
              <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()} disabled={busy}>
                <Icon name="upload" /> {busy ? "Uploading…" : value ? "Replace" : "Upload"}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml" hidden onChange={pick} />
            </div>
          ) : null}
        </div>
      </div>
      {f.hint ? <span className="tiny muted">{f.hint}</span> : null}
    </div>
  );
}

function List({ f, items, path, change, readOnly, toast }) {
  const move = (i, d) => {
    const next = [...items];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    change(path, next);
  };
  const remove = (i) => {
    const name = items[i]?.[f.itemTitle] || "this item";
    if (confirm("Remove “" + name + "”?")) change(path, items.filter((_, j) => j !== i));
  };
  return (
    <div className="field">
      <span>{f.label}</span>
      {f.hint ? <span className="tiny muted">{f.hint}</span> : null}
      <div className="items">
        {items.map((item, i) => (
          <details key={i} className="item">
            <summary>
              <span className="grow">{item?.[f.itemTitle] || <i className="muted">Untitled</i>}</span>
              {!readOnly && !f.fixed ? (
                <span className="itemtools" onClick={(e) => e.preventDefault()}>
                  <button type="button" className="btn btn--sm btn--icon" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <Icon name="up" />
                  </button>
                  <button type="button" className="btn btn--sm btn--icon" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                    <Icon name="down" />
                  </button>
                  <button type="button" className="btn btn--sm btn--icon btn--danger" aria-label="Remove" onClick={() => remove(i)}>
                    <Icon name="trash" />
                  </button>
                </span>
              ) : null}
            </summary>
            <Fields fields={f.fields} value={item} path={[...path, i]} change={change} readOnly={readOnly} toast={toast} />
          </details>
        ))}
        {!readOnly && !f.fixed ? (
          <button type="button" className="btn btn--sm" onClick={() => change(path, [...items, structuredClone(f.blank)])}>
            <Icon name="plus" /> Add {f.label.toLowerCase().replace(/s$/, "")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function History({ def, canRestore, onClose, onRestored, toast }) {
  const [versions, setVersions] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    fetchVersions(def.key).then(setVersions, () => setVersions([]));
  }, [def.key]);

  async function restore(v) {
    if (!confirm("Put back the version from " + dateTime(v.published_at) + "? It goes live straight away and replaces any unpublished changes.")) return;
    setBusy(v.id);
    try {
      const fresh = await restoreVersion(v.id);
      logActivity("content.restore", def.title + " from " + dateTime(v.published_at));
      toast(fresh ? "Restored. The site shows it now." : "Restored. The site shows it within a minute.");
      await onRestored();
      onClose();
    } catch (e) {
      toast("Could not restore: " + e.message, { bad: true });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={def.title + " history"}>
        <div className="sheethead">
          <div>
            <h2>History</h2>
            <p className="small muted">Every publish of {def.title}. Restoring one makes it live again.</p>
          </div>
          <button className="btn btn--icon" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {!versions ? (
          <div className="spinner" aria-label="Loading" />
        ) : (
          <div className="list">
            {versions.map((v, i) => (
              <div key={v.id} className="row">
                <div className="grow">
                  <div className="title">{dateTime(v.published_at)}</div>
                  <div className="sub">
                    {v.published_by === "setup" ? "Set up" : v.published_by}
                    {v.note ? " · " + v.note : ""}
                  </div>
                </div>
                {i === 0 ? (
                  <span className="pill pill--won">Live</span>
                ) : canRestore ? (
                  <button className="btn btn--sm" disabled={!!busy} onClick={() => restore(v)}>
                    <Icon name="restore" /> {busy === v.id ? "Restoring…" : "Restore"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

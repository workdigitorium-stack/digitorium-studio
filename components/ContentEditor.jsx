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
  same,
} from "@/lib/content";

const SAVE_DELAY = 900;

/* A copy of obj with the value at path (a list of keys and indexes) replaced. */
function setIn(obj, path, value) {
  if (!path.length) return value;
  const [k, ...rest] = path;
  const copy = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  copy[k] = setIn(copy[k], rest, value);
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
          <p className="eyebrow">{def.key === "brand" ? "Brand" : "Pages"}</p>
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
          {def.key === "brand" ? "Only an owner or admin can change the brand." : "Your role can read this page but not change it."}
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

      {def.sections.map((s, i) => {
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

function ImageField({ id, f, value, set, readOnly, toast }) {
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
      <span>
        <label htmlFor={id}>{f.label}</label>
      </span>
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

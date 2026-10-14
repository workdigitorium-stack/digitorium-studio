"use client";
/* One blog post: title, address, summary, cover, category, tags, the body
   (RichEditor) and its SEO. Every change autosaves to the draft. Owners and
   admins publish now or schedule a date, unpublish, restore an earlier
   version or delete; editors write drafts. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import RichEditor from "@/components/RichEditor";
import { ImageField, Counted, SeoPreview } from "@/components/ContentEditor";
import { can } from "@/lib/roles";
import { logActivity } from "@/lib/supabase";
import { openPreview, SEO_LIMITS } from "@/lib/content";
import { dateTime, timeAgo } from "@/lib/format";
import {
  BLANK,
  CATEGORIES,
  SLUG_OK,
  slugify,
  postStatus,
  fetchPost,
  savePostDraft,
  publishPost,
  unpublishPost,
  deletePost,
  fetchPostVersions,
  restorePostVersion,
} from "@/lib/posts";

const SAVE_DELAY = 900;

export default function PostEditor({ id }) {
  const { role, session, toast } = useStudio();
  const router = useRouter();
  const canEdit = can(role, "content.edit");
  const canPublish = can(role, "content.publish");

  const [row, setRow] = useState(null);
  const [doc, setDoc] = useState(null);
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(null); /* "schedule" | "history" */

  const docRef = useRef(null);
  const stamp = useRef(null);
  const timer = useRef(null);
  const saving = useRef(false);
  const conflict = useRef(false);
  /* the address follows the title until someone edits it, or it has been live */
  const slugTouched = useRef(false);

  const load = useCallback(async () => {
    clearTimeout(timer.current);
    try {
      const r = await fetchPost(id);
      if (!r) return setState("missing");
      const d = { ...BLANK, ...r.draft };
      setRow(r);
      setDoc(d);
      docRef.current = d;
      stamp.current = r.draft_updated_at;
      conflict.current = false;
      slugTouched.current = !!r.slug || (!!d.slug && d.slug !== slugify(d.title));
      setState("saved");
    } catch (e) {
      setState("error");
    }
  }, [id]);

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
      const res = await savePostDraft(id, sent, stamp.current);
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
  }, [id, toast]);

  const set = useCallback(
    (patch) => {
      if (conflict.current) return;
      const next = { ...docRef.current, ...patch };
      docRef.current = next;
      setDoc(next);
      setState("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(save, SAVE_DELAY);
    },
    [save],
  );

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
  if (state === "missing" || state === "error") {
    return (
      <div className="notice notice--bad">
        {state === "missing" ? "This post no longer exists." : "Could not load this post. Check your connection and reload."} <Link href="/posts">Back to Posts</Link>
      </div>
    );
  }

  const settled = state === "saved";
  const status = postStatus(row);
  const slugBad = doc.slug && !SLUG_OK.test(doc.slug);
  const ready = doc.title.trim() && doc.slug && !slugBad;
  const path = "/blog/" + (doc.slug || "…") + "/";

  async function publish(at) {
    if (!at && !confirm(status.key === "draft" ? "Publish “" + doc.title + "” on digitorium.in now?" : "Publish your changes to “" + doc.title + "”?")) return;
    setBusy(true);
    try {
      const fresh = await publishPost(id, at);
      logActivity("post.publish", doc.title + (at ? " (scheduled " + dateTime(at.toISOString()) + ")" : ""));
      toast(at ? "Scheduled for " + dateTime(at.toISOString()) + "." : fresh ? "Published. It is on the site now." : "Published. It shows on the site within a minute.");
      setSheet(null);
      await load();
    } catch (e) {
      toast("Could not publish: " + e.message, { bad: true });
    } finally {
      setBusy(false);
    }
  }

  async function unpublish() {
    if (!confirm("Take “" + doc.title + "” off the site? The draft stays here.")) return;
    setBusy(true);
    try {
      await unpublishPost(id);
      logActivity("post.unpublish", doc.title);
      toast("Taken off the site.");
      await load();
    } catch (e) {
      toast("Could not unpublish: " + e.message, { bad: true });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete “" + (doc.title || "this post") + "” for good? This cannot be undone." + (row.published ? " It also comes off the site." : ""))) return;
    setBusy(true);
    try {
      await deletePost(id);
      logActivity("post.delete", doc.title || "untitled post");
      toast("Post deleted.");
      router.replace("/posts");
    } catch (e) {
      toast("Could not delete: " + e.message, { bad: true });
      setBusy(false);
    }
  }

  return (
    <div className="page editor">
      <div className="pagehead">
        <div>
          <p className="eyebrow">
            <Link href="/posts">Posts</Link>
          </p>
          <div className="btnrow" style={{ alignItems: "center", marginTop: 4 }}>
            <span className={"pill pill--" + (status.key === "live" ? "won" : status.key === "scheduled" ? "scheduled" : "new")}>{status.label}</span>
            <span className="small muted">
              {state === "dirty" || state === "saving"
                ? "Saving…"
                : state === "conflict"
                  ? "Not saved"
                  : status.key === "scheduled"
                    ? "Goes live " + dateTime(row.publish_at)
                    : "Draft saved " + timeAgo(row.draft_updated_at) + (row.draft_updated_by ? " by " + row.draft_updated_by : "")}
            </span>
          </div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => openPreview(path, session?.access_token)} disabled={!settled || !doc.slug || slugBad}>
            <Icon name="eye" /> Preview
          </button>
          <button className="btn" onClick={() => setSheet("history")}>
            <Icon name="history" /> History
          </button>
          {canPublish ? (
            <>
              <button className="btn" onClick={() => setSheet("schedule")} disabled={!settled || !ready || busy}>
                <Icon name="bell" /> Schedule
              </button>
              <button className="btn btn--solid" onClick={() => publish(null)} disabled={!settled || !ready || busy || status.key === "live"}>
                <Icon name="publish" /> {busy ? "Working…" : status.key === "draft" ? "Publish" : "Publish changes"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {state === "conflict" ? (
        <div className="notice notice--warn">
          Someone else saved this post while you were editing, so your last change was not saved.{" "}
          <button className="linkbtn" onClick={load}>
            Load their version
          </button>
        </div>
      ) : null}
      {canEdit && !canPublish ? <div className="notice">Your changes save as a draft. An owner or admin publishes them.</div> : null}
      {!ready && canPublish ? <div className="notice">Give the post a title and a web address to publish it.</div> : null}

      <div className="postgrid">
        <div className="page" style={{ gap: 14 }}>
          <input
            className="posttitle"
            placeholder="Post title"
            value={doc.title}
            maxLength={140}
            readOnly={!canEdit}
            onChange={(e) => set({ title: e.target.value, ...(slugTouched.current ? {} : { slug: slugify(e.target.value) }) })}
            aria-label="Title"
          />
          <label className="slugline">
            digitorium.in/blog/
            <input
              value={doc.slug}
              placeholder="post-address"
              readOnly={!canEdit}
              onChange={(e) => {
                slugTouched.current = true;
                set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-").slice(0, 80) });
              }}
              aria-label="Web address"
            />
            /
          </label>
          {slugBad ? <span className="tiny fielderr">Use small letters, numbers and single dashes, not at the start or end.</span> : null}
          {row.slug && doc.slug !== row.slug ? (
            <span className="tiny" style={{ color: "var(--warn)" }}>
              The post is live at /blog/{row.slug}/. Publishing moves it; add a redirect from the old address in SEO so links keep working.
            </span>
          ) : null}
          <div className="field">
            <span className="slotlabel">
              Summary <span className="tiny muted">{doc.excerpt.length} / 220</span>
            </span>
            <textarea className="textarea" style={{ minHeight: 70 }} maxLength={220} placeholder="One or two lines under the title, and on the blog page." value={doc.excerpt} readOnly={!canEdit} onChange={(e) => set({ excerpt: e.target.value })} />
          </div>
          <RichEditor value={doc.body} onChange={(body) => set({ body })} readOnly={!canEdit} toast={toast} />
        </div>

        <aside className="page" style={{ gap: 14 }}>
          <section className="card">
            <h2>Cover</h2>
            <ImageField id="cover" f={{ label: "Cover picture", hint: "Wide works best (1600 × 900). Also used when the post is shared." }} value={doc.cover} set={(v) => set({ cover: v })} readOnly={!canEdit} toast={toast} />
            <div className="field">
              <span>Cover description</span>
              <input className="input" value={doc.cover_alt} maxLength={140} placeholder="What the picture shows" readOnly={!canEdit} onChange={(e) => set({ cover_alt: e.target.value })} />
            </div>
          </section>
          <section className="card">
            <h2>Topic</h2>
            <div className="field">
              <span>Category</span>
              <input className="input" list="post-categories" value={doc.category} maxLength={40} readOnly={!canEdit} onChange={(e) => set({ category: e.target.value })} />
              <datalist id="post-categories">
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <TagsField tags={doc.tags} readOnly={!canEdit} onChange={(tags) => set({ tags })} />
          </section>
          <section className="card">
            <h2>Search and sharing</h2>
            <SeoPreview path={path} title={doc.seo_title || (doc.title ? doc.title + " | Digitorium" : "")} description={doc.seo_description || doc.excerpt} image={doc.cover} />
            <Counted label="Title in Google" value={doc.seo_title} placeholder={doc.title ? doc.title + " | Digitorium" : "The post title"} max={SEO_LIMITS.title} readOnly={!canEdit} onChange={(v) => set({ seo_title: v })} />
            <Counted label="Description in Google" value={doc.seo_description} placeholder={doc.excerpt || "The summary"} max={SEO_LIMITS.description} long readOnly={!canEdit} onChange={(v) => set({ seo_description: v })} />
            <label className="check">
              <input type="checkbox" checked={!!doc.noindex} disabled={!canEdit} onChange={(e) => set({ noindex: e.target.checked })} />
              Hide this post from Google
            </label>
          </section>
          {canPublish ? (
            <section className="card">
              <h2>Manage</h2>
              <div className="btnrow">
                {row.published ? (
                  <button className="btn btn--sm" onClick={unpublish} disabled={busy}>
                    Unpublish
                  </button>
                ) : null}
                <button className="btn btn--sm btn--danger" onClick={remove} disabled={busy}>
                  <Icon name="trash" /> Delete post
                </button>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      {sheet === "schedule" ? <Schedule onClose={() => setSheet(null)} onPick={publish} busy={busy} current={status.key === "scheduled" ? row.publish_at : null} /> : null}
      {sheet === "history" ? <PostHistory id={id} canRestore={canPublish} onClose={() => setSheet(null)} onRestored={load} toast={toast} title={doc.title} /> : null}
    </div>
  );
}

function TagsField({ tags, onChange, readOnly }) {
  const [text, setText] = useState("");
  const add = () => {
    const t = text.trim().replace(/,$/, "");
    if (t && !tags.includes(t) && tags.length < 12) onChange([...tags, t.slice(0, 30)]);
    setText("");
  };
  return (
    <div className="field">
      <span>Tags</span>
      <div className="btnrow">
        {tags.map((t) => (
          <span key={t} className="pill">
            {t}
            {!readOnly ? (
              <button type="button" className="linkbtn" aria-label={"Remove " + t} onClick={() => onChange(tags.filter((x) => x !== t))}>
                ×
              </button>
            ) : null}
          </span>
        ))}
      </div>
      {!readOnly ? (
        <input
          className="input"
          value={text}
          placeholder="Type a tag and press Enter"
          onChange={(e) => (e.target.value.endsWith(",") ? (setText(e.target.value), setTimeout(add)) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
        />
      ) : null}
    </div>
  );
}

/* A date and time in India time, for "Schedule". */
function Schedule({ onClose, onPick, busy, current }) {
  const toLocal = (d) => {
    const ist = new Date(d.getTime() + 5.5 * 3600000);
    return ist.toISOString().slice(0, 16);
  };
  const [value, setValue] = useState(toLocal(current ? new Date(current) : new Date(Date.now() + 24 * 3600000)));
  const at = new Date(value + ":00+05:30");
  const past = !(at > new Date());
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Schedule">
        <div className="sheethead">
          <div>
            <h2>Schedule</h2>
            <p className="small muted">The post goes live by itself at this time (India time). Until then visitors cannot see it.</p>
          </div>
          <button className="btn btn--icon" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <input className="input" type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} />
        {past ? <span className="tiny fielderr">Pick a time in the future, or use Publish for now.</span> : null}
        <div className="btnrow end">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--solid" disabled={past || busy} onClick={() => onPick(at)}>
            {busy ? "Scheduling…" : "Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostHistory({ id, canRestore, onClose, onRestored, toast, title }) {
  const [versions, setVersions] = useState(null);
  const [busy, setBusy] = useState(null);
  useEffect(() => {
    fetchPostVersions(id).then(setVersions, () => setVersions([]));
  }, [id]);

  async function restore(v) {
    if (!confirm("Put back the version from " + dateTime(v.published_at) + "? It goes live straight away and replaces any unpublished changes.")) return;
    setBusy(v.id);
    try {
      await restorePostVersion(v.id);
      logActivity("post.restore", title + " from " + dateTime(v.published_at));
      toast("Restored.");
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
      <div className="sheet" role="dialog" aria-modal="true" aria-label="History">
        <div className="sheethead">
          <div>
            <h2>History</h2>
            <p className="small muted">Every publish of this post. Restoring one makes it live again.</p>
          </div>
          <button className="btn btn--icon" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        {!versions ? (
          <div className="spinner" aria-label="Loading" />
        ) : !versions.length ? (
          <p className="small muted">Not published yet.</p>
        ) : (
          <div className="list">
            {versions.map((v, i) => (
              <div key={v.id} className="row">
                <div className="grow">
                  <div className="title">{dateTime(v.published_at)}</div>
                  <div className="sub">
                    {v.published_by}
                    {v.note ? " · " + v.note : ""}
                  </div>
                </div>
                {i === 0 ? (
                  <span className="pill pill--won">Latest</span>
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

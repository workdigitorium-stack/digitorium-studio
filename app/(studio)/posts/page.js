"use client";
/* Posts: the blog at digitorium.in/blog/. Every post with its state, and
   New post. Writing happens in /posts/<id> (components/PostEditor.jsx).
   Owners and admins can Select several posts and delete them together.
   The filter is remembered, and coming back shows the last list at once. */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { can } from "@/lib/roles";
import { SITE_URL, logActivity } from "@/lib/supabase";
import { cachedPosts, createPost, deletePosts, dueForLinkedIn, fetchPosts, postStatus } from "@/lib/posts";
import { shareDue } from "@/lib/linkedin";
import { dateTime, timeAgo } from "@/lib/format";

const FILTERS = [
  ["all", "All"],
  ["draft", "Drafts"],
  ["scheduled", "Scheduled"],
  ["live", "Live"],
  ["linkedin", "On LinkedIn"],
];
const FILTER_KEY = "studio:posts-filter";

function savedFilter() {
  try {
    const f = sessionStorage.getItem(FILTER_KEY);
    return FILTERS.some(([k]) => k === f) ? f : "all";
  } catch (e) {
    return "all";
  }
}

export default function Posts() {
  const { role, toast } = useStudio();
  const router = useRouter();
  const [posts, setPosts] = useState(cachedPosts);
  const [filter, setFilterState] = useState("all");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState(() => new Set());

  useEffect(() => {
    setFilterState(savedFilter());
    fetchPosts().then((list) => {
      setPosts(list);
      /* scheduled posts reach LinkedIn when someone opens Posts after their time, or by the daily run */
      if (dueForLinkedIn(list).length) shareDue().catch(() => {});
    }, () => setPosts((p) => p || []));
  }, []);

  if (!can(role, "content.read")) return <div className="notice">Your role does not include the blog.</div>;
  const canDelete = can(role, "content.publish");

  function setFilter(k) {
    setFilterState(k);
    try {
      sessionStorage.setItem(FILTER_KEY, k);
    } catch (e) {
      /* private mode: the filter just is not remembered */
    }
  }

  async function newPost() {
    setBusy(true);
    try {
      const id = await createPost();
      router.push("/posts/" + id);
    } catch (e) {
      toast("Could not start a post: " + e.message, { bad: true });
      setBusy(false);
    }
  }

  function stopPicking() {
    setPicking(false);
    setPicked(new Set());
  }
  function toggle(id) {
    setPicked((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function removePicked() {
    const list = rows.filter((p) => picked.has(p.id));
    const live = list.filter((p) => p.published).length;
    if (!list.length) return;
    if (!confirm("Delete " + list.length + (list.length === 1 ? " post" : " posts") + " for good? This cannot be undone." + (live ? " " + live + " of them " + (live === 1 ? "comes" : "come") + " off the site." : ""))) return;
    setBusy(true);
    try {
      await deletePosts(list.map((p) => p.id));
      list.forEach((p) => logActivity("post.delete", p.draft?.title || "untitled post"));
      setPosts((ps) => ps.filter((p) => !picked.has(p.id)));
      toast(list.length === 1 ? "Post deleted." : list.length + " posts deleted.");
      stopPicking();
    } catch (e) {
      toast("Could not delete: " + e.message, { bad: true });
    } finally {
      setBusy(false);
    }
  }

  const rows = (posts || []).map((p) => ({ ...p, status: postStatus(p) }));
  const match = (p, k) =>
    k === "all" ||
    (k === "live" ? p.status.key === "live" || p.status.key === "changed" : k === "linkedin" ? !!(p.linkedin_urn || p.draft?.linkedin?.share) : p.status.key === k);
  const count = (k) => rows.filter((p) => match(p, k)).length;
  /* posts on LinkedIn, or going there, lead the list */
  const onLinkedIn = (p) => (p.linkedin_urn ? 2 : p.draft?.linkedin?.share ? 1 : 0);
  const shown = rows.filter((p) => match(p, filter)).sort((a, b) => onLinkedIn(b) - onLinkedIn(a));
  const allPicked = shown.length > 0 && shown.every((p) => picked.has(p.id));

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Blog</p>
          <h1>Posts</h1>
          <p>Write, schedule and publish posts on digitorium.in/blog/.</p>
        </div>
        <div className="actions">
          {can(role, "content.edit") ? (
            <button className="btn btn--solid" onClick={newPost} disabled={busy}>
              <Icon name="plus" /> New post
            </button>
          ) : null}
          {canDelete && rows.length ? (
            <button className={"btn" + (picking ? " btn--on" : "")} onClick={() => (picking ? stopPicking() : setPicking(true))}>
              <Icon name={picking ? "close" : "select"} /> {picking ? "Done" : "Select"}
            </button>
          ) : null}
          <a className="btn" href={SITE_URL + "/blog/"} target="_blank" rel="noreferrer">
            Open the blog <Icon name="external" />
          </a>
        </div>
      </div>

      <div className="chips">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
            {label}
            {k !== "all" && posts ? <b>{count(k)}</b> : null}
          </button>
        ))}
      </div>

      <section className="card">
        {picking && shown.length ? (
          <label className="check pickall">
            <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(shown.map((p) => p.id)))} />
            {allPicked ? "Unselect all" : "Select all " + shown.length}
          </label>
        ) : null}
        {!posts ? (
          <div className="spinner" aria-label="Loading" />
        ) : !shown.length ? (
          <div className="empty">
            <Icon name="posts" />
            <p>{posts.length ? "No posts here." : "No posts yet. Start the first one."}</p>
          </div>
        ) : (
          <div className="list">
            {shown.map((p) => {
              const inner = (
                <>
                  {picking ? <input type="checkbox" className="pickbox" checked={picked.has(p.id)} readOnly tabIndex={-1} aria-hidden="true" /> : null}
                  <div className="grow">
                    <div className="title">{p.draft?.title || <i className="muted">Untitled</i>}</div>
                    <div className="sub">
                      {p.draft?.category ? p.draft.category + " · " : ""}
                      {p.status.key === "scheduled"
                        ? "Goes live " + dateTime(p.publish_at)
                        : p.published
                          ? "Published " + dateTime(p.publish_at, false)
                          : "Edited " + timeAgo(p.draft_updated_at) + (p.draft_updated_by ? " by " + p.draft_updated_by : "")}
                    </div>
                  </div>
                  {p.linkedin_urn || p.draft?.linkedin?.share ? (
                    <span className={"pill pill--li" + (p.linkedin_urn ? " is-shared" : "")} title={p.linkedin_urn ? "Shared on LinkedIn" : "Shares on LinkedIn when live"}>
                      <Icon name="linkedin" /> {p.linkedin_urn ? "Shared" : "LinkedIn"}
                    </span>
                  ) : null}
                  <span className={"pill pill--" + (p.status.key === "live" ? "won" : p.status.key === "scheduled" ? "scheduled" : "new")}>{p.status.label}</span>
                </>
              );
              return picking ? (
                <button key={p.id} type="button" className={"row" + (picked.has(p.id) ? " is-picked" : "")} onClick={() => toggle(p.id)} aria-pressed={picked.has(p.id)}>
                  {inner}
                </button>
              ) : (
                <Link key={p.id} href={"/posts/" + p.id} className="row">
                  {inner}
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {picking ? (
        <div className="savebar pickbar">
          <span className="grow">{picked.size ? picked.size + " selected" : "Tap posts to select them"}</span>
          <button className="btn" onClick={stopPicking} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn--solid btn--danger-solid" onClick={removePicked} disabled={!picked.size || busy}>
            <Icon name="trash" /> {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

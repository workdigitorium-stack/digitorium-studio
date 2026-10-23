"use client";
/* Posts: the blog at digitorium.in/blog/. Every post with its state, and
   New post. Writing happens in /posts/<id> (components/PostEditor.jsx). */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { can } from "@/lib/roles";
import { SITE_URL } from "@/lib/supabase";
import { createPost, dueForLinkedIn, fetchPosts, postStatus } from "@/lib/posts";
import { shareDue } from "@/lib/linkedin";
import { dateTime, timeAgo } from "@/lib/format";

const FILTERS = [
  ["all", "All"],
  ["draft", "Drafts"],
  ["scheduled", "Scheduled"],
  ["live", "Live"],
];

export default function Posts() {
  const { role, toast } = useStudio();
  const router = useRouter();
  const [posts, setPosts] = useState(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchPosts().then((list) => {
      setPosts(list);
      /* scheduled posts reach LinkedIn when someone opens Posts after their time, or by the daily run */
      if (dueForLinkedIn(list).length) shareDue().catch(() => {});
    }, () => setPosts([]));
  }, []);

  if (!can(role, "content.read")) return <div className="notice">Your role does not include the blog.</div>;

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

  const rows = (posts || []).map((p) => ({ ...p, status: postStatus(p) }));
  const count = (k) => rows.filter((p) => (k === "live" ? p.status.key === "live" || p.status.key === "changed" : p.status.key === k)).length;
  const shown = filter === "all" ? rows : rows.filter((p) => (filter === "live" ? p.status.key === "live" || p.status.key === "changed" : p.status.key === filter));

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Blog</p>
          <h1>Posts</h1>
          <p>Write, schedule and publish posts on digitorium.in/blog/.</p>
        </div>
        <div className="actions">
          <a className="btn" href={SITE_URL + "/blog/"} target="_blank" rel="noreferrer">
            Open the blog <Icon name="external" />
          </a>
          {can(role, "content.edit") ? (
            <button className="btn btn--solid" onClick={newPost} disabled={busy}>
              <Icon name="plus" /> New post
            </button>
          ) : null}
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
        {!posts ? (
          <div className="spinner" aria-label="Loading" />
        ) : !shown.length ? (
          <div className="empty">
            <Icon name="posts" />
            <p>{posts.length ? "No posts here." : "No posts yet. Start the first one."}</p>
          </div>
        ) : (
          <div className="list">
            {shown.map((p) => (
              <Link key={p.id} href={"/posts/" + p.id} className="row">
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
                <span className={"pill pill--" + (p.status.key === "live" ? "won" : p.status.key === "scheduled" ? "scheduled" : "new")}>{p.status.label}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

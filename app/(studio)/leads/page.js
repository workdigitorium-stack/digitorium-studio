"use client";
/* Leads inbox: every enquiry from the popup, contact form and discovery form. */
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import { can } from "@/lib/roles";
import { logActivity } from "@/lib/supabase";
import { fetchLeads, normalize, updateLead, deleteLead, STATUSES, SOURCES, sourceLabel, statusLabel } from "@/lib/leads";
import { dateTime, timeAgo, whatsappLink, toCSV, download } from "@/lib/format";

export default function LeadsPage() {
  return (
    <Suspense fallback={<div className="spinner" />}>
      <Leads />
    </Suspense>
  );
}

function Leads() {
  const { role, toast } = useStudio();
  const router = useRouter();
  const params = useSearchParams();
  const [leads, setLeads] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const status = params.get("status") || "all";
  const source = params.get("source") || "all";
  const openKey = params.get("open");

  const setParam = useCallback(
    (k, v) => {
      const p = new URLSearchParams(params.toString());
      if (v == null || v === "all") p.delete(k);
      else p.set(k, v);
      router.replace("/leads" + (p.toString() ? "?" + p : ""), { scroll: false });
    },
    [params, router],
  );

  const load = useCallback(async () => {
    try {
      setLeads(await fetchLeads());
      setError("");
    } catch (e) {
      setError(e.message || "Could not load leads.");
      setLeads([]);
    }
  }, []);

  useEffect(() => {
    load();
    const onLead = (e) => {
      const lead = normalize(e.detail.kind, e.detail.row);
      setLeads((ls) => (ls && !ls.some((l) => l.key === lead.key) ? [lead, ...ls] : ls));
    };
    window.addEventListener("studio:lead", onLead);
    return () => window.removeEventListener("studio:lead", onLead);
  }, [load]);

  const visible = useMemo(() => {
    if (!leads) return [];
    const needle = q.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (status === "all" || l.status === status) &&
        (source === "all" || l.source === source) &&
        (!needle || [l.name, l.phone, l.email, l.detail, l.notes, l.page].some((v) => (v || "").toLowerCase().includes(needle))),
    );
  }, [leads, q, status, source]);

  const counts = useMemo(() => {
    const c = { all: 0 };
    for (const l of leads || []) if (source === "all" || l.source === source) (c.all++, (c[l.status] = (c[l.status] || 0) + 1));
    return c;
  }, [leads, source]);

  const open = leads?.find((l) => l.key === openKey) || null;

  function patchLocal(key, patch) {
    setLeads((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function exportCSV() {
    const cols = [
      { label: "Received", get: (l) => dateTime(l.created_at) },
      { label: "Source", get: (l) => sourceLabel(l.source) },
      { label: "Status", get: (l) => statusLabel(l.status) },
      { label: "Name", get: (l) => l.name },
      { label: "Phone", get: (l) => l.phone },
      { label: "Email", get: (l) => l.email },
      { label: "Page", get: (l) => l.page },
      { label: "Details", get: (l) => l.detail },
      { label: "Notes", get: (l) => l.notes },
    ];
    download("digitorium-leads-" + new Date().toISOString().slice(0, 10) + ".csv", toCSV(visible, cols));
  }

  return (
    <div className={"leads" + (open ? " has-open" : "")}>
      <div className="page">
        <div className="pagehead">
          <div>
            <p className="eyebrow">Leads</p>
            <h1>All enquiries</h1>
            <p>Popup, contact form and discovery form, newest first.</p>
          </div>
          <div className="actions">
            <button className="btn" onClick={exportCSV} disabled={!visible.length}>
              <Icon name="download" /> Export CSV
            </button>
          </div>
        </div>

        <div className="toolbar">
          <label className="search">
            <Icon name="search" />
            <span className="sr">Search leads</span>
            <input className="input" placeholder="Search name, phone, email, notes" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select className="select" value={source} onChange={(e) => setParam("source", e.target.value)} aria-label="Source" style={{ minWidth: 170 }}>
            <option value="all">All sources</option>
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="chips" role="tablist" aria-label="Status">
          {[{ id: "all", label: "All" }, ...STATUSES].map((s) => (
            <button key={s.id} role="tab" aria-selected={status === s.id} className={"chip" + (status === s.id ? " on" : "")} onClick={() => setParam("status", s.id)}>
              {s.label}
              <b>{counts[s.id] || 0}</b>
            </button>
          ))}
        </div>

        {error ? <p className="notice notice--bad">{error}</p> : null}

        <section className="card" style={{ padding: "6px 14px" }}>
          {!leads ? (
            <div className="empty">
              <div className="spinner" />
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <Icon name="inbox" />
              <p>{leads.length ? "No leads match these filters." : "No leads yet. They arrive here the moment someone submits a form on the site."}</p>
            </div>
          ) : (
            <div className="list">
              {visible.map((l) => (
                <button key={l.key} className="row" onClick={() => setParam("open", l.key)} style={l.key === openKey ? { background: "var(--bg2)" } : null}>
                  {l.status === "new" ? <span className="unread" aria-label="New" /> : <span style={{ width: 8, flex: "none" }} />}
                  <div className="avatar">{(l.name || "?").charAt(0).toUpperCase()}</div>
                  <div className="grow">
                    <div className="title">
                      {l.name}
                      {l.business ? <span className="muted" style={{ fontWeight: 400 }}> · {l.business}</span> : null}
                    </div>
                    <div className="sub">
                      {sourceLabel(l.source)}
                      {l.source === "popup" && l.page ? " · " + l.page : ""}
                      {l.source === "contact" && l.detail ? " · " + l.detail : ""} · {timeAgo(l.created_at)}
                    </div>
                  </div>
                  <span className={"pill pill--" + l.status}>{statusLabel(l.status)}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {open ? (
        <LeadDetail
          key={open.key}
          lead={open}
          canManage={can(role, "leads.manage")}
          onClose={() => setParam("open", null)}
          onChange={(patch) => patchLocal(open.key, patch)}
          onDeleted={() => {
            setLeads((ls) => ls.filter((l) => l.key !== open.key));
            setParam("open", null);
            toast("Lead deleted");
          }}
        />
      ) : null}
    </div>
  );
}

function LeadDetail({ lead, canManage, onClose, onChange, onDeleted }) {
  const { email, toast } = useStudio();
  const [notes, setNotes] = useState(lead.notes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function setStatus(s) {
    if (s === lead.status) return;
    const before = lead.status;
    onChange({ status: s });
    try {
      await updateLead(lead, { status: s }, email);
      logActivity("lead.status", lead.name + " → " + statusLabel(s));
      window.dispatchEvent(new Event("studio:leads-changed"));
    } catch (e) {
      onChange({ status: before });
      toast("Could not update: " + e.message, { bad: true });
    }
  }

  async function saveNotes() {
    setSaving(true);
    try {
      await updateLead(lead, { notes }, email);
      onChange({ notes });
      logActivity("lead.notes", lead.name);
      toast("Notes saved");
    } catch (e) {
      toast("Could not save notes: " + e.message, { bad: true });
    }
    setSaving(false);
  }

  async function remove() {
    if (!confirm("Delete this lead for good? This cannot be undone.")) return;
    try {
      await deleteLead(lead);
      logActivity("lead.delete", lead.name);
      window.dispatchEvent(new Event("studio:leads-changed"));
      onDeleted();
    } catch (e) {
      toast("Could not delete: " + e.message, { bad: true });
    }
  }

  const first = (lead.name || "").split(" ")[0];
  const waText = "Hi " + first + ", this is Digitorium. Thanks for getting in touch.";

  return (
    <aside className="lead-detail" aria-label={"Lead: " + lead.name}>
      <div className="sheethead">
        <div>
          <p className="eyebrow">{sourceLabel(lead.source)}</p>
          <h2 style={{ fontSize: 20 }}>{lead.name}</h2>
          <p className="small muted">{dateTime(lead.created_at)}</p>
        </div>
        <button className="btn btn--icon" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>

      <div className="contact-actions">
        <a className="btn" href={lead.phone ? "tel:" + lead.phone : undefined} aria-disabled={!lead.phone}>
          <Icon name="phone" /> Call
        </a>
        <a className="btn" href={lead.phone ? whatsappLink(lead.phone, waText) : undefined} target="_blank" rel="noreferrer" aria-disabled={!lead.phone}>
          <Icon name="whatsapp" /> WhatsApp
        </a>
        <a className="btn" href={lead.email ? "mailto:" + lead.email : undefined} aria-disabled={!lead.email}>
          <Icon name="mail" /> Email
        </a>
      </div>

      <div>
        <p className="small" style={{ fontWeight: 500, marginBottom: 6 }}>
          Status
        </p>
        <div className="statusbar">
          {STATUSES.map((s) => (
            <button key={s.id} className={s.id + (lead.status === s.id ? " on" : "")} onClick={() => setStatus(s.id)} disabled={!canManage}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="kv">
        <dt>Phone</dt>
        <dd>{lead.phone || "–"}</dd>
        <dt>Email</dt>
        <dd>{lead.email || "–"}</dd>
        {lead.page ? (
          <>
            <dt>Page</dt>
            <dd>{lead.page}</dd>
          </>
        ) : null}
        {lead.detail ? (
          <>
            <dt>{lead.source === "discovery" ? "Business" : "Interested in"}</dt>
            <dd>{lead.detail}</dd>
          </>
        ) : null}
        {lead.updated_by ? (
          <>
            <dt>Last update</dt>
            <dd>
              {lead.updated_by.split("@")[0]}, {timeAgo(lead.updated_at)}
            </dd>
          </>
        ) : null}
      </dl>

      <label className="field">
        <span>Notes</span>
        <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Call summary, budget, next step…" disabled={!canManage} maxLength={4000} />
      </label>
      {canManage ? (
        <div className="btnrow">
          <button className="btn btn--solid" onClick={saveNotes} disabled={saving || notes === lead.notes}>
            {saving ? "Saving…" : "Save notes"}
          </button>
          <button className="btn btn--danger" onClick={remove} style={{ marginLeft: "auto" }}>
            <Icon name="trash" /> Delete
          </button>
        </div>
      ) : (
        <p className="small muted">Viewers can read leads but not change them.</p>
      )}

      {lead.answers?.length ? (
        <div className="answers">
          {lead.answers.map((s) => (
            <section key={s.title}>
              <h4>{s.title}</h4>
              <dl>
                {s.items.map((x) => (
                  <div key={x.q}>
                    <dt>{x.q}</dt>
                    <dd>{x.a}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : null}
    </aside>
  );
}

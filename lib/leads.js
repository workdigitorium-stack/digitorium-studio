/* Leads come from two tables on the live site:
     public.leads                  the lead popup and the contact form (/api/lead)
     public.client_questionnaires  the private client discovery form
   This file reads both and turns them into one list for the inbox. */
import { supabase } from "./supabase";
import { SECTIONS } from "./questions";

export const STATUSES = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export const SOURCES = [
  { id: "popup", label: "Lead popup" },
  { id: "contact", label: "Contact form" },
  { id: "discovery", label: "Discovery form" },
];

const TABLE = { lead: "leads", questionnaire: "client_questionnaires" };

/* The contact form saves page as "/contact/ <service>"; everything else is the popup. */
function leadSource(row) {
  return /^\/contact\b/.test(row.page || "") ? "contact" : "popup";
}

function fromLead(r) {
  const source = leadSource(r);
  return {
    key: "lead:" + r.id,
    kind: "lead",
    id: r.id,
    source,
    name: r.name,
    phone: r.phone,
    email: r.email,
    page: source === "contact" ? "/contact/" : r.page,
    detail: source === "contact" ? (r.page || "").replace(/^\/contact\/?\s*/, "") : "",
    status: r.status,
    notes: r.notes || "",
    created_at: r.created_at,
    updated_at: r.updated_at,
    updated_by: r.updated_by,
  };
}

function fromQuestionnaire(r) {
  const answers = [];
  for (const s of SECTIONS) {
    const qs = s.questions.filter((q) => r[q.col]).map((q) => ({ q: q.q, a: r[q.col] }));
    if (qs.length) answers.push({ title: s.title, items: qs });
  }
  return {
    key: "questionnaire:" + r.id,
    kind: "questionnaire",
    id: r.id,
    source: "discovery",
    name: r.contact_name,
    phone: r.phone,
    email: r.email,
    page: null,
    detail: [r.business_name, r.business_category, r.location].filter(Boolean).join(" · "),
    business: r.business_name,
    answers,
    status: r.status,
    notes: r.notes || "",
    created_at: r.created_at,
    updated_at: r.updated_at,
    updated_by: r.updated_by,
  };
}

export async function fetchLeads({ since, limit = 500 } = {}) {
  const db = supabase();
  let a = db.from("leads").select("*").order("created_at", { ascending: false }).limit(limit);
  let b = db.from("client_questionnaires").select("*").order("created_at", { ascending: false }).limit(limit);
  if (since) {
    a = a.gte("created_at", since);
    b = b.gte("created_at", since);
  }
  const [ra, rb] = await Promise.all([a, b]);
  if (ra.error) throw ra.error;
  if (rb.error) throw rb.error;
  return [...ra.data.map(fromLead), ...rb.data.map(fromQuestionnaire)].sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
}

export function normalize(kind, row) {
  return kind === "lead" ? fromLead(row) : fromQuestionnaire(row);
}

export async function updateLead(lead, patch, by) {
  const { error } = await supabase()
    .from(TABLE[lead.kind])
    .update({ ...patch, updated_at: new Date().toISOString(), updated_by: by })
    .eq("id", lead.id);
  if (error) throw error;
}

export async function deleteLead(lead) {
  const { error } = await supabase().from(TABLE[lead.kind]).delete().eq("id", lead.id);
  if (error) throw error;
}

export function sourceLabel(id) {
  return (SOURCES.find((s) => s.id === id) || { label: id }).label;
}
export function statusLabel(id) {
  return (STATUSES.find((s) => s.id === id) || { label: id }).label;
}

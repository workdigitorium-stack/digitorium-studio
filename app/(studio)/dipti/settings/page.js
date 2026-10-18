"use client";
/* Dipti Enterprise site details: contact, WhatsApp and page text.
   All of it lives in one record, de_content key "site". */
import { useEffect, useState } from "react";
import { useStudio } from "@/components/StudioProvider";
import { db, saved } from "@/lib/dipti";

/* [path, label, type]. type: text | area | lines (one item per line) | number */
const SECTIONS = [
  {
    title: "Contact details",
    open: true,
    fields: [
      ["contact.phone_display", "Phone number (as shown)", "text"],
      ["contact.email", "Email", "text"],
      ["contact.address", "Address", "area"],
      ["contact.maps_link", "Google Maps link", "text"],
      ["contact.maps_embed_query", "Map search name (what the map on the Contact page looks up)", "text"],
    ],
  },
  {
    title: "WhatsApp",
    open: true,
    fields: [
      ["whatsapp.number", "WhatsApp number with country code, digits only (e.g. 919898208598)", "text"],
      ["whatsapp.general_message", "Message typed for the visitor when they tap WhatsApp", "area"],
      ["whatsapp.button_text", "Button text on product pages", "text"],
    ],
  },
  {
    title: "Home page",
    fields: [
      ["tagline", "Line above the main heading", "text"],
      ["home.hero_title", "Main heading", "text"],
      ["home.hero_subtitle", "Text under the heading", "area"],
      ["home.marquee", "Moving red strip", "text"],
      ["home.intro_title", "Introduction heading", "text"],
      ["home.intro_text", "Introduction text", "area"],
      ["home.products_title", "Products heading", "text"],
      ["home.trust_title", "Trust section heading", "text"],
      ["home.trust_points.0.title", "Trust point 1", "text"],
      ["home.trust_points.1.title", "Trust point 2", "text"],
      ["home.trust_points.2.title", "Trust point 3", "text"],
      ["home.trust_points.3.title", "Trust point 4", "text"],
    ],
  },
  {
    title: "About page",
    fields: [
      ["about.title", "Heading", "text"],
      ["about.intro", "Introduction", "area"],
      ["about.stats.0.value", "Number 1", "number"],
      ["about.stats.0.suffix", "Number 1 ending (e.g. +)", "text"],
      ["about.stats.0.label", "Number 1 label", "text"],
      ["about.stats.1.value", "Number 2", "number"],
      ["about.stats.1.suffix", "Number 2 ending (e.g. k+)", "text"],
      ["about.stats.1.label", "Number 2 label", "text"],
      ["about.collection", "Our collection (one per line)", "lines"],
      ["about.guarantees.0.title", "Guarantee 1", "text"],
      ["about.guarantees.0.text", "Guarantee 1 text", "text"],
      ["about.guarantees.1.title", "Guarantee 2", "text"],
      ["about.guarantees.1.text", "Guarantee 2 text", "text"],
      ["about.guarantees.2.title", "Guarantee 3", "text"],
      ["about.guarantees.2.text", "Guarantee 3 text", "text"],
      ["about.vision", "Our vision", "area"],
      ["about.mission", "Our mission", "area"],
      ["services", "What we do (one per line)", "lines"],
    ],
  },
  {
    title: "Footer",
    fields: [
      ["footer_cta.title", "Red box heading", "text"],
      ["footer_text", "Footer text", "area"],
    ],
  },
  {
    title: "Google",
    fields: [
      ["seo.default_title", "Title in Google results (about 60 letters)", "text"],
      ["seo.default_description", "Description in Google results (about 155 letters)", "area"],
    ],
  },
];

function get(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setIn(obj, path, value) {
  const keys = path.split(".");
  const root = structuredClone(obj);
  let o = root;
  keys.slice(0, -1).forEach((k, i) => {
    if (o[k] == null) o[k] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    o = o[k];
  });
  o[keys.at(-1)] = value;
  return root;
}

export default function SiteDetails() {
  const { toast } = useStudio();
  const [data, setData] = useState(null);
  const [orig, setOrig] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db()
      .from("de_content")
      .select("data")
      .eq("key", "site")
      .maybeSingle()
      .then(({ data: row, error }) => {
        if (error) toast("Could not load: " + error.message, { bad: true });
        setData(row?.data || {});
        setOrig(row?.data || {});
      });
  }, [toast]);

  if (!data)
    return (
      <div className="empty">
        <div className="spinner" />
      </div>
    );

  const dirty = JSON.stringify(data) !== JSON.stringify(orig);

  function change(path, type, raw) {
    let v = raw;
    if (type === "lines") v = raw.split("\n");
    if (type === "number") v = raw === "" ? 0 : Number(raw.replace(/[^\d.]/g, ""));
    setData((d) => setIn(d, path, v));
  }

  async function save() {
    let next = structuredClone(data);
    /* tidy lists and keep the phone link in step with the shown number */
    for (const s of SECTIONS) for (const [path, , type] of s.fields) if (type === "lines") next = setIn(next, path, (get(next, path) || []).map((x) => x.trim()).filter(Boolean));
    const digits = (get(next, "contact.phone_display") || "").replace(/[^\d+]/g, "");
    if (digits) next = setIn(next, "contact.phone_tel", digits.startsWith("+") ? digits : "+" + digits);
    next = setIn(next, "whatsapp.number", (get(next, "whatsapp.number") || "").replace(/\D/g, ""));
    if (!/^\d{10,15}$/.test(get(next, "whatsapp.number"))) return toast("Check the WhatsApp number: country code and number, digits only.", { bad: true });
    setBusy(true);
    const res = await db().from("de_content").update({ data: next }).eq("key", "site");
    await saved(res, "dipti.site.edit", "site details", toast);
    setBusy(false);
    if (!res.error) {
      setData(next);
      setOrig(next);
    }
  }

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="pagehead">
        <div>
          <p className="eyebrow">Dipti Enterprise</p>
          <h1>Site details</h1>
          <p>Phone, WhatsApp, address and the text on each page.</p>
        </div>
      </div>

      {SECTIONS.map((s) => (
        <details key={s.title} className="card sect" open={s.open}>
          <summary>
            <h2>{s.title}</h2>
          </summary>
          <div className="formgrid" style={{ marginTop: 12 }}>
            {s.fields.map(([path, label, type]) => {
              const v = get(data, path);
              const value = type === "lines" ? (v || []).join("\n") : v ?? "";
              return (
                <label key={path} className="field">
                  <span>{label}</span>
                  {type === "area" || type === "lines" ? (
                    <textarea className="textarea" value={value} onChange={(e) => change(path, type, e.target.value)} rows={type === "lines" ? 6 : 3} />
                  ) : (
                    <input className="input" inputMode={type === "number" ? "numeric" : undefined} value={value} onChange={(e) => change(path, type, e.target.value)} />
                  )}
                </label>
              );
            })}
          </div>
        </details>
      ))}

      <div className="savebar">
        <span className="grow">{dirty ? "You have unsaved changes." : "All changes saved."}</span>
        <button type="button" className="btn btn--solid" onClick={save} disabled={busy || !dirty}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

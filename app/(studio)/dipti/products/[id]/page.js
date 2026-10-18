"use client";
/* One Dipti Enterprise product: details, price, photos, description.
   /dipti/products/new adds a product. */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useStudio } from "@/components/StudioProvider";
import Icon from "@/components/Icon";
import RichEditor from "@/components/RichEditor";
import { can } from "@/lib/roles";
import { db, friendly, imgUrl, price, saved, slugify, SITE, uploadImage } from "@/lib/dipti";

const EMPTY = {
  name: "",
  slug: "",
  model: "",
  category: "",
  price_inr: null,
  short_description: "",
  description_html: "",
  images: [],
  active: true,
  featured: false,
};

export default function ProductEditor() {
  const { id } = useParams();
  const isNew = id === "new";
  const router = useRouter();
  const { role, toast } = useStudio();
  const [p, setP] = useState(null);
  const [orig, setOrig] = useState(null);
  const [cats, setCats] = useState([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [priceText, setPriceText] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef(null);

  useEffect(() => {
    db()
      .from("de_categories")
      .select("slug,name")
      .order("sort")
      .then(({ data }) => setCats(data || []));
    if (isNew) {
      setP(EMPTY);
      setOrig(EMPTY);
      return;
    }
    db()
      .from("de_products")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          toast(error ? friendly(error.message) : "That product no longer exists.", { bad: true });
          return router.replace("/dipti/products");
        }
        setP(data);
        setOrig(data);
        setSlugTouched(true);
        setPriceText(data.price_inr == null ? "" : String(data.price_inr));
      });
  }, [id, isNew, router, toast]);

  useEffect(() => {
    if (isNew && p && !p.category && cats.length) setP((x) => ({ ...x, category: cats[0].slug }));
  }, [cats, isNew, p]);

  const dirty = p && orig && JSON.stringify(p) !== JSON.stringify(orig);
  useEffect(() => {
    const warn = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!p)
    return (
      <div className="empty">
        <div className="spinner" />
      </div>
    );

  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  function setName(v) {
    setP((x) => ({ ...x, name: v, slug: slugTouched ? x.slug : slugify(v) }));
  }
  function setPrice(v) {
    const clean = v.replace(/[^\d]/g, "").slice(0, 8);
    setPriceText(clean);
    set("price_inr", clean === "" ? null : Number(clean));
  }

  async function addPhotos(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    setUploading(list.length);
    for (const f of list) {
      try {
        const img = await uploadImage(f, "products");
        setP((x) => ({ ...x, images: [...x.images, { ...img, alt: x.name }] }));
      } catch (e) {
        toast(friendly(e.message), { bad: true });
      }
      setUploading((n) => n - 1);
    }
  }
  function moveImg(i, d) {
    const j = i + d;
    if (j < 0 || j >= p.images.length) return;
    const next = [...p.images];
    [next[i], next[j]] = [next[j], next[i]];
    set("images", next);
  }
  function removeImg(i) {
    set(
      "images",
      p.images.filter((_, k) => k !== i),
    );
  }

  async function save() {
    const name = p.name.trim();
    const slug = slugify(p.slug);
    if (!name) return toast("Give the product a name.", { bad: true });
    if (!slug) return toast("Give the product a web address.", { bad: true });
    if (!p.category) return toast("Choose a category.", { bad: true });
    const row = {
      name,
      slug,
      model: p.model?.trim() || null,
      category: p.category,
      price_inr: p.price_inr,
      short_description: p.short_description.trim(),
      description_html: p.description_html === "<p></p>" ? "" : p.description_html,
      images: p.images.map((im) => ({ src: im.src, width: im.width, height: im.height, alt: (im.alt || name).slice(0, 160) })),
      active: p.active,
      featured: p.featured,
    };
    setBusy(true);
    let res;
    if (isNew) {
      const { data: last } = await db().from("de_products").select("sort").order("sort", { ascending: false }).limit(1);
      row.sort = (last?.[0]?.sort ?? 0) + 10;
      res = await db().from("de_products").insert(row).select().single();
    } else {
      res = await db().from("de_products").update(row).eq("id", p.id).select().single();
    }
    await saved(res, isNew ? "dipti.product.add" : "dipti.product.edit", name, toast);
    setBusy(false);
    if (res.error) return;
    setP(res.data);
    setOrig(res.data);
    setPriceText(res.data.price_inr == null ? "" : String(res.data.price_inr));
    if (isNew) router.replace("/dipti/products/" + res.data.id);
  }

  async function remove() {
    if (!confirm("Delete " + (p.name || "this product") + " for good? To take it off the website for now, untick 'Show on the website' instead.")) return;
    setBusy(true);
    const res = await db().from("de_products").delete().eq("id", p.id);
    await saved(res, "dipti.product.delete", p.name, toast);
    setBusy(false);
    if (!res.error) router.replace("/dipti/products");
  }

  const slugChanged = !isNew && orig && slugify(p.slug) !== orig.slug;

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="pagehead">
        <div>
          <Link href="/dipti/products" className="small">
            ← All products
          </Link>
          <h1 style={{ marginTop: 6 }}>{isNew ? "Add a product" : orig?.name || "Product"}</h1>
          <p>{isNew ? "Fill in the details and add at least one photo." : price(orig?.price_inr) + (orig?.active ? "" : " · hidden from the website")}</p>
        </div>
        {!isNew && orig?.active ? (
          <div className="actions">
            <a className="btn" href={SITE + "/products/" + orig.slug} target="_blank" rel="noreferrer">
              View on website <Icon name="external" />
            </a>
          </div>
        ) : null}
      </div>

      <section className="card">
        <h2>Details</h2>
        <div className="formgrid">
          <label className="field">
            <span>Product name</span>
            <input className="input" value={p.name} onChange={(e) => setName(e.target.value)} maxLength={160} placeholder="e.g. Staff Chair DE180" />
          </label>
          <div className="grid2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <label className="field">
              <span>Model number (optional)</span>
              <input className="input" value={p.model || ""} onChange={(e) => set("model", e.target.value)} maxLength={60} placeholder="e.g. DE180" />
            </label>
            <label className="field">
              <span>Category</span>
              <select className="select" value={p.category} onChange={(e) => set("category", e.target.value)}>
                {cats.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Price in ₹ (leave empty to show "Price on request")</span>
            <input className="input" inputMode="numeric" value={priceText} onChange={(e) => setPrice(e.target.value)} placeholder="Price on request" />
            {p.price_inr != null ? <span className="tiny muted">Shows on the website as {price(p.price_inr)}</span> : null}
          </label>
          <label className="field">
            <span>Short description (shown at the top of the product page and in Google)</span>
            <textarea className="textarea" value={p.short_description} onChange={(e) => set("short_description", e.target.value)} maxLength={1000} placeholder="One or two lines, or one feature per line" />
          </label>
        </div>
      </section>

      <section className="card">
        <div>
          <h2>Photos</h2>
          <p className="small muted">The first photo is the main one. Square photos on a plain background look best.</p>
        </div>
        <div className="imgrid">
          {p.images.map((im, i) => (
            <div key={im.src + i} className="imgcell">
              <div className="pic">
                <img src={imgUrl(im.src)} alt={im.alt || ""} />
                {i === 0 ? <span className="pill pill--new">Main</span> : null}
              </div>
              <div className="tools">
                <button type="button" className="btn btn--sm btn--icon" onClick={() => moveImg(i, -1)} disabled={i === 0} aria-label="Move earlier">
                  <Icon name="back" />
                </button>
                <button type="button" className="btn btn--sm btn--icon btn--danger" onClick={() => removeImg(i)} aria-label="Remove photo">
                  <Icon name="trash" />
                </button>
                <button type="button" className="btn btn--sm btn--icon" onClick={() => moveImg(i, 1)} disabled={i === p.images.length - 1} aria-label="Move later">
                  <Icon name="back" style={{ transform: "rotate(180deg)" }} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="adddrop" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? <div className="spinner" /> : <Icon name="upload" />}
            {uploading > 0 ? "Uploading " + uploading + "…" : "Add photos"}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => (addPhotos(e.target.files), (e.target.value = ""))} />
        </div>
      </section>

      <section className="card">
        <div>
          <h2>Full description</h2>
          <p className="small muted">Features, materials, sizes. Shown under "Product details".</p>
        </div>
        <RichEditor value={p.description_html || ""} onChange={(v) => set("description_html", v)} toast={toast} html noImages />
      </section>

      <section className="card">
        <h2>On the website</h2>
        <label className="check">
          <input type="checkbox" checked={p.active} onChange={(e) => set("active", e.target.checked)} />
          <span>
            Show on the website
            <span className="tiny muted" style={{ display: "block" }}>Untick to hide it without deleting.</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={p.featured} onChange={(e) => set("featured", e.target.checked)} />
          <span>
            Show on the home page
            <span className="tiny muted" style={{ display: "block" }}>The home page shows up to 8 of these.</span>
          </span>
        </label>
        <details className="sect">
          <summary className="small">Web address</summary>
          <div className="slugline" style={{ marginTop: 10 }}>
            <span>diptienterprise.com/products/</span>
            <input
              value={p.slug}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
              }}
              aria-label="Web address"
            />
          </div>
          {slugChanged ? <p className="notice notice--warn small" style={{ marginTop: 10 }}>Changing the address breaks old links to this product, including any shared on WhatsApp or Google.</p> : null}
        </details>
      </section>

      <div className="savebar">
        <span className="grow">{dirty ? "You have unsaved changes." : isNew ? "" : "All changes saved."}</span>
        {!isNew && can(role, "dipti.delete") ? (
          <button type="button" className="btn btn--danger" onClick={remove} disabled={busy}>
            <Icon name="trash" /> Delete
          </button>
        ) : null}
        <button type="button" className="btn btn--solid" onClick={save} disabled={busy || uploading > 0 || (!dirty && !isNew)}>
          {busy ? "Saving…" : isNew ? "Add product" : "Save"}
        </button>
      </div>
    </div>
  );
}

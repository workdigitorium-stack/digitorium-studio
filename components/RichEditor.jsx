"use client";
/* The post editor: Tiptap with a small toolbar. It saves JSON
   (editor.getJSON()), which the website draws with app/blog/RichText.jsx,
   so only what that file knows how to draw belongs here: headings 2 to 3,
   bold, italic, underline, strike, links, lists, quotes, dividers and
   pictures. */
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { uploadSiteImage } from "@/lib/content";
import { logActivity } from "@/lib/supabase";

const T = {
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z",
  italic: "M10 5h8M6 19h8M14 5l-4 14",
  underline: "M7 4v7a5 5 0 0 0 10 0V4M5 20h14",
  strike: "M5 12h14M16 7a4 3 0 0 0-8 0c0 4 8 3 8 7a4 3 0 0 1-8 0",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  bullet: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  ordered: "M10 6h10M10 12h10M10 18h10M4 5h1v4M4 9h2M4 15h2l-2 3h2",
  quote: "M5 10a3 3 0 0 1 3-3v3H5v5h4v-5M14 10a3 3 0 0 1 3-3v3h-3v5h4v-5",
  rule: "M4 12h16",
  image: "M4 5h16v14H4zM4 15l4.5-4.5 4 4 3-3L20 16M15.5 9.5h.01",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  redo: "M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",
};

function Btn({ icon, label, on, disabled, onClick, text }) {
  return (
    <button type="button" className={"rtb" + (on ? " on" : "")} aria-label={label} title={label} aria-pressed={!!on} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {text ? <b>{text}</b> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={T[icon]} /></svg>}
    </button>
  );
}

/* html: emit HTML instead of JSON (client sites store HTML).
   noImages: hide the picture button (client logins cannot use the site media bucket). */
export default function RichEditor({ value, onChange, readOnly, toast, html, noImages }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", protocols: ["mailto", "tel"] },
      }),
      Image.configure({ allowBase64: false }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(html ? editor.getHTML() : editor.getJSON()),
  });

  useEffect(() => {
    /* false: toggling editable is not an edit, so do not fire onUpdate */
    if (editor) editor.setEditable(!readOnly, false);
  }, [editor, readOnly]);

  if (!editor) return <div className="rte rte--loading" />;
  const c = () => editor.chain().focus();

  function setLink() {
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("Link to (a page like /contact/, or https://…). Leave empty to remove the link.", prev);
    if (url === null) return;
    if (!url.trim()) return c().extendMarkRange("link").unsetLink().run();
    const href = url.trim();
    if (!/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href)) return toast("Links start with / for a page on the site, or https:// for another site.", { bad: true });
    c().extendMarkRange("link").setLink({ href }).run();
  }

  async function addImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return toast("Choose a JPG, PNG or WebP picture.", { bad: true });
    if (file.size > 8 * 1024 * 1024) return toast("That picture is over 8 MB. Make it smaller first.", { bad: true });
    const alt = window.prompt("Describe the picture in a few words (read out to people who cannot see it):", "") || "";
    setBusy(true);
    try {
      const src = await uploadSiteImage(file);
      logActivity("media.upload", "post picture " + file.name, { size: file.size });
      c().setImage({ src, alt }).run();
    } catch (err) {
      toast("Upload failed: " + err.message, { bad: true });
    } finally {
      setBusy(false);
    }
  }

  const block = editor.isActive("heading", { level: 2 }) ? "h2" : editor.isActive("heading", { level: 3 }) ? "h3" : "p";

  return (
    <div className={"rte" + (readOnly ? " is-readonly" : "")}>
      {!readOnly ? (
        <div className="rte__bar" role="toolbar" aria-label="Formatting">
          <select
            className="rte__block"
            value={block}
            aria-label="Text style"
            onChange={(e) => {
              const v = e.target.value;
              if (v === "p") c().setParagraph().run();
              else c().setHeading({ level: v === "h2" ? 2 : 3 }).run();
            }}
          >
            <option value="p">Text</option>
            <option value="h2">Heading</option>
            <option value="h3">Subheading</option>
          </select>
          <Btn icon="bold" label="Bold" on={editor.isActive("bold")} onClick={() => c().toggleBold().run()} />
          <Btn icon="italic" label="Italic" on={editor.isActive("italic")} onClick={() => c().toggleItalic().run()} />
          <Btn icon="underline" label="Underline" on={editor.isActive("underline")} onClick={() => c().toggleUnderline().run()} />
          <Btn icon="strike" label="Strike through" on={editor.isActive("strike")} onClick={() => c().toggleStrike().run()} />
          <Btn icon="link" label="Link" on={editor.isActive("link")} onClick={setLink} />
          <span className="rte__sep" />
          <Btn icon="bullet" label="Bulleted list" on={editor.isActive("bulletList")} onClick={() => c().toggleBulletList().run()} />
          <Btn icon="ordered" label="Numbered list" on={editor.isActive("orderedList")} onClick={() => c().toggleOrderedList().run()} />
          <Btn icon="quote" label="Quote" on={editor.isActive("blockquote")} onClick={() => c().toggleBlockquote().run()} />
          <Btn icon="rule" label="Divider" onClick={() => c().setHorizontalRule().run()} />
          {!noImages ? (
            <>
              <Btn icon="image" label={busy ? "Uploading…" : "Picture"} disabled={busy} onClick={() => fileRef.current?.click()} />
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden onChange={addImage} />
            </>
          ) : null}
          <span className="rte__sep" />
          <Btn icon="undo" label="Undo" disabled={!editor.can().undo()} onClick={() => c().undo().run()} />
          <Btn icon="redo" label="Redo" disabled={!editor.can().redo()} onClick={() => c().redo().run()} />
        </div>
      ) : null}
      <EditorContent editor={editor} className="rte__doc" />
    </div>
  );
}

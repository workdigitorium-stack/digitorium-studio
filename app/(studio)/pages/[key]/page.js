"use client";
/* Pages → any page other than Home: every text, picture and link on it.
   The fields come from lib/site-pages (see pageDef in lib/content.js). */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useStudio } from "@/components/StudioProvider";
import ContentEditor from "@/components/ContentEditor";
import { pageDef } from "@/lib/content";
import { can } from "@/lib/roles";

export default function SitePage() {
  const { key } = useParams();
  const { role } = useStudio();
  const [def, setDef] = useState(undefined);

  useEffect(() => {
    setDef(undefined);
    pageDef(key).then(setDef, () => setDef(null));
  }, [key]);

  if (!can(role, "content.read")) return <div className="notice">Your role does not include editing the site.</div>;
  if (def === null) {
    return (
      <div className="notice">
        There is no page called “{key}”. <Link href="/pages">Back to Pages</Link>
      </div>
    );
  }
  if (!def) {
    return (
      <div className="splash" style={{ minHeight: "40dvh" }}>
        <div className="spinner" aria-label="Loading" />
      </div>
    );
  }
  return <ContentEditor key={def.key} def={def} />;
}

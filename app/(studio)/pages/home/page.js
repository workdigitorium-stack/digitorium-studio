"use client";
/* Pages → Home. The form itself is described in lib/content.js. */
import { useStudio } from "@/components/StudioProvider";
import ContentEditor from "@/components/ContentEditor";
import { DOCS } from "@/lib/content";
import { can } from "@/lib/roles";

export default function HomePage() {
  const { role } = useStudio();
  if (!can(role, "content.read")) return <div className="notice">Your role does not include editing the site.</div>;
  return <ContentEditor def={DOCS.home} />;
}

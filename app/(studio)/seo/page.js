"use client";
/* SEO: titles, descriptions, share pictures, hide-from-Google and redirects.
   Owners and admins edit; editors can look. See SEO in lib/content.js. */
import { useStudio } from "@/components/StudioProvider";
import ContentEditor from "@/components/ContentEditor";
import { SEO } from "@/lib/content";
import { can } from "@/lib/roles";

export default function SeoPage() {
  const { role } = useStudio();
  if (!can(role, "content.read")) return <div className="notice">Your role does not include editing the site.</div>;
  return <ContentEditor def={SEO} />;
}

"use client";
/* Posts → one post. See components/PostEditor.jsx. */
import { useParams } from "next/navigation";
import { useStudio } from "@/components/StudioProvider";
import PostEditor from "@/components/PostEditor";
import { can } from "@/lib/roles";

export default function PostPage() {
  const { id } = useParams();
  const { role } = useStudio();
  if (!can(role, "content.read")) return <div className="notice">Your role does not include the blog.</div>;
  return <PostEditor key={id} id={id} />;
}

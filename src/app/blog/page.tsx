import type { Metadata } from "next";
import { BlogIndexClient } from "@/components/BlogIndexClient";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Practical guides on C2PA Content Credentials, SynthID, honest AI disclosure, and social platform labelling rules.",
  alternates: {
    canonical: "/blog",
  },
};

export default function BlogIndexPage() {
  return <BlogIndexClient />;
}

import { notFound } from "next/navigation";

export function generateMetadata() {
  return {
    title: "Page introuvable — JobCCQc",
    robots: { index: false, follow: false },
  };
}

export default function AdminPage() {
  notFound();
}

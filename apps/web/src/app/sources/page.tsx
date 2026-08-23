import type { Metadata } from "next";
import { SourcesView } from "@/components/SourcesView";

export const metadata: Metadata = {
  title: "Sources — JobCCQc",
  description: "Le répertoire des sites d'emploi surveillés par JobCCQc.",
};

export default function SourcesPage() {
  return <SourcesView />;
}

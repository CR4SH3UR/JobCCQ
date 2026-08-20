import type { Metadata } from "next";
import { SourcesView } from "@/components/SourcesView";

export const metadata: Metadata = {
  title: "Sources — JobCCQ",
  description: "Le répertoire des sites d'emploi surveillés par JobCCQ.",
};

export default function SourcesPage() {
  return <SourcesView />;
}

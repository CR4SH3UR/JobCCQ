import type { Metadata } from "next";
import { ResetPasswordView } from "@/components/ResetPasswordView";

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe — JobCCQc",
  robots: { index: false, follow: false },
};

export default function ReinitialiserPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
        Réinitialiser le mot de passe
      </h1>
      <ResetPasswordView />
    </div>
  );
}

/**
 * Brouillons de relance (idée 105) selon le statut de candidature.
 */

export type FollowUpStatus = "a-postuler" | "postule" | "entrevue" | "refuse" | "accepte";

export interface FollowUpDraft {
  subject: string;
  body: string;
}

export function followUpEmailDraft(input: {
  status: FollowUpStatus | string;
  title: string;
  company: string;
  url?: string;
  note?: string;
}): FollowUpDraft {
  const title = (input.title || "le poste").trim();
  const company = (input.company || "votre entreprise").trim();
  const note = (input.note ?? "").trim();
  const url = (input.url ?? "").trim();
  const line = url ? `\n\nOffre : ${url}` : "";
  const noteLine = note ? `\n\nNote perso : ${note}` : "";

  switch (input.status) {
    case "a-postuler":
      return {
        subject: `Candidature — ${title} chez ${company}`,
        body: `Bonjour,\n\nJe me permets de vous écrire au sujet du poste « ${title} » chez ${company}. Mon profil correspond au chantier / au besoin décrit, et je serais disponible pour en discuter.\n\nMerci,${line}${noteLine}`,
      };
    case "entrevue":
      return {
        subject: `Suivi d'entrevue — ${title}`,
        body: `Bonjour,\n\nMerci pour l'entrevue concernant « ${title} ». Je reste très intéressé et disponible pour la suite.\n\nCordialement,${line}${noteLine}`,
      };
    case "refuse":
      return {
        subject: `Suite de ma candidature — ${title}`,
        body: `Bonjour,\n\nMerci pour le retour concernant « ${title} ». Si un poste similaire s'ouvre, je serais heureux d'en être informé.\n\nCordialement,${line}${noteLine}`,
      };
    case "accepte":
      return {
        subject: `Confirmation — ${title} chez ${company}`,
        body: `Bonjour,\n\nJe confirme mon intérêt pour « ${title} » chez ${company} et reste disponible pour les prochaines étapes (documents, date d'entrée).\n\nCordialement,${line}${noteLine}`,
      };
    case "postule":
    default:
      return {
        subject: `Relance — ${title} chez ${company}`,
        body: `Bonjour,\n\nJ'ai postulé récemment au poste « ${title} » chez ${company} et je me permets de relancer pour confirmer que mon dossier est bien reçu.\n\nMerci,${line}${noteLine}`,
      };
  }
}

export function followUpMailto(draft: FollowUpDraft): string {
  const q = new URLSearchParams({ subject: draft.subject, body: draft.body });
  return `mailto:?${q.toString()}`;
}

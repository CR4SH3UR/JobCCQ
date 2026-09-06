/**
 * Rappels de candidature (date locale YYYY-MM-DD).
 * Partagé entre le site (bandeau « à faire ») et le cron de notification.
 */

/** Rappel échu (date locale YYYY-MM-DD ≤ aujourd'hui). */
export function isReminderDue(remindAt?: string | null, now = new Date()): boolean {
  const d = (remindAt ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const p = (n: number) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
  return d <= today;
}

/**
 * Faut-il envoyer une notif ? Échu, et pas déjà notifié pour cette date
 * de rappel (changer `remindAt` réarme l'envoi).
 */
export function reminderNeedsNotify(
  remindAt?: string | null,
  notifiedAt?: string | null,
  now = new Date(),
): boolean {
  if (!isReminderDue(remindAt, now)) return false;
  const dueDay = (remindAt ?? "").slice(0, 10);
  const notifiedDay = (notifiedAt ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(notifiedDay)) return true;
  return notifiedDay < dueDay;
}

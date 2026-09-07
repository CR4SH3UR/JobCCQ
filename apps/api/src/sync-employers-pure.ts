/**
 * Logique pure de sync employeurs (testable hors Prisma / réseau).
 */
export interface SyncableEmployer {
  id: string;
  name: string;
  homepage: string;
  careersUrl: string;
  method: string;
  careersUrl2?: string;
  method2?: string;
  region?: string;
  rbq?: string;
  scope?: string;
  sectors?: string[];
  verified?: boolean;
  enabled?: boolean;
}

/**
 * Fiches git à créer en base : absentes, non désactivées, non ancrées
 * (supprimées/fusionnées), et dédupliquées par id.
 */
export function employersToInsert(
  fromGit: readonly SyncableEmployer[],
  existingIds: ReadonlySet<string>,
  retiredIds: ReadonlySet<string> = new Set(),
): SyncableEmployer[] {
  const seen = new Set<string>();
  return fromGit.filter((e) => {
    if (existingIds.has(e.id) || retiredIds.has(e.id) || e.enabled === false || seen.has(e.id)) {
      return false;
    }
    seen.add(e.id);
    return true;
  });
}

export function toEmployerRow(e: SyncableEmployer) {
  return {
    id: e.id,
    name: e.name,
    homepage: e.homepage,
    careersUrl: e.careersUrl,
    method: e.method,
    careersUrl2: e.careersUrl2 ?? null,
    method2: e.method2 ?? null,
    region: e.region ?? null,
    rbq: e.rbq ?? null,
    scope: e.scope ?? null,
    sectors: JSON.stringify(e.sectors ?? []),
    verified: !!e.verified,
    enabled: e.enabled !== false,
  };
}

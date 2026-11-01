/**
 * Bandeau d'annonce du site (le mince bandeau en haut, « Version beta… »).
 *
 * La configuration vit dans `apps/web/src/data/banner.json`, **éditable depuis
 * la console d'administration** (onglet « Bandeau » → publie le fichier sur
 * GitHub → redéploiement). Elle est intégrée au bundle au build (repli
 * synchrone) et relue en direct depuis `main` (voir `banner-live.ts`).
 *
 * Les types et la validation sont dans `banner-parse.ts` (module pur, testable).
 */
import config from "@/data/banner.json";
import { readBannerConfig } from "./banner-parse.js";

export {
  BANNER_TONES,
  readBannerConfig,
  type BannerConfig,
  type BannerLink,
  type BannerTone,
} from "./banner-parse.js";

/** Config du bundle (repli synchrone au premier rendu). */
export const BANNER_CONFIG = readBannerConfig(config);

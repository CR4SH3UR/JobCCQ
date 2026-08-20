import { makeCareersScraper } from "./careers.js";

/**
 * Refrabec — réfractaire et maçonnerie industrielle (construction).
 * Page carrières : JSON-LD → Wix → titres → liens (repli automatique).
 */
export const refrabecScraper = makeCareersScraper({
  id: "refrabec",
  company: "Refrabec",
  careersUrl: "https://refrabec.qc.ca/carrieres/",
});

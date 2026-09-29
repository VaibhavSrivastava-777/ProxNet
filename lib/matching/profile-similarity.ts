/**
 * Profile Cosine Similarity & Match Engine
 * Computes cosine similarity between user profiles for Network tab matching.
 */

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  const raw = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  if (Math.abs(raw - 1) < 1e-12) return 1;
  if (Math.abs(raw - -1) < 1e-12) return -1;
  return Math.max(-1, Math.min(1, raw));
}

function parseEmbedding(raw: any): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw) && raw.length > 0) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      const parts = raw.replace(/^\[|\]$/g, "").split(",").map(Number).filter((n) => !isNaN(n));
      if (parts.length > 0) return parts;
    }
  }
  return null;
}

export function buildProfileTermVector(profile: any): Map<string, number> {
  const vec = new Map<string, number>();
  if (!profile) return vec;

  function addTokens(text?: string | null, weight: number = 1.0) {
    if (!text || typeof text !== "string") return;
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1);
    for (const t of tokens) {
      vec.set(t, (vec.get(t) || 0) + weight);
    }
  }

  addTokens(profile.company, 3.0);
  addTokens(profile.job_title, 2.5);
  addTokens(profile.institute_name, 2.5);
  addTokens(profile.society_name, 2.0);
  addTokens(profile.about, 1.0);
  addTokens(profile.professional_bio, 1.0);

  const tags = Array.isArray(profile.tags) ? profile.tags : [];
  for (const t of tags) addTokens(String(t), 2.0);

  const helpOffers = Array.isArray(profile.help_offers) ? profile.help_offers : [];
  for (const h of helpOffers) addTokens(String(h), 2.0);

  const askMeAbout = Array.isArray(profile.ask_me_about) ? profile.ask_me_about : [];
  for (const a of askMeAbout) addTokens(String(a), 2.0);

  const tinkeringWith = Array.isArray(profile.tinkering_with) ? profile.tinkering_with : [];
  for (const w of tinkeringWith) addTokens(String(w), 2.0);

  return vec;
}

export function termVectorCosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  if (!vecA || !vecB || vecA.size === 0 || vecB.size === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, valA] of vecA.entries()) {
    normA += valA * valA;
    if (vecB.has(term)) {
      dot += valA * vecB.get(term)!;
    }
  }

  for (const valB of vecB.values()) {
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Computes cosine similarity between profile A and profile B.
 * Uses embedding vectors if available; falls back to term vector cosine similarity.
 */
export function computeProfileCosineSimilarity(profileA: any, profileB: any): number {
  if (!profileA || !profileB) return 0;

  const embA = parseEmbedding(profileA.embedding);
  const embB = parseEmbedding(profileB.embedding);

  if (embA && embB && embA.length === embB.length) {
    const sim = cosineSimilarity(embA, embB);
    return Math.max(0, Math.min(1, sim));
  }

  const vecA = buildProfileTermVector(profileA);
  const vecB = buildProfileTermVector(profileB);
  const textSim = termVectorCosineSimilarity(vecA, vecB);
  return Math.max(0, Math.min(1, textSim));
}

/**
 * Returns calibrated match score (0-99%) and raw cosine similarity.
 */
export function calculateProfileMatchScore(
  profileA: any,
  profileB: any
): { score: number; similarity: number } {
  const similarity = computeProfileCosineSimilarity(profileA, profileB);
  
  // Calibrate score for UI presentation:
  // Cosine similarity in profile matching typically ranges from 0.0 to ~0.7.
  // We calibrate non-zero similarity smoothly between 48% and 99%, with similarity >= 0.35 reaching >= 80%.
  let score = 35;
  if (similarity > 0.001) {
    score = Math.round(45 + Math.min(1, similarity / 0.5) * 54);
  }
  score = Math.min(99, Math.max(35, score));

  return { score, similarity };
}

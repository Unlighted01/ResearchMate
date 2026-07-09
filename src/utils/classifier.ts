// ============================================
// classifier.ts - Intelligent Research Content Classifier
// ============================================

// Common English grammatical/functional reading words
const FUNCTIONAL_WORDS = new Set([
  "the", "of", "and", "to", "in", "is", "for", "that", "on", "with", 
  "as", "by", "an", "at", "from", "this", "these", "their", "which", 
  "was", "were", "or", "but", "not", "be", "are", "it", "its", "has", "have"
]);

// Positive research keywords (+ weight)
const RESEARCH_TERMS: Record<string, number> = {
  study: 2.0,
  research: 2.0,
  analysis: 1.5,
  method: 1.5,
  results: 1.5,
  conclusion: 1.5,
  evidence: 1.5,
  hypothesis: 2.0,
  experiment: 2.0,
  theory: 1.5,
  finding: 1.5,
  literature: 2.0,
  journal: 2.0,
  publication: 2.0,
  effect: 1.0,
  significant: 1.5,
  correlation: 2.0,
  variable: 1.5,
  sample: 1.0,
  participant: 1.5,
  cohort: 2.0,
  trial: 1.5,
  control: 1.0,
  mechanism: 1.5,
  data: 1.0,
  framework: 1.0,
  model: 0.5,
  algorithm: 1.5,
  investigate: 1.5,
  evaluate: 1.0,
  assess: 1.0,
  systematic: 2.0,
  clinical: 2.0,
  patient: 1.0,
  cell: 1.0,
  gene: 1.5,
  protein: 1.5,
  theorem: 2.0,
  proof: 1.5,
  academic: 2.0,
  scientific: 2.0,
  citation: 2.0,
  observer: 1.0,
  statistical: 2.0,
  regression: 2.0,
  probability: 1.5,
  respondent: 1.5,
  measurement: 1.0,
  parameter: 1.5
};

// Negative entertainment, gaming, shopping, daily life keywords (- weight)
const NON_RESEARCH_TERMS: Record<string, number> = {
  vs: -3.0,
  bracket: -3.0,
  match: -2.0,
  gameplay: -4.0,
  gaming: -4.0,
  stream: -3.0,
  playoffs: -4.0,
  champion: -2.0,
  tournament: -3.0,
  highlight: -2.0,
  trailer: -3.0,
  unboxing: -4.0,
  buy: -2.0,
  sale: -2.0,
  shopping: -3.0,
  discount: -3.0,
  subscribe: -2.0,
  vlog: -4.0,
  funny: -2.0,
  meme: -3.0,
  tiktok: -3.0,
  instagram: -3.0,
  facebook: -3.0,
  twitter: -3.0,
  tweet: -3.0,
  streamer: -4.0,
  live: -1.5,
  defeat: -2.0,
  victory: -2.0,
  build: -1.5,
  guide: -1.0,
  tips: -1.0,
  dlc: -4.0,
  league: -3.0,
  esports: -4.0,
  walkthrough: -4.0,
  chords: -3.0,
  lyrics: -3.0,
  recipe: -3.0,
  ingredients: -3.0,
  cooking: -3.0,
  workout: -2.0,
  fitness: -2.0,
  product: -1.0,
  customer: -1.0,
  order: -1.5,
  price: -2.0,
  checkout: -2.0,
  cart: -2.0,
  coupon: -3.0,
  shipping: -2.0,
  review: -0.5 // minor penalty, gaming reviews match this
};

/**
 * Clean and tokenize input text.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Calculates a research relevancy score for a text selection.
 * Higher score means more likely to be academic/research text.
 */
export function calculateResearchScore(text: string): {
  score: number;
  functionalWordCount: number;
  researchMatches: number;
  nonResearchMatches: number;
} {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return { score: 0, functionalWordCount: 0, researchMatches: 0, nonResearchMatches: 0 };
  }

  let score = 0;
  let functionalWordCount = 0;
  let researchMatches = 0;
  let nonResearchMatches = 0;

  for (const token of tokens) {
    // Count functional words
    if (FUNCTIONAL_WORDS.has(token)) {
      functionalWordCount++;
    }

    // Match research terms (prefix/stem matching)
    let matchedResearch = false;
    for (const [term, weight] of Object.entries(RESEARCH_TERMS)) {
      if (token.startsWith(term) || (term.length > 4 && token.includes(term))) {
        score += weight;
        matchedResearch = true;
      }
    }
    if (matchedResearch) researchMatches++;

    // Match non-research terms
    let matchedNonResearch = false;
    for (const [term, weight] of Object.entries(NON_RESEARCH_TERMS)) {
      if (token === term || token.startsWith(term)) {
        score += weight;
        matchedNonResearch = true;
      }
    }
    if (matchedNonResearch) nonResearchMatches++;
  }

  return { score, functionalWordCount, researchMatches, nonResearchMatches };
}

const INTERACTIVE_DOMAINS = [
  "youtube.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "github.com",
  "amazon.com",
  "ebay.com",
  "reddit.com",
  "pinterest.com",
  "linkedin.com",
  "google.com",
  "bing.com",
  "yahoo.com"
];

function isInteractiveDomain(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return INTERACTIVE_DOMAINS.some(domain => host === domain || host.endsWith("." + domain));
}

/**
 * Smart classification function to verify if text is genuine research reading content.
 */
export function isResearchContent(text: string, hostname: string): boolean {
  // 1. Citation check: bracketed citations [1] or parenthetical (Author, Year) are 100% research content
  const hasCitation = /\[\d+\]|\[\d+-\d+\]|\([A-Z][a-zA-Z]+( et al\.)?,\s*\d{4}\)/.test(text);
  if (hasCitation) {
    return true;
  }

  // 2. Tokenize and calculate scores
  const tokens = tokenize(text);
  if (tokens.length < 3) return false;

  const { score, functionalWordCount, researchMatches, nonResearchMatches } = calculateResearchScore(text);

  const isInteractive = isInteractiveDomain(hostname);

  // 3. Apply strict checks ONLY on interactive domains
  if (isInteractive) {
    // Must contain grammatical connective words
    if (functionalWordCount < 2) {
      return false;
    }
    // Must not be heavily non-research weighted
    if (score < 0 || (nonResearchMatches > 0 && score <= 0)) {
      return false;
    }
    // Must either be a long selection or contain specific academic terms
    if (tokens.length < 12 && researchMatches === 0) {
      return false;
    }
  }

  return true;
}

/**
 * Secondary Async AI Classifier using local Gemini Nano if available.
 */
export async function classifyWithLocalAI(text: string): Promise<boolean> {
  try {
    const ai = (window as any).ai || (window as any).chrome?.aiOriginTrial;
    if (ai && ai.languageModel) {
      const session = await ai.languageModel.create({
        systemPrompt: "You are a research filter AI. Respond with ONLY 'yes' or 'no'."
      });
      const response = await session.prompt(
        `Is the following text related to academic research, study, or scientific paper analysis? Text: "${text}"`
      );
      session.destroy();
      return response.toLowerCase().includes("yes");
    }
  } catch (e) {
    console.warn("Local AI classification error:", e);
  }
  return true; // Fallback to true if AI is unavailable or fails
}

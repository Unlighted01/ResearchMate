export function tokenise(text: string): Set<string> {
  const clean = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(clean);
}

export function jaccardSimilarity(textA: string, textB: string): number {
  const setA = tokenise(textA);
  const setB = tokenise(textB);
  
  if (setA.size === 0 || setB.size === 0) return 0;
  
  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionSize++;
    }
  }
  
  const unionSize = setA.size + setB.size - intersectionSize;
  return intersectionSize / unionSize;
}

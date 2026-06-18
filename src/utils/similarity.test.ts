import { describe, it, expect } from "vitest";
import { tokenise, jaccardSimilarity } from "./similarity";

describe("tokenise", () => {
  it("should lowercase all words", () => {
    const tokens = tokenise("Hello World");
    expect(tokens.has("hello")).toBe(true);
    expect(tokens.has("world")).toBe(true);
    expect(tokens.size).toBe(2);
  });

  it("should filter out words shorter than 3 characters", () => {
    const tokens = tokenise("a to the test");
    expect(tokens.has("the")).toBe(true);
    expect(tokens.has("test")).toBe(true);
    expect(tokens.has("a")).toBe(false);
    expect(tokens.has("to")).toBe(false);
    expect(tokens.size).toBe(2);
  });

  it("should replace punctuation with space and tokenise", () => {
    const tokens = tokenise("hello-world, this is exciting!");
    expect(tokens.has("hello")).toBe(true);
    expect(tokens.has("world")).toBe(true);
    expect(tokens.has("this")).toBe(true);
    expect(tokens.has("exciting")).toBe(true);
    expect(tokens.has("is")).toBe(false); // too short
  });
});

describe("jaccardSimilarity", () => {
  it("should return 1 for identical token sets", () => {
    const text = "This is a simple test case for similarity";
    expect(jaccardSimilarity(text, text)).toBe(1);
  });

  it("should return 0 when there is no overlap", () => {
    const textA = "apple banana cherry";
    const textB = "dog elephant giraffe";
    expect(jaccardSimilarity(textA, textB)).toBe(0);
  });

  it("should calculate correct Jaccard score for partial overlap", () => {
    // textA tokens: {quick, brown, fox} (size 3)
    // textB tokens: {quick, white, fox} (size 3)
    // Intersection: {quick, fox} (size 2)
    // Union: {quick, brown, fox, white} (size 4)
    // Similarity: 2 / 4 = 0.5
    const textA = "quick brown fox";
    const textB = "quick white fox";
    expect(jaccardSimilarity(textA, textB)).toBe(0.5);
  });

  it("should handle empty token sets gracefully", () => {
    expect(jaccardSimilarity("to be", "or not to be")).toBe(0); // all tokens filtered out for length < 3
  });
});

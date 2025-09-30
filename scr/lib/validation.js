// scr/lib/validation.js
export function validateItemData(data) {
  const errors = [];

  if (!data.text || typeof data.text !== "string") {
    errors.push("Text content is required");
  } else if (data.text.length < 1) {
    errors.push("Text content cannot be empty");
  } else if (data.text.length > 10000) {
    errors.push("Text content exceeds maximum length (10,000 characters)");
  }

  if (data.tags && !Array.isArray(data.tags)) {
    errors.push("Tags must be an array");
  }

  if (data.tags && data.tags.length > 20) {
    errors.push("Maximum 20 tags allowed");
  }

  if (data.sourceUrl && !isValidUrl(data.sourceUrl)) {
    errors.push("Invalid source URL format");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

export function sanitizeText(text) {
  return text
    .trim()
    .replace(/\s+/g, " ") // normalize whitespace
    .slice(0, 10000); // enforce max length
}

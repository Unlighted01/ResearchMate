// ============================================
// BIBLIOGRAPHY - Custom Tiptap Extension
// ============================================

// ============================================
// PART 1: IMPORTS & DEPENDENCIES
// ============================================

import { Extension } from "@tiptap/core";

// ============================================
// PART 2: EXTENSION
// ============================================

const Bibliography = Extension.create({
  name: "bibliography",

  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          dataBibliography: {
            default: null,
            parseHTML: (element) =>
              element.getAttribute("data-bibliography") === "true" || null,
            renderHTML: (attributes) => {
              if (!attributes.dataBibliography) return {};
              return { "data-bibliography": "true" };
            },
          },
        },
      },
    ];
  },
});

// ============================================
// PART 3: EXPORTS
// ============================================

export default Bibliography;

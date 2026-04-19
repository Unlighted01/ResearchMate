// ============================================
// INDENT - Custom Tiptap Extension
// ============================================

// ============================================
// PART 1: IMPORTS & DEPENDENCIES
// ============================================

import { Extension } from "@tiptap/core";

// ============================================
// PART 2: TYPE DECLARATIONS
// ============================================

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
  }
}

// ============================================
// PART 3: EXTENSION
// ============================================

const Indent = Extension.create({
  name: "indent",

  addOptions() {
    return {
      types: ["paragraph", "heading"],
      minLevel: 0,
      maxLevel: 8,
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const ml = element.style.marginLeft;
              if (!ml) return 0;
              const rem = parseFloat(ml);
              return Math.round(rem / 2);
            },
            renderHTML: (attributes) => {
              if (!attributes.indent || attributes.indent === 0) return {};
              return {
                style: `margin-left: ${attributes.indent * 2}rem`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { from, to } = selection;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const currentIndent = node.attrs.indent || 0;
              if (currentIndent < this.options.maxLevel) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: currentIndent + 1,
                });
              }
            }
          });

          if (dispatch) dispatch(tr);
          return true;
        },

      decreaseIndent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state;
          const { from, to } = selection;

          state.doc.nodesBetween(from, to, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              const currentIndent = node.attrs.indent || 0;
              if (currentIndent > this.options.minLevel) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  indent: currentIndent - 1,
                });
              }
            }
          });

          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.increaseIndent(),
      "Shift-Tab": () => this.editor.commands.decreaseIndent(),
    };
  },
});

// ============================================
// PART 4: EXPORTS
// ============================================

export default Indent;

import React, { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import UnderlineExt from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import FontFamily from "@tiptap/extension-font-family";
import FontSize from "./extensions/fontSize";
import Indent from "./extensions/indent";
import Bibliography from "./extensions/bibliography";
import { Editor } from "@tiptap/react";

interface EditorCanvasProps {
  content: Record<string, unknown>;
  onEditorReady?: (editor: Editor) => void;
  onContentChange: (content: Record<string, unknown>) => void;
}

const EditorCanvas: React.FC<EditorCanvasProps> = ({
  content,
  onEditorReady,
  onContentChange,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      UnderlineExt,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Subscript,
      Superscript,
      FontFamily,
      FontSize,
      Indent,
      Bibliography,
      Placeholder.configure({
        placeholder: "Start typing notes here...",
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onContentChange(editor.getJSON() as Record<string, unknown>);
    },
    editorProps: {
      attributes: {
        // We use typical sidepanel padding and let index.css handle default text styling instead of relying heavily on typography plugins.
        class: "focus:outline-none min-h-[400px] text-sm text-gray-800 dark:text-gray-200",
      },
      handleDOMEvents: {
        drop: (_view, event) => {
          event.preventDefault();
          return true;
        },
        dragstart: (_view, event) => {
          event.preventDefault();
          return true;
        },
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (editor && content) {
      const currentJSON = JSON.stringify(editor.getJSON());
      const newJSON = JSON.stringify(content);
      if (currentJSON !== newJSON) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 relative z-0" id="notepad-canvas">
      <EditorContent editor={editor} className="min-h-full" />
    </div>
  );
};

export default EditorCanvas;

"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import {
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Quote,
  Minus,
  Highlighter,
  Undo,
  Redo,
} from "lucide-react";

export interface EditorHandle {
  insertContent: (html: string) => void;
  getHTML: () => string;
}

interface EditorProps {
  content?: string;
  onChange?: (html: string, text: string) => void;
  placeholder?: string;
}

const EditorComponent = forwardRef<EditorHandle, EditorProps>(function EditorComponent(
  { content = "", onChange, placeholder = "Start writing..." },
  ref
) {
  const isExternalUpdate = useRef(false);
  const skipNextSync = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Highlight,
      Typography,
    ],
    content,
    onUpdate: ({ editor }) => {
      if (!isExternalUpdate.current) {
        onChange?.(editor.getHTML(), editor.getText());
      }
    },
    editorProps: {
      attributes: {
        class: "tiptap",
      },
    },
  });

  // Sync editor content when the content prop changes externally (e.g. selecting a different entry)
  useEffect(() => {
    if (editor && content !== undefined) {
      // Skip sync if we just did an imperative insert (the parent's setHtml is catching up)
      if (skipNextSync.current) {
        skipNextSync.current = false;
        return;
      }
      const currentHtml = editor.getHTML();
      // Only update if content actually differs (avoid cursor reset on own edits)
      if (currentHtml !== content) {
        isExternalUpdate.current = true;
        editor.commands.setContent(content || "", { emitUpdate: false });
        isExternalUpdate.current = false;
      }
    }
  }, [editor, content]);

  // Expose imperative methods to parent via ref
  useImperativeHandle(ref, () => ({
    insertContent: (html: string) => {
      if (editor) {
        // Mark that we're doing an imperative insert so the sync useEffect skips the next content change
        skipNextSync.current = true;
        editor.chain().focus().insertContent(html, { parseOptions: { preserveWhitespace: false } }).run();
      }
    },
    getHTML: () => editor?.getHTML() ?? "",
  }), [editor]);

  if (!editor) return null;

  const ToolButton = ({
    onClick,
    active = false,
    children,
    title,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 rounded transition-colors"
      style={{
        backgroundColor: active ? "var(--bg-tertiary)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-muted)",
      }}
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-lg border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)" }}>
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 px-3 py-2 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <ToolButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading"
        >
          <Heading2 size={16} />
        </ToolButton>
        <div className="w-px h-5 mx-1" style={{ backgroundColor: "var(--border)" }} />
        <ToolButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive("highlight")}
          title="Highlight"
        >
          <Highlighter size={16} />
        </ToolButton>
        <ToolButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Divider"
        >
          <Minus size={16} />
        </ToolButton>
        <div className="flex-1" />
        <ToolButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo size={16} />
        </ToolButton>
        <ToolButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo size={16} />
        </ToolButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
});

export default EditorComponent;

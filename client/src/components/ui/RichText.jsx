import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered, Quote, Link2, Undo2, Redo2, Pilcrow } from 'lucide-react';
import { cn } from '@/lib/cn';

function Btn({ on, active, icon: I, title }) {
  return (
    <button type="button" title={title} onClick={on} className={cn('grid size-8 cursor-pointer place-items-center rounded-lg transition', active ? 'bg-primary-soft text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
      <I className="size-4" />
    </button>
  );
}

/** Tiptap rich-text editor that emits HTML */
export default function RichText({ value, onChange, height = 220, placeholder = 'Start writing...' }) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), Link.configure({ openOnClick: false, autolink: true })],
    content: value || '',
    editorProps: { attributes: { class: 'tiptap prose-content px-4 py-3 text-sm', 'data-placeholder': placeholder } },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });
  useEffect(() => {
    if (!editor || editor.isDestroyed || !editor.view?.dom?.isConnected || editor.isFocused) return;
    try { if (value !== editor.getHTML()) editor.commands.setContent(value || '', { emitUpdate: false }); } catch { /* editor not mounted yet */ }
  }, [value, editor]);
  if (!editor) return <div className="skeleton" style={{ height }} />;
  const c = () => editor.chain().focus();
  const link = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('Link URL', prev || 'https://');
    if (url === null) return;
    if (!url) c().unsetLink().run(); else c().extendMarkRange('link').setLink({ href: url }).run();
  };
  return (
    <div className="overflow-hidden rounded-xl border border-input bg-card focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15" style={{ '--editor-h': `${height}px` }}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 p-1.5">
        <Btn title="Paragraph" icon={Pilcrow} on={() => c().setParagraph().run()} active={editor.isActive('paragraph')} />
        <Btn title="Heading" icon={Heading2} on={() => c().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} />
        <Btn title="Sub heading" icon={Heading3} on={() => c().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} />
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn title="Bold" icon={Bold} on={() => c().toggleBold().run()} active={editor.isActive('bold')} />
        <Btn title="Italic" icon={Italic} on={() => c().toggleItalic().run()} active={editor.isActive('italic')} />
        <Btn title="Strike" icon={Strikethrough} on={() => c().toggleStrike().run()} active={editor.isActive('strike')} />
        <span className="mx-1 h-5 w-px bg-border" />
        <Btn title="Bullet list" icon={List} on={() => c().toggleBulletList().run()} active={editor.isActive('bulletList')} />
        <Btn title="Numbered list" icon={ListOrdered} on={() => c().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
        <Btn title="Quote" icon={Quote} on={() => c().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
        <Btn title="Link" icon={Link2} on={link} active={editor.isActive('link')} />
        <span className="ml-auto" />
        <Btn title="Undo" icon={Undo2} on={() => c().undo().run()} />
        <Btn title="Redo" icon={Redo2} on={() => c().redo().run()} />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

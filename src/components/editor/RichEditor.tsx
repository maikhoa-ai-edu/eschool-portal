import { useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { uploadImage } from '@/features/media/api'
import { cn } from '@/lib/cn'
import { toVietnameseError } from '@/lib/errors'

interface RichEditorProps {
  /** Nội dung ban đầu; đổi bản ghi thì gắn key mới cho component */
  initialValue: string
  onChange: (html: string) => void
  /** Nhãn cho trình đọc màn hình (và cho kiểm thử) */
  label: string
  /** Thư mục trong bucket media để lưu ảnh chèn vào bài */
  uploadFolder: string
  invalid?: boolean
}

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-text hover:bg-bg disabled:opacity-40',
        active && 'bg-primary/10 text-primary',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  )
}

function Separator() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />
}

function askLink(editor: Editor) {
  const previous = (editor.getAttributes('link').href as string | undefined) ?? ''
  const url = window.prompt('Địa chỉ liên kết (để trống để bỏ liên kết):', previous || 'https://')
  if (url === null) return
  const trimmed = url.trim()
  if (trimmed === '' || trimmed === 'https://') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  if (!/^(https?:\/\/|\/|mailto:)/i.test(trimmed)) {
    window.alert('Liên kết phải bắt đầu bằng https://, / hoặc mailto:')
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: trimmed }).run()
}

function Toolbar({
  editor,
  uploading,
  onPickImage,
}: {
  editor: Editor
  uploading: boolean
  onPickImage: () => void
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      quote: e.isActive('blockquote'),
      link: e.isActive('link'),
      left: e.isActive({ textAlign: 'left' }),
      center: e.isActive({ textAlign: 'center' }),
      right: e.isActive({ textAlign: 'right' }),
      justify: e.isActive({ textAlign: 'justify' }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  })
  const chain = () => editor.chain().focus()

  const groups: ReactNode[] = [
    <ToolButton
      key="b"
      icon={Bold}
      label="Đậm"
      active={state.bold}
      onClick={() => chain().toggleBold().run()}
    />,
    <ToolButton
      key="i"
      icon={Italic}
      label="Nghiêng"
      active={state.italic}
      onClick={() => chain().toggleItalic().run()}
    />,
    <ToolButton
      key="u"
      icon={Underline}
      label="Gạch chân"
      active={state.underline}
      onClick={() => chain().toggleUnderline().run()}
    />,
    <ToolButton
      key="s"
      icon={Strikethrough}
      label="Gạch ngang"
      active={state.strike}
      onClick={() => chain().toggleStrike().run()}
    />,
    <Separator key="sep1" />,
    <ToolButton
      key="h2"
      icon={Heading2}
      label="Tiêu đề lớn"
      active={state.h2}
      onClick={() => chain().toggleHeading({ level: 2 }).run()}
    />,
    <ToolButton
      key="h3"
      icon={Heading3}
      label="Tiêu đề nhỏ"
      active={state.h3}
      onClick={() => chain().toggleHeading({ level: 3 }).run()}
    />,
    <ToolButton
      key="ul"
      icon={List}
      label="Danh sách chấm"
      active={state.bullet}
      onClick={() => chain().toggleBulletList().run()}
    />,
    <ToolButton
      key="ol"
      icon={ListOrdered}
      label="Danh sách số"
      active={state.ordered}
      onClick={() => chain().toggleOrderedList().run()}
    />,
    <ToolButton
      key="q"
      icon={Quote}
      label="Trích dẫn"
      active={state.quote}
      onClick={() => chain().toggleBlockquote().run()}
    />,
    <Separator key="sep2" />,
    <ToolButton
      key="al"
      icon={AlignLeft}
      label="Căn trái"
      active={state.left}
      onClick={() => chain().setTextAlign('left').run()}
    />,
    <ToolButton
      key="ac"
      icon={AlignCenter}
      label="Căn giữa"
      active={state.center}
      onClick={() => chain().setTextAlign('center').run()}
    />,
    <ToolButton
      key="ar"
      icon={AlignRight}
      label="Căn phải"
      active={state.right}
      onClick={() => chain().setTextAlign('right').run()}
    />,
    <ToolButton
      key="aj"
      icon={AlignJustify}
      label="Căn đều"
      active={state.justify}
      onClick={() => chain().setTextAlign('justify').run()}
    />,
    <Separator key="sep3" />,
    <ToolButton
      key="link"
      icon={Link2}
      label="Liên kết"
      active={state.link}
      onClick={() => askLink(editor)}
    />,
    uploading ? (
      <span key="img" className="flex h-8 w-8 items-center justify-center">
        <Spinner className="h-4 w-4" label="Đang tải ảnh" />
      </span>
    ) : (
      <ToolButton key="img" icon={ImagePlus} label="Chèn ảnh" onClick={onPickImage} />
    ),
    <ToolButton
      key="hr"
      icon={Minus}
      label="Đường kẻ ngang"
      onClick={() => chain().setHorizontalRule().run()}
    />,
    <Separator key="sep4" />,
    <ToolButton
      key="undo"
      icon={Undo2}
      label="Hoàn tác"
      disabled={!state.canUndo}
      onClick={() => chain().undo().run()}
    />,
    <ToolButton
      key="redo"
      icon={Redo2}
      label="Làm lại"
      disabled={!state.canRedo}
      onClick={() => chain().redo().run()}
    />,
  ]

  return (
    <div
      role="toolbar"
      aria-label="Định dạng văn bản"
      className="flex flex-wrap items-center gap-0.5 border-b border-border bg-bg/60 px-2 py-1"
    >
      {groups}
    </div>
  )
}

/** Trình soạn thảo nội dung (TipTap). Kết quả là HTML; khi hiển thị luôn qua DOMPurify. */
export function RichEditor({ initialValue, onChange, label, uploadFolder, invalid }: RichEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: initialValue,
    editorProps: {
      attributes: {
        class: 'rich-content min-h-72 px-4 py-3 focus:outline-none',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': label,
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
  })

  const insertImage = async (file: File) => {
    if (!editor) return
    setUploadError(null)
    setUploading(true)
    try {
      const image = await uploadImage(file, uploadFolder)
      editor
        .chain()
        .focus()
        .setImage({ src: image.url, alt: file.name.replace(/\.[^.]+$/, '') })
        .run()
    } catch (err) {
      setUploadError(toVietnameseError(err))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div
        className={cn(
          'overflow-hidden rounded-lg border bg-surface focus-within:border-primary',
          invalid ? 'border-danger' : 'border-border',
        )}
      >
        {editor && (
          <Toolbar editor={editor} uploading={uploading} onPickImage={() => fileInput.current?.click()} />
        )}
        <EditorContent editor={editor} />
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        tabIndex={-1}
        aria-label="Chọn ảnh để chèn vào nội dung"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void insertImage(file)
        }}
      />
      {uploadError && <p className="mt-1 text-xs text-danger">{uploadError}</p>}
    </div>
  )
}

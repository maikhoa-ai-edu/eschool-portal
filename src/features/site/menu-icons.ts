import { createElement } from 'react'
import {
  Award,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CircleDot,
  ClipboardList,
  Contact,
  Download,
  ExternalLink,
  FileText,
  Flag,
  FlaskConical,
  Globe,
  GraduationCap,
  Heart,
  HelpCircle,
  House,
  Images,
  Info,
  Landmark,
  Library,
  Link2,
  Mail,
  MapPin,
  Medal,
  Megaphone,
  Music,
  Newspaper,
  NotebookText,
  Phone,
  School,
  Search,
  Sparkles,
  Star,
  Trophy,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'

export const DEFAULT_MENU_ICON = 'circle-dot'

/** Khóa lưu trong menu_items.icon -> icon + tên hiện ở ô chọn. Thêm icon mới chỉ cần thêm vào đây. */
export const MENU_ICONS: Record<string, { label: string; icon: LucideIcon }> = {
  'circle-dot': { label: 'Mặc định', icon: CircleDot },
  home: { label: 'Trang chủ', icon: House },
  info: { label: 'Thông tin', icon: Info },
  newspaper: { label: 'Tin tức', icon: Newspaper },
  bell: { label: 'Thông báo', icon: Bell },
  megaphone: { label: 'Loa', icon: Megaphone },
  'file-text': { label: 'Văn bản', icon: FileText },
  'notebook-text': { label: 'Sổ ghi', icon: NotebookText },
  'clipboard-list': { label: 'Danh sách', icon: ClipboardList },
  download: { label: 'Tải về', icon: Download },
  images: { label: 'Ảnh', icon: Images },
  video: { label: 'Video', icon: Video },
  music: { label: 'Âm nhạc', icon: Music },
  phone: { label: 'Điện thoại', icon: Phone },
  mail: { label: 'Thư', icon: Mail },
  contact: { label: 'Liên hệ', icon: Contact },
  'map-pin': { label: 'Địa chỉ', icon: MapPin },
  school: { label: 'Trường học', icon: School },
  'building-2': { label: 'Tòa nhà', icon: Building2 },
  landmark: { label: 'Cơ quan', icon: Landmark },
  'graduation-cap': { label: 'Tốt nghiệp', icon: GraduationCap },
  'book-open': { label: 'Sách', icon: BookOpen },
  library: { label: 'Thư viện', icon: Library },
  'flask-conical': { label: 'Khoa học', icon: FlaskConical },
  users: { label: 'Tập thể', icon: Users },
  heart: { label: 'Trái tim', icon: Heart },
  star: { label: 'Ngôi sao', icon: Star },
  flag: { label: 'Lá cờ', icon: Flag },
  award: { label: 'Giải thưởng', icon: Award },
  medal: { label: 'Huy chương', icon: Medal },
  trophy: { label: 'Cúp', icon: Trophy },
  sparkles: { label: 'Nổi bật', icon: Sparkles },
  calendar: { label: 'Lịch', icon: Calendar },
  search: { label: 'Tìm kiếm', icon: Search },
  'help-circle': { label: 'Hỏi đáp', icon: HelpCircle },
  globe: { label: 'Website', icon: Globe },
  'link-2': { label: 'Liên kết', icon: Link2 },
  'external-link': { label: 'Mở ngoài', icon: ExternalLink },
}

/** Chưa chọn hoặc khóa không còn trong danh sách thì dùng icon mặc định. */
export function menuIcon(key: string | null | undefined): LucideIcon {
  const known = key ? MENU_ICONS[key] : undefined
  return (known ?? MENU_ICONS[DEFAULT_MENU_ICON]!).icon
}

export function MenuIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  return createElement(menuIcon(name), { className, 'aria-hidden': true })
}

// ============================================
// PART 1: USER TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at?: string;
}

// ============================================
// PART 2: DEVICE SOURCE TYPES
// ============================================

export type DeviceSource = "extension" | "mobile" | "smart_pen" | "web" | "transcription";

export const DEVICE_SOURCES: Record<
  DeviceSource,
  { label: string; icon: string }
> = {
  extension: { label: "Browser Extension", icon: "Laptop" },
  mobile: { label: "Mobile App", icon: "Smartphone" },
  smart_pen: { label: "Smart Pen", icon: "PenTool" },
  web: { label: "Web App", icon: "Globe" },
  transcription: { label: "Media Transcription", icon: "Mic" },
};

// ============================================
// PART 3: RESEARCH ITEM TYPES
// ============================================

export interface ResearchItem {
  id: string;
  user_id: string;
  text: string;
  source_url?: string;
  source_title?: string;
  tags?: string[];
  collection_id?: string;
  ai_summary?: string;
  device_source: DeviceSource;
  created_at: string;
  updated_at: string;
  notes?: string;
  citation?: string;
  citation_format?: string;
  preferred_view?: "original" | "summary";
  color?: "yellow" | "green" | "blue" | "red" | "purple";
  // For smart pen specifically
  image_url?: string;
  ocr_text?: string;
}

// Camel case version for internal use
export interface ResearchItemCamel {
  id: string;
  userId: string;
  text: string;
  sourceUrl?: string;
  sourceTitle?: string;
  tags?: string[];
  collectionId?: string;
  aiSummary?: string;
  deviceSource: DeviceSource;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  citation?: string;
  citationFormat?: string;
  preferredView?: "original" | "summary";
  color?: "yellow" | "green" | "blue" | "red" | "purple";
  imageUrl?: string;
  ocrText?: string;
}

// ============================================
// PART 4: COLLECTION TYPES
// ============================================

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  created_at: string;
  updated_at: string;
  items?: ResearchItem[]; // Optional join
  item_count?: number;
}

export const COLLECTION_COLORS = [
  "#4F46E5", // Indigo
  "#06B6D4", // Cyan
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#6366F1", // Blue
];

// ============================================
// PART 5: ACTIVITY TYPES
// ============================================

export interface Activity {
  id: string;
  user_id?: string;
  device: DeviceSource;
  action: "create" | "update" | "delete" | "sync" | "login" | "logout";
  title: string;
  description: string;
  item_id?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

// ============================================
// PART 6: CHAT TYPES
// ============================================

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: {
    tokens?: number;
    model?: string;
    context?: string[];
  };
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

// ============================================
// PART 7: STATISTICS TYPES
// ============================================

export interface UserStats {
  total_items: number;
  items_this_week: number;
  items_this_month: number;
  summaries_generated: number;
  collections_count: number;
  streak_days: number;
  by_source: Record<DeviceSource, number>;
  by_month: Record<string, number>;
  top_tags: Array<{ tag: string; count: number }>;
}

export interface DailyActivity {
  date: string;
  count: number;
}

// ============================================
// PART 8: SETTINGS TYPES
// ============================================

export interface UserSettings {
  theme: "light" | "dark" | "system";
  font_family: string;
  font_size: number;
  default_sort: "date-desc" | "date-asc" | "title-asc" | "title-desc";
  ai_enabled: boolean;
  realtime_enabled: boolean;
  notifications_enabled: boolean;
  default_collection_id?: string;
  export_format: "json" | "csv" | "markdown" | "bibtex";
}

export const DEFAULT_SETTINGS: UserSettings = {
  theme: "system",
  font_family: "system-ui",
  font_size: 14,
  default_sort: "date-desc",
  ai_enabled: true,
  realtime_enabled: true,
  notifications_enabled: true,
  export_format: "json",
};

// ============================================
// PART 9: API RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
  status: number;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// ============================================
// PART 10: FORM TYPES
// ============================================

export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData {
  email: string;
  password: string;
  confirm_password?: string;
}

export interface ResearchItemFormData {
  text: string;
  tags: string;
  notes: string;
  source_url?: string;
  source_title?: string;
  collection_id?: string;
}

export interface CollectionFormData {
  name: string;
  description: string;
  color: string;
  icon?: string;
}

// ============================================
// PART 11: EXPORT TYPES
// ============================================

export type ExportFormat = "json" | "csv" | "markdown" | "bibtex" | "pdf";

export interface ExportOptions {
  format: ExportFormat;
  include_summaries: boolean;
  include_notes: boolean;
  include_metadata: boolean;
  date_range?: {
    start: string;
    end: string;
  };
  collection_ids?: string[];
  tags?: string[];
}

// ============================================
// PART 12: SMART PEN TYPES
// ============================================

export interface SmartPenScan {
  id: string;
  user_id: string;
  image_url: string;
  ocr_text?: string;
  ocr_confidence?: number;
  processed: boolean;
  created_at: string;
  research_item_id?: string;
}

export interface SmartPenDevice {
  id: string;
  user_id: string;
  device_name: string;
  last_sync: string;
  battery_level?: number;
  firmware_version?: string;
  is_connected: boolean;
}

// ============================================
// PART 13: UTILITY TYPES
// ============================================

export type SortOrder = "asc" | "desc";

export type SortField = "created_at" | "updated_at" | "title" | "source_title";

export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

export interface FilterConfig {
  search?: string;
  tags?: string[];
  collection_id?: string;
  device_source?: DeviceSource;
  date_from?: string;
  date_to?: string;
  has_summary?: boolean;
}

// ============================================
// PART 14: EXPORTS
// ============================================

export default {
  DEVICE_SOURCES,
  COLLECTION_COLORS,
  DEFAULT_SETTINGS,
};

import { describe, it, expect, vi, beforeEach } from "vitest";
import { addItem, getAllItems, deleteItem } from "./storageService";
import { isAuthenticated, supabase } from "./supabaseClient";
import { STORAGE_KEY } from "../constants";
import { User } from "@supabase/supabase-js";

// Mock global chrome.storage.local API
let mockLocalStorage: Record<string, string> = {};
const chromeMock = {
  storage: {
    local: {
      get: vi.fn((keys: unknown, callback: (result: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        if (typeof keys === "string") {
          result[keys] = mockLocalStorage[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach((key: string) => {
            result[key] = mockLocalStorage[key];
          });
        } else if (keys === null || keys === undefined) {
          Object.assign(result, mockLocalStorage);
        }
        callback(result);
      }),
      set: vi.fn((items: Record<string, unknown>, callback?: () => void) => {
        Object.entries(items).forEach(([key, val]) => {
          mockLocalStorage[key] = val as string;
        });
        if (callback) callback();
      }),
      remove: vi.fn((keys: unknown, callback?: () => void) => {
        if (typeof keys === "string") {
          delete mockLocalStorage[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach((key: string) => delete mockLocalStorage[key]);
        }
        if (callback) callback();
      }),
      clear: vi.fn((callback?: () => void) => {
        mockLocalStorage = {};
        if (callback) callback();
      }),
    },
  },
};

vi.stubGlobal("chrome", chromeMock);

type MockQueryBuilder = {
  [key: string]: ReturnType<typeof vi.fn>;
};

// Create a chainable Supabase query builder mock helper
const createQueryBuilderMock = (): MockQueryBuilder => {
  const builder = {} as MockQueryBuilder;
  const chainableMethods = [
    "insert",
    "select",
    "single",
    "delete",
    "update",
    "eq",
    "in",
    "order",
    "limit",
    "range",
  ];
  chainableMethods.forEach((method) => {
    builder[method] = vi.fn().mockImplementation(() => builder);
  });
  return builder;
};

const mockQueryBuilder = createQueryBuilderMock();

// Mock the Supabase Client service
vi.mock("./supabaseClient", () => {
  const mockSupabase = {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(() => mockQueryBuilder),
  };

  return {
    isAuthenticated: vi.fn(),
    supabase: mockSupabase,
  };
});

describe("storageService", () => {
  beforeEach(() => {
    mockLocalStorage = {};
    vi.clearAllMocks();
  });

  describe("addItem", () => {
    it("should save to local storage when unauthenticated", async () => {
      vi.mocked(isAuthenticated).mockResolvedValue(false);

      const result = await addItem({
        text: "My local research note",
        tags: ["tag1"],
        sourceUrl: "https://example.com",
        sourceTitle: "Example Site",
      });

      expect(result).not.toBeNull();
      expect(result!.id).toContain("local_");
      expect(result!.text).toBe("My local research note");
      expect(result!.tags).toContain("tag1");

      // Verify stored in chrome.storage.local using the official STORAGE_KEY
      expect(mockLocalStorage[STORAGE_KEY]).toBeDefined();
      const stored = JSON.parse(mockLocalStorage[STORAGE_KEY]);
      expect(stored.length).toBe(1);
      expect(stored[0].text).toBe("My local research note");
    });

    it("should save to cloud (Supabase) when authenticated", async () => {
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } as unknown as User },
        error: null,
      });

      const dbRow = {
        id: "100",
        text: "Cloud saved item",
        tags: ["cloud"],
        note: "Note text",
        source_url: "https://cloud.com",
        source_title: "Cloud Title",
        created_at: "2026-06-18T10:00:00Z",
        device_source: "extension",
      };

      vi.mocked(mockQueryBuilder.single).mockResolvedValue({ data: dbRow, error: null } as unknown);

      const result = await addItem({
        text: "Cloud saved item",
        tags: ["cloud"],
        note: "Note text",
        sourceUrl: "https://cloud.com",
        sourceTitle: "Cloud Title",
      });

      expect(result).not.toBeNull();
      expect(result!.id).toBe("100");
      expect(result!.text).toBe("Cloud saved item");
      expect(result!.tags).toContain("cloud");
      expect(result!.deviceSource).toBe("extension");
    });

    it("should fallback to local storage if Supabase insert throws an error", async () => {
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } as unknown as User },
        error: null,
      });

      vi.mocked(mockQueryBuilder.single).mockResolvedValue({
        data: null,
        error: { message: "Database failure", code: "500" } as unknown,
      } as unknown);

      const result = await addItem({
        text: "Fallback test item",
        tags: ["fallback"],
      });

      expect(result).not.toBeNull();
      expect(result!.id).toContain("local_");
      expect(result!.text).toBe("Fallback test item");
      
      const stored = JSON.parse(mockLocalStorage[STORAGE_KEY]);
      expect(stored[0].text).toBe("Fallback test item");
    });
  });

  describe("getAllItems", () => {
    it("should merge local items and cloud items sorted by createdAt desc", async () => {
      vi.mocked(isAuthenticated).mockResolvedValue(true);

      // Setup 1 local item
      mockLocalStorage[STORAGE_KEY] = JSON.stringify([
        {
          id: "local_1",
          text: "Local Item",
          tags: [],
          createdAt: "2026-06-18T12:00:00Z",
          deviceSource: "extension",
        },
      ]);

      // Setup 1 cloud item
      const cloudItem = {
        id: "200",
        text: "Cloud Item",
        tags: [],
        created_at: "2026-06-18T13:00:00Z",
        device_source: "web",
      };

      vi.mocked(mockQueryBuilder.limit).mockResolvedValue({ data: [cloudItem], error: null } as unknown);

      const items = await getAllItems();

      expect(items.length).toBe(2);
      expect(items[0].text).toBe("Cloud Item"); // newer timestamp
      expect(items[1].text).toBe("Local Item"); // older timestamp
    });
  });

  describe("deleteItem", () => {
    it("should remove local item from storage directly", async () => {
      mockLocalStorage[STORAGE_KEY] = JSON.stringify([
        {
          id: "local_123",
          text: "Delete me",
          tags: [],
          createdAt: "2026-06-18T12:00:00Z",
        },
      ]);

      await deleteItem("local_123");

      const stored = JSON.parse(mockLocalStorage[STORAGE_KEY]);
      expect(stored.length).toBe(0);
    });

    it("should delete cloud item from Supabase database", async () => {
      vi.mocked(isAuthenticated).mockResolvedValue(true);
      vi.mocked(mockQueryBuilder.eq).mockResolvedValue({ error: null } as unknown);

      await deleteItem("456");

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith("id", "456");
    });
  });
});

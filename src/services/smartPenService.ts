import { supabase } from "./supabaseClient";
import { SmartPenDevice, SmartPenScan } from "../types";

export interface PairingResult {
  success: boolean;
  message?: string;
  device?: SmartPenDevice;
}

export async function getPairedDevice(
  userId: string,
): Promise<SmartPenDevice | null> {
  const { data, error } = await supabase
    .from("paired_pens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      // PGRST116 is "Row not found"
      console.error("Error fetching paired pen:", error);
    }
    return null;
  }

  return data as SmartPenDevice;
}

export async function pairDevice(
  userId: string,
  code: string,
): Promise<PairingResult> {
  try {
    const { data, error: funcError } = await supabase.functions.invoke("smart-pen", {
      body: {
        action: "confirm",
        code: code,
        user_id: userId,
      },
    });

    if (funcError) throw funcError;

    if (data.success) {
      // Fetch the device record using the Edge Function 'list' action to bypass RLS if needed,
      // or just trust the confirmed status and return a minimal object.
      // Website uses 'list', let's do the same to ensure consistency.
      const { data: listData, error: listError } = await supabase.functions.invoke("smart-pen", {
        body: {
          action: "list",
          user_id: userId,
        },
      });

      if (listError || !listData.success) {
        // Fallback: created a minimal device object if fetch fails
        return { 
          success: true, 
          device: {
            id: data.pen_id,
            pen_id: data.pen_id,
            user_id: userId,
            device_name: "ResearchMate Pen",
            last_sync: new Date().toISOString(),
            is_connected: true
          } as SmartPenDevice,
          message: "Device paired successfully!" 
        };
      }

      const pairedDevice = listData.pens?.find((p: { pen_id: string; id?: string; paired_at?: string }) => p.pen_id === data.pen_id);

      return { 
        success: true, 
        device: pairedDevice ? {
          ...pairedDevice,
          id: pairedDevice.id || pairedDevice.pen_id,
          device_name: "ResearchMate Pen",
          is_connected: true,
          last_sync: pairedDevice.paired_at
        } as SmartPenDevice : undefined,
        message: "Device paired successfully!" 
      };
    } else {
      return { 
        success: false, 
        message: data.error || "Invalid or expired code." 
      };
    }
  } catch (error) {
    console.error("Pairing error:", error);
    return { 
      success: false, 
      message: "Network error. Please try again." 
    };
  }
}

export async function unpairDevice(id: string): Promise<boolean> {
  const { error } = await supabase.from("paired_pens").delete().eq("id", id);
  return !error;
}

export async function getSmartPenScans(
  userId: string,
): Promise<SmartPenScan[]> {
  // This might be fetched from 'items' table where device_source = 'smart_pen'
  // OR a specific 'scans' table if they are separate.
  // Based on previous types, they seem to be ResearchItems.
  // BUT types.ts also has `SmartPenScan` interface.
  // Let's assume for this "Space" we want the dedicated scan list OR just research items filtered.
  // Given the user said "syncs... website", and website usually lists "Items".
  // I'll fetch from `items` table filtering by device_source for now to be safe,
  // effectively treating generic Items as Scans if they are from the pen.

  // Actually, looking at types.ts SmartPenScan has `research_item_id`.
  // This implies a separation. But for the basic "List scans", probing `items` is safer as a start.
  // Let's return Item[] but cast/transform if needed, or just import ResearchItem.

  // Re-reading types.ts: SmartPenScan is separate.
  // I will try to fetch that if table exists, else fallback to items.
  // User showed `paired_pens` table, but not `scans` table. He showed `items`.
  // I'll stick to `items` where device_source='smart_pen'.

  // Wait, I can just use getAllItems() from storageService and filter in UI?
  // No, efficient to filter in query if getting many.

  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .eq("device_source", "smart_pen")
    .order("created_at", { ascending: false })
    .limit(20);

  return (data || []).map((item) => ({
    id: item.id,
    user_id: item.user_id,
    image_url: item.image_url || "",
    ocr_text: item.ocr_text || item.text,
    processed: !!item.ocr_text,
    created_at: item.created_at,
  })) as SmartPenScan[];
}

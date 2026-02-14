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
  // 1. Verify Code
  const { data: codeData, error: codeError } = await supabase
    .from("pairing_codes")
    .select("*")
    .eq("code", code)
    .single(); // Assuming code is unique

  if (codeError || !codeData) {
    return { success: false, message: "Invalid pairing code." };
  }

  // Check if expired? (Optional, if table has expires_at)
  // Check if already used? (If table has is_used)

  const deviceId = codeData.device_id || codeData.id; // Fallback
  const deviceName = codeData.device_name || "Smart Pen";

  // 2. Link User to Device (paired_pens)
  // Check if already paired
  const { data: existing } = await supabase
    .from("paired_pens")
    .select("*")
    .eq("user_id", userId)
    .eq("device_id", deviceId) // Assuming column name is device_id or similar
    .single();

  if (existing) {
    return {
      success: true,
      device: existing as SmartPenDevice,
      message: "Device already paired.",
    };
  }

  // Insert
  const { data: newPair, error: pairError } = await supabase
    .from("paired_pens")
    .insert([
      {
        user_id: userId,
        device_id: deviceId, // You might need to check your exact schema
        device_name: deviceName,
        is_connected: true,
        last_sync: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (pairError) {
    console.error("Pairing failed:", pairError);
    return {
      success: false,
      message: "Failed to pair device. Please try again.",
    };
  }

  // 3. Cleanup Code (Optional - delete or mark used)
  await supabase.from("pairing_codes").delete().eq("code", code);

  return { success: true, device: newPair as SmartPenDevice };
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

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
  // First, check if there is a connected mobile/tablet scanner device
  try {
    const { data, error } = await supabase
      .from("paired_devices")
      .select("*")
      .eq("user_id", userId)
      .eq("is_connected", true)
      .limit(1);

    if (!error && data && data.length > 0) {
      const dev = data[0];
      return {
        id: dev.id,
        user_id: dev.user_id,
        device_name: dev.device_name || "Mobile Scanner",
        is_connected: dev.is_connected,
        last_sync: dev.last_sync || dev.created_at,
      } as SmartPenDevice;
    }
  } catch (e) {
    console.warn("Failed to check paired_devices in getPairedDevice:", e);
  }

  try {
    const { data, error } = await supabase
      .from("paired_pens")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!error && data) {
      return data as SmartPenDevice;
    }

    if (error && error.code !== "PGRST116") {
      console.warn("Direct query failed (possibly RLS), falling back to Edge Function:", error);
    }
  } catch (e) {
    console.warn("Direct query exception, trying Edge Function fallback:", e);
  }

  // Edge Function Fallback
  try {
    const { data: listData, error: listError } = await supabase.functions.invoke("smart-pen", {
      body: {
        action: "list",
        user_id: userId,
      },
    });

    if (!listError && listData?.success && listData.pens) {
      const activePen = listData.pens[0];
      if (activePen) {
        return {
          ...activePen,
          id: activePen.id || activePen.pen_id,
          device_name: "ResearchMate Pen",
          is_connected: true,
          last_sync: activePen.paired_at
        } as SmartPenDevice;
      }
    }
  } catch (e) {
    console.error("Edge function fallback for getPairedDevice failed:", e);
  }

  return null;
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
      const { data: listData, error: listError } = await supabase.functions.invoke("smart-pen", {
        body: {
          action: "list",
          user_id: userId,
        },
      });

      if (listError || !listData.success) {
        return { 
          success: true, 
          device: {
            id: data.pen_id,
            user_id: userId,
            device_name: "ResearchMate Pen",
            last_sync: new Date().toISOString(),
            is_connected: true
          } as SmartPenDevice,
          message: "Device paired successfully!" 
        };
      }

      const pairedDevice = listData.pens?.find((p: any) => p.pen_id === data.pen_id);

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
  // Try deleting from paired_devices first (for mobile scanner)
  try {
    const { error } = await supabase
      .from("paired_devices")
      .delete()
      .eq("id", id);
    if (!error) return true;
  } catch (e) {
    console.warn("Failed to delete from paired_devices, falling back:", e);
  }

  try {
    const { data, error } = await supabase.functions.invoke("smart-pen", {
      body: {
        action: "unpair",
        pen_id: id,
      },
    });
    if (!error && data?.success) {
      return true;
    }
  } catch (e) {
    console.error("Failed to unpair device via Edge Function:", e);
  }

  const { error } = await supabase.from("paired_pens").delete().eq("id", id);
  return !error;
}

export async function generateSyncToken(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("smart-pen", {
      body: {
        action: "generate-sync-token",
        user_id: userId,
      },
    });

    if (!error && data?.success) {
      return data.token;
    }
  } catch (e) {
    console.error("Failed to generate sync token:", e);
  }
  return null;
}

export async function getSmartPenScans(
  userId: string,
): Promise<SmartPenScan[]> {
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .in("device_source", ["smart_pen", "mobile_scanner", "tablet_sync"])
    .order("created_at", { ascending: false })
    .limit(20);

  return (data || []).map((item) => ({
    id: item.id,
    user_id: item.user_id,
    image_url: item.image_url || "",
    ocr_text: item.ocr_text || item.text,
    processed: !!(item.ocr_text || item.text),
    created_at: item.created_at,
  })) as SmartPenScan[];
}

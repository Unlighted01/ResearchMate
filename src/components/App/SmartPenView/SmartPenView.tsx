import React, { useEffect, useRef, useState } from "react";
import {
  getPairedDevice,
  pairDevice,
  unpairDevice,
  getSmartPenScans,
} from "../../../services/smartPenService";
import { SmartPenDevice, SmartPenScan } from "../../../types";
import { getCurrentUser } from "../../../services/supabaseClient";
import {
  Loader2,
  PenTool,
  Wifi,
  Battery,
  RefreshCw,
  XCircle,
  ArrowLeft,
  Upload,
} from "lucide-react";
import { StorageItem, addItem } from "../../../services/storageService";
import { runOCR } from "../../../services/geminiService";
import { useToast } from "../../shared/ui/Toast";

interface SmartPenViewProps {
  onBack: () => void;
  onItemClick: (item: StorageItem) => void;
}

const SmartPenView: React.FC<SmartPenViewProps> = ({ onBack, onItemClick }) => {
  const [device, setDevice] = useState<SmartPenDevice | null>(null);
  const [scans, setScans] = useState<SmartPenScan[]>([]);
  const [loading, setLoading] = useState(true);
  const [pairingCode, setPairingCode] = useState("");
  const [isPairing, setIsPairing] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    setLoading(true);
    const user = await getCurrentUser();
    if (user) {
      setUserId(user.id);
      const paired = await getPairedDevice(user.id);
      setDevice(paired);
      if (paired) {
        // Load scans
        const recentScans = await getSmartPenScans(user.id);
        setScans(recentScans);
      }
    }
    setLoading(false);
  };

  const handlePair = async () => {
    if (!pairingCode.trim() || !userId) return;
    setIsPairing(true);
    setError("");

    try {
      const result = await pairDevice(userId, pairingCode.trim());
      if (result.success && result.device) {
        setDevice(result.device);
        setPairingCode("");
        // Refresh scans
        const recentScans = await getSmartPenScans(userId);
        setScans(recentScans);
      } else {
        setError(result.message || "Pairing failed");
      }
    } catch (e) {
      setError("An unexpected error occurred.");
    }
    setIsPairing(false);
  };

  const handleUnpair = async () => {
    if (!device || !confirm("Disconnect this pen?")) return;
    await unpairDevice(device.id);
    setDevice(null);
    setScans([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const rejected = files.length - imageFiles.length;
    if (imageFiles.length === 0) {
      toast("Only image files are supported for upload", "error");
      e.target.value = "";
      return;
    }
    if (rejected > 0) {
      toast(`${rejected} non-image file(s) skipped`, "info");
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: imageFiles.length });

    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      setUploadProgress({ current: i + 1, total: imageFiles.length });
      try {
        const base64DataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
        const result = await runOCR(base64DataUrl);
        if (result.ok && result.ocrText) {
          await addItem({
            text: result.ocrText,
            sourceUrl: "",
            sourceTitle: file.name,
            tags: [],
            note: "",
            deviceSource: "smart_pen",
            imageUrl: base64DataUrl,
            ocrConfidence: result.ocrConfidence,
          });
          succeeded++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setIsUploading(false);
    setUploadProgress(null);
    e.target.value = "";

    if (failed === 0) {
      toast(`Imported ${succeeded} items. Synced to your Web Dashboard!`, "success");
    } else {
      toast(`Imported ${succeeded} of ${imageFiles.length} — ${failed} failed. Synced remaining to Web.`, "info");
    }
  };

  // Convert generic scan to StorageItem structure for detail view
  const handleScanClick = (scan: SmartPenScan) => {
    const item: StorageItem = {
      id: scan.id,
      text: scan.ocr_text || "Processing...",
      tags: [],
      note: "",
      sourceUrl: "",
      sourceTitle: "Smart Pen Capture",
      createdAt: scan.created_at,
      deviceSource: "smart_pen",
      imageUrl: scan.image_url,
      ocrText: scan.ocr_text,
      ocrConfidence: scan.ocr_confidence,
    };
    onItemClick(item);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 bg-white dark:bg-gray-800">
        <button
          onClick={onBack}
          aria-label="Go back"
          className="p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group border border-gray-200 dark:border-gray-700"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
          <PenTool className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Smart Pen
          </h2>
          <p className="text-xs text-gray-500">Manage your device & notes</p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        {/* Connection Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-6 relative overflow-hidden">
          {!device ? (
            // Not Connected State
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 text-gray-400">
                <Wifi className="w-8 h-8 opacity-50" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
                Connect Your Pen
              </h3>
              <p className="text-sm text-gray-500 mb-4 px-4">
                Enter the 6-digit pairing code displayed on your Smart Pen /
                OLED screen.
              </p>

              <div className="w-full max-w-xs space-y-3">
                <input
                  type="text"
                  placeholder="e.g. 123456"
                  aria-label="Pairing code"
                  className="w-full text-center tracking-[0.5em] font-mono text-lg py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                {error && (
                  <p className="text-xs text-red-500 font-medium">{error}</p>
                )}
                <button
                  onClick={handlePair}
                  disabled={isPairing || pairingCode.length < 4}
                  aria-label="Pair device"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isPairing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Pair Device"
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Connected State
            <div>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </span>
                    <span className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">
                      Connected
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                    {device.device_name}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Last synced:{" "}
                    {new Date(device.last_sync).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full text-xs font-medium">
                    <Battery className="w-3 h-3" />
                    <span>{device.battery_level ?? 100}%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button className="flex-1 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Sync Now
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  aria-label="Upload images for OCR"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {isUploading && uploadProgress
                    ? `Processing ${uploadProgress.current} of ${uploadProgress.total}...`
                    : "Upload Images"}
                </button>
                <button
                  onClick={handleUnpair}
                  aria-label="Unpair device"
                  className="p-2 border border-gray-200 dark:border-gray-700 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Unpair"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Scans List */}
        {device && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">
              Recent Scans
            </h3>
            {scans.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">
                No notes synced yet.
              </p>
            ) : (
              <div className="space-y-3">
                {scans.map((scan) => (
                  <div
                    key={scan.id}
                    onClick={() => handleScanClick(scan)}
                    className="flex gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
                  >
                    {/* Thumbnail */}
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden flex-shrink-0">
                      {scan.image_url ? (
                        <img
                          src={scan.image_url}
                          className="w-full h-full object-cover"
                          alt="note"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <PenTool className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {scan.ocr_text || "Untitled Note"}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {scan.ocr_text ? "OCR Processed" : "Processing..."}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-2">
                        {new Date(scan.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartPenView;

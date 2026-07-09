import React, { useEffect, useRef, useState } from "react";
import {
  getPairedDevice,
  pairDevice,
  unpairDevice,
  getSmartPenScans,
  generateSyncToken,
} from "../../../services/smartPenService";
import { SmartPenDevice, SmartPenScan } from "../../../types";
import { getCurrentUser, supabase } from "../../../services/supabaseClient";
import {
  Loader2,
  PenTool,
  Wifi,
  Battery,
  XCircle,
  ArrowLeft,
  Upload,
  Smartphone,
  Tablet,
} from "lucide-react";
import { StorageItem, addItem } from "../../../services/storageService";
import { runOCRFromDataUrl } from "../../../services/geminiService";
import { useToast } from "../../shared/ui/Toast";
import { SegmentedControl } from "../../shared/ui/SegmentedControl";
import QRCode from "qrcode";

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

  // Mobile Sync & Tablet Import States
  const [activeTab, setActiveTab] = useState<"mobile" | "tablet" | "hardware">("mobile");
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

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

  // QR Code pairing generator
  useEffect(() => {
    if (activeTab === "mobile" && userId && !device) {
      const fetchToken = async () => {
        const token = await generateSyncToken(userId);
        if (token) {
          const websiteUrl = import.meta.env.VITE_WEBSITE_URL || "https://research-mate-website.vercel.app";
          const pairingUrl = `${websiteUrl}/#/mobile-sync?uid=${userId}&token=${token}`;
          try {
            const dataUrl = await QRCode.toDataURL(pairingUrl, { width: 180, margin: 2 });
            setQrCodeUrl(dataUrl);
          } catch (err) {
            console.error("QR generation error:", err);
          }
        }
      };
      fetchToken();
    }
  }, [activeTab, userId, device]);

  // Realtime Session and Scan Updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`user-sync:${userId}`);
    
    channel
      .on("broadcast", { event: "mobile-connected" }, (payload: any) => {
        setDevice({
          id: payload.deviceId || "mobile_device",
          user_id: userId,
          device_name: payload.deviceName || "Mobile Scanner",
          last_sync: new Date().toISOString(),
          is_connected: true,
        });
        toast("Mobile scanner connected!", "success");
      })
      .on("broadcast", { event: "new-scan" }, async () => {
        const recentScans = await getSmartPenScans(userId);
        setScans(recentScans);
        toast("New note synced from mobile!", "success");
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handlePair = async () => {
    if (!pairingCode.trim() || !userId) return;
    setIsPairing(true);
    setError("");

    try {
      const result = await pairDevice(userId, pairingCode.trim());
      if (result.success && result.device) {
        setDevice(result.device);
        setPairingCode("");
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
    if (!device || !confirm("Disconnect this device?")) return;
    await unpairDevice(device.id);
    setDevice(null);
    setScans([]);
    setQrCodeUrl("");
  };

  // Drag and Drop handlers for Tablet imports
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    const rejected = files.length - imageFiles.length;
    if (imageFiles.length === 0) {
      toast("Only image files are supported in this zone", "error");
      return;
    }
    if (rejected > 0) {
      toast(`${rejected} non-image file(s) skipped`, "info");
    }

    await processImageFiles(imageFiles);
  };

  const processImageFiles = async (imageFiles: File[]) => {
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
        const result = await runOCRFromDataUrl(base64DataUrl);
        if (result.ok && result.ocrText) {
          await addItem({
            text: result.ocrText,
            sourceUrl: "",
            sourceTitle: file.name,
            tags: [],
            note: "",
            deviceSource: activeTab === "tablet" ? "tablet_sync" : "smart_pen",
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

    if (userId) {
      const recentScans = await getSmartPenScans(userId);
      setScans(recentScans);
    }

    if (failed === 0) {
      toast("Imported items successfully. Synced to library!", "success");
    } else {
      toast(`Imported ${succeeded} of ${imageFiles.length} — ${failed} failed.`, "info");
    }
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

    await processImageFiles(imageFiles);
    e.target.value = "";
  };

  const handleScanClick = (scan: SmartPenScan) => {
    const item: any = {
      id: scan.id,
      text: scan.ocr_text || "Processing...",
      tags: [],
      note: "",
      sourceUrl: "",
      sourceTitle: "Handwritten Note Capture",
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
    <div className="theme-page theme-sidebar h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="theme-headerbar theme-divider p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 bg-white dark:bg-gray-800">
        <button
          onClick={onBack}
          aria-label="Go back"
          className="theme-icon-button p-2 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all group border border-gray-200 dark:border-gray-700"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        </button>
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
          <PenTool className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Mobile & Tablet Sync
          </h2>
          <p className="text-sm text-gray-500">Capture analog and tablet notes</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        {/* Connection/Input Card */}
        <div className="theme-surface bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 mb-6 relative overflow-hidden">
          {!device ? (
            <div className="flex flex-col items-center">
              <SegmentedControl
                name="activeTab"
                value={activeTab}
                onChange={(val) => setActiveTab(val as any)}
                options={[
                  {
                    value: "mobile",
                    label: "Scanner",
                    icon: <Smartphone size={14} />,
                    activeIcon: <Smartphone size={14} className="text-indigo-500" />,
                  },
                  {
                    value: "tablet",
                    label: "Tablet",
                    icon: <Tablet size={14} />,
                    activeIcon: <Tablet size={14} className="text-blue-500" />,
                  },
                  {
                    value: "hardware",
                    label: "Pen",
                    icon: <PenTool size={14} />,
                    activeIcon: <PenTool size={14} className="text-purple-500" />,
                  },
                ]}
              />
              
              <div className="w-full mt-6">
                {activeTab === "mobile" && (
                  <div className="flex flex-col items-center text-center">
                    {qrCodeUrl ? (
                      <div className="p-3 bg-white rounded-xl border border-gray-100 mb-4 shadow-inner">
                        <img src={qrCodeUrl} alt="Pairing QR Code" className="w-[160px] h-[160px]" />
                      </div>
                    ) : (
                      <div className="w-[160px] h-[160px] flex items-center justify-center bg-gray-50 dark:bg-gray-900/50 rounded-xl mb-4 border border-dashed border-gray-200">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    )}
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
                      Scan to Pair Phone
                    </h3>
                    <p className="text-sm text-gray-500 px-4 leading-relaxed">
                      Scan the QR code with your smartphone camera to open the mobile capture portal.
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-400 animate-pulse">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                      </span>
                      Waiting for connection...
                    </div>
                  </div>
                )}

                {activeTab === "tablet" && (
                  <div className="flex flex-col items-center">
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center text-center transition-all cursor-pointer ${
                        isDragging
                          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20"
                          : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 hover:bg-gray-50/50 dark:hover:bg-gray-900/30"
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      {isUploading ? (
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
                      ) : (
                        <Upload className="w-10 h-10 text-gray-400 mb-3 group-hover:text-indigo-500 transition-colors" />
                      )}
                      
                      <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                        {isUploading && uploadProgress
                           ? `Processing ${uploadProgress.current} of ${uploadProgress.total}...`
                          : "Drag & Drop Exports"}
                      </h4>
                      <p className="text-sm text-gray-500 px-4 leading-relaxed">
                        Drag GoodNotes, Kindle Scribe, or reMarkable exports here, or <span className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">browse files</span>.
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Supports PNG, JPG, JPEG, WebP
                      </p>
                    </div>
                  </div>
                )}

                {activeTab === "hardware" && (
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 text-gray-400">
                      <Wifi className="w-6 h-6 opacity-50" />
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">
                      Connect Hardware Pen
                    </h3>
                    <p className="text-sm text-gray-500 mb-4 px-4 leading-relaxed">
                      Enter the 6-digit pairing code displayed on your Smart Pen / OLED screen.
                    </p>

                    <div className="w-full max-w-xs space-y-3">
                      <input
                        type="text"
                        placeholder="e.g. 123456"
                        aria-label="Pairing code"
                        className="theme-input w-full text-center tracking-[0.5em] font-mono text-lg py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                        value={pairingCode}
                        onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
                        maxLength={6}
                      />
                      {error && (
                        <p className="text-sm text-red-500 font-medium">{error}</p>
                      )}
                      <button
                        onClick={handlePair}
                        disabled={isPairing || pairingCode.length < 4}
                        aria-label="Pair device"
                        className="theme-btn-primary w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        {isPairing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Pair Pen"
                        )}
                      </button>
                    </div>
                  </div>
                )}
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
                    <span className="text-sm font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">
                      Connected
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                    {device.device_name}
                  </h3>
                  <p className="text-sm text-gray-400">
                    Last synced:{" "}
                    {new Date(device.last_sync).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {device.battery_level !== undefined && (
                    <div className="flex items-center gap-1.5 text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full text-sm font-medium">
                      <Battery className="w-3 h-3" />
                      <span>{device.battery_level}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-4">
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
                  className="theme-btn-primary flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isUploading && uploadProgress
                    ? `Processing ${uploadProgress.current} of ${uploadProgress.total}...`
                    : "Upload Notebook Page"}
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
        {scans.length > 0 && (
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">
              Recent Scans
            </h3>
            <div className="space-y-3">
              {scans.map((scan) => (
                <div
                  key={scan.id}
                  onClick={() => handleScanClick(scan)}
                  className="flex gap-3 bg-[var(--glass-bg)] border border-[var(--glass-border)] shadow-[var(--glass-shadow)] p-3 rounded-xl cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
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
                    <h4 className="text-base font-medium text-gray-900 dark:text-white truncate">
                      {scan.ocr_text || "Untitled Note"}
                    </h4>
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                      {scan.ocr_text ? "OCR Processed" : "Processing..."}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      {new Date(scan.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartPenView;

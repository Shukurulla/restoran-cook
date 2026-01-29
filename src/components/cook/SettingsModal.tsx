"use client";

import { useState, useEffect, useRef } from "react";
import { PrinterInfo } from "@/types";
import { PrinterAPI } from "@/services/printer";
import { Button } from "@/components/ui/button";
import { BiCog, BiPrinter, BiServer, BiRefresh, BiX, BiVolumeFull, BiPlay } from "react-icons/bi";

// Mavjud ringtonelar ro'yxati
const AVAILABLE_RINGTONES = [
  { id: "mixkit", name: "Mixkit Notification", path: "/mixkit-positive-notification-951.wav" },
  { id: "callisto", name: "Callisto", path: "/callisto-170178.mp3" },
  { id: "interface", name: "Interface", path: "/interface-2-126517.mp3" },
  { id: "new-notification", name: "New Notification", path: "/new-notification-018-363746.mp3" },
  { id: "ominant", name: "Ominant", path: "/ominant-163603.mp3" },
  { id: "rising-funny", name: "Rising Funny", path: "/rising-funny-game-effect-132474.mp3" },
  { id: "xylesizer", name: "Xylesizer", path: "/xylesizer-163606.mp3" },
];

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [autoPrint, setAutoPrint] = useState(true);
  const [printCancelled, setPrintCancelled] = useState(true);
  const [serverUrl, setServerUrl] = useState("https://server.kepket.uz");
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Ringtone sozlamalari
  const [selectedRingtone, setSelectedRingtone] = useState<string>("/mixkit-positive-notification-951.wav");
  const [playingRingtone, setPlayingRingtone] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPrinters();
      const savedPrinter = localStorage.getItem("selectedPrinter");
      const savedUrl = localStorage.getItem("serverUrl");
      const savedAutoPrint = localStorage.getItem("autoPrint");
      const savedPrintCancelled = localStorage.getItem("printCancelled");
      const savedRingtone = localStorage.getItem("selectedRingtone");

      if (savedPrinter) setSelectedPrinter(savedPrinter);
      if (savedUrl) setServerUrl(savedUrl);
      if (savedAutoPrint !== null) setAutoPrint(savedAutoPrint === "true");
      if (savedPrintCancelled !== null)
        setPrintCancelled(savedPrintCancelled === "true");
      if (savedRingtone) setSelectedRingtone(savedRingtone);
    }
  }, [isOpen]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const loadPrinters = async () => {
    setIsLoadingPrinters(true);
    try {
      const printerList = await PrinterAPI.getPrinters();
      setPrinters(printerList);
      if (printerList.length > 0 && !selectedPrinter) {
        const defaultPrinter = printerList.find((p) => p.isDefault);
        if (defaultPrinter) {
          setSelectedPrinter(defaultPrinter.name);
        }
      }
    } catch (error) {
      console.error("Failed to load printers:", error);
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  const handleTestPrint = async () => {
    setIsPrinting(true);
    try {
      const result = await PrinterAPI.printTest(selectedPrinter || undefined);
      if (!result.success) {
        alert("Test chop etish xatoligi: " + result.error);
      }
    } catch {
      alert("Printer server bilan bog'lanib bo'lmadi");
    } finally {
      setIsPrinting(false);
    }
  };

  // Ringtoneni test qilish
  const handlePlayRingtone = (ringtonePath: string) => {
    // Oldingi ovozni to'xtatish
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Agar xuddi shu ringtone bo'lsa, to'xtatish
    if (playingRingtone === ringtonePath) {
      setPlayingRingtone(null);
      return;
    }

    // Yangi ovoz ijro etish
    const audio = new Audio(ringtonePath);
    audioRef.current = audio;
    setPlayingRingtone(ringtonePath);

    audio.play()
      .then(() => {
        console.log("🔊 Playing ringtone:", ringtonePath);
      })
      .catch((error) => {
        console.error("🔊 Failed to play ringtone:", error);
        setPlayingRingtone(null);
      });

    // Tugaganda stateni tozalash
    audio.onended = () => {
      setPlayingRingtone(null);
    };
  };

  const handleSave = async () => {
    // Browser localStorage ga saqlash
    localStorage.setItem("selectedPrinter", selectedPrinter);
    localStorage.setItem("serverUrl", serverUrl);
    localStorage.setItem("autoPrint", String(autoPrint));
    localStorage.setItem("printCancelled", String(printCancelled));
    localStorage.setItem("selectedRingtone", selectedRingtone);

    // Electron print server ga ham yuborish (sync qilish)
    if (selectedPrinter) {
      try {
        await fetch("http://localhost:4000/printers/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ printerName: selectedPrinter }),
        });
        console.log("Printer synced to Electron store:", selectedPrinter);
      } catch (error) {
        console.error("Failed to sync printer to Electron:", error);
      }
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card border border-border rounded-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-border">
          <h2 className="text-lg font-semibold flex items-center gap-2.5">
            <BiCog className="text-[#3b82f6]" />
            Sozlamalar
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-[#262626] transition-colors"
          >
            <BiX className="text-lg" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Printer Settings */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              <BiPrinter className="text-[#3b82f6]" />
              Printer sozlamalari
            </h3>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Printer tanlang
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  className="flex-1 h-10 px-3 bg-secondary border border-border rounded-lg text-foreground focus:border-[#3b82f6] outline-none"
                >
                  <option value="">-- Printer tanlang --</option>
                  {printers.map((printer) => (
                    <option key={printer.name} value={printer.name}>
                      {printer.displayName} {printer.isDefault && "(Default)"}
                    </option>
                  ))}
                </select>
                <button
                  onClick={loadPrinters}
                  disabled={isLoadingPrinters}
                  className="px-3 bg-secondary border border-border rounded-lg text-muted-foreground hover:text-foreground hover:bg-[#262626] transition-colors"
                >
                  <BiRefresh
                    className={isLoadingPrinters ? "animate-spin" : ""}
                  />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPrint}
                  onChange={(e) => setAutoPrint(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-secondary text-[#3b82f6] focus:ring-[#3b82f6]"
                />
                <span className="text-sm">
                  Avtomatik chop etish (yangi buyurtma kelganda)
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={printCancelled}
                  onChange={(e) => setPrintCancelled(e.target.checked)}
                  className="w-4 h-4 rounded border-border bg-secondary text-[#3b82f6] focus:ring-[#3b82f6]"
                />
                <span className="text-sm">Bekor qilinganda ham chop etish</span>
              </label>
            </div>

            <Button
              onClick={handleTestPrint}
              disabled={isPrinting || !selectedPrinter}
              className="w-full bg-primary text-primary-foreground"
            >
              <BiPrinter className="mr-2" />
              {isPrinting ? "Chop etilmoqda..." : "Test chop etish"}
            </Button>
          </div>

          {/* Ringtone Settings */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              <BiVolumeFull className="text-[#3b82f6]" />
              Ovoz sozlamalari
            </h3>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Bildirishnoma ovozi
              </label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {AVAILABLE_RINGTONES.map((ringtone) => (
                  <div
                    key={ringtone.id}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer
                      ${selectedRingtone === ringtone.path
                        ? 'bg-[#3b82f6]/10 border-[#3b82f6]'
                        : 'bg-secondary border-border hover:border-[#3b82f6]/50'
                      }`}
                    onClick={() => setSelectedRingtone(ringtone.path)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="ringtone"
                        checked={selectedRingtone === ringtone.path}
                        onChange={() => setSelectedRingtone(ringtone.path)}
                        className="w-4 h-4 text-[#3b82f6]"
                      />
                      <span className="text-sm">{ringtone.name}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayRingtone(ringtone.path);
                      }}
                      className={`p-2 rounded-lg transition-colors
                        ${playingRingtone === ringtone.path
                          ? 'bg-[#22c55e] text-white'
                          : 'bg-[#262626] text-muted-foreground hover:text-foreground'
                        }`}
                    >
                      <BiPlay className="text-lg" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Server Settings */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold">
              <BiServer className="text-[#3b82f6]" />
              Server sozlamalari
            </h3>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Server URL
              </label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                className="w-full h-10 px-3 bg-secondary border border-border rounded-lg text-foreground focus:border-[#3b82f6] outline-none"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">
                Print Server Port
              </label>
              <input
                type="text"
                value="3847"
                readOnly
                className="w-full h-10 px-3 bg-secondary border border-border rounded-lg text-muted-foreground"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-5 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Bekor qilish
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-[#22c55e] hover:bg-[#22c55e]/90 text-white"
          >
            Saqlash
          </Button>
        </div>
      </div>
    </div>
  );
}

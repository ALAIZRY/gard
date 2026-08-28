import React, { useEffect, useRef, useState } from 'react';
import { useBackButtonClose } from '../hooks/useBackButtonClose';
import {
  Camera,
  X,
  RefreshCw,
  AlertCircle,
  Check,
  SwitchCamera,
  Zap,
  ZapOff,
  Volume2,
  VolumeX,
  Vibrate,
  Sliders,
  History,
  Layers,
  Sparkles,
  Maximize2,
  ListPlus,
  Play,
  Pause,
  Trash2,
  Copy
} from 'lucide-react';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';

interface CameraBarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
  title?: string;
  allowContinuous?: boolean;
}

export interface ScannedBarcodeItem {
  id: string;
  code: string;
  timestamp: string;
}

// Shared AudioContext for instant zero-latency feedback
let sharedAudioCtx: AudioContext | null = null;

// Convert Arabic numerals to Western standard numerals
const normalizeBarcodeText = (input: string): string => {
  if (!input) return '';
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let result = input.trim();
  for (let i = 0; i < 10; i++) {
    result = result.replace(new RegExp(arabicDigits[i], 'g'), i.toString());
  }
  // Remove non-printable control chars
  return result.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
};

export const CameraBarcodeScanner: React.FC<CameraBarcodeScannerProps> = ({
  isOpen = true,
  onClose,
  onDetected,
  title = 'محرك فحص الباركود الذكي',
  allowContinuous = true
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef<boolean>(false);
  const lastScannedTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>('');

  // Scanner States
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');

  // Advanced Scanner Engine Settings
  const [isContinuousMode, setIsContinuousMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [vibrationEnabled, setVibrationEnabled] = useState<boolean>(true);
  
  // Hardware Capabilities (Torch & Zoom)
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasZoom, setHasZoom] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [maxZoom, setMaxZoom] = useState<number>(3);
  const [minZoom, setMinZoom] = useState<number>(1);

  // Scanned History (for continuous mode)
  const [scannedHistory, setScannedHistory] = useState<ScannedBarcodeItem[]>([]);
  const [lastScannedFeedback, setLastScannedFeedback] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Hook mobile back button to close camera modal
  useBackButtonClose(isOpen, onClose);
  useBackButtonClose(showHistoryModal, () => setShowHistoryModal(false));

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScannedHistory([]);
      setLastScannedFeedback(null);
      return;
    }

    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen, selectedDeviceId]);

  // Audio Beep Synthesizer - Shared Singleton for zero latency
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      if (!sharedAudioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) sharedAudioCtx = new AudioCtx();
      }
      if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(() => {});
      }
      if (sharedAudioCtx) {
        const osc = sharedAudioCtx.createOscillator();
        const gain = sharedAudioCtx.createGain();
        osc.connect(gain);
        gain.connect(sharedAudioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, sharedAudioCtx.currentTime); // High pitch crisp beep
        gain.gain.setValueAtTime(0.25, sharedAudioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, sharedAudioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(sharedAudioCtx.currentTime + 0.1);
      }
    } catch (e) {
      // Audio play ignore
    }
  };

  // Haptic Vibration Feedback
  const triggerVibration = () => {
    if (!vibrationEnabled) return;
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate([60, 30, 60]);
      } catch (e) {
        // Vibration error ignore
      }
    }
  };

  // Barcode Detection Handler
  const handleBarcodeSuccess = (rawBarcodeText: string) => {
    const cleaned = normalizeBarcodeText(rawBarcodeText);
    if (!cleaned) return;

    const now = Date.now();
    // Cooldown check: prevent scanning identical barcode within 800ms, or any scan within 200ms
    if (
      cleaned === lastScannedCodeRef.current &&
      now - lastScannedTimeRef.current < 800
    ) {
      return;
    }
    if (now - lastScannedTimeRef.current < 200) {
      return;
    }

    lastScannedTimeRef.current = now;
    lastScannedCodeRef.current = cleaned;

    playBeep();
    triggerVibration();

    // Show temporary feedback toast
    setLastScannedFeedback(cleaned);
    setTimeout(() => {
      setLastScannedFeedback((prev) => (prev === cleaned ? null : prev));
    }, 1500);

    // Add to history
    const newHistoryItem: ScannedBarcodeItem = {
      id: `scan-${now}-${Math.random().toString(36).substring(2, 6)}`,
      code: cleaned,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    setScannedHistory((prev) => [newHistoryItem, ...prev]);

    // If single scan mode, stop camera first before emitting result to prevent UI thread lock
    if (!isContinuousMode) {
      stopCamera();
      onDetected(cleaned);
      onClose();
    } else {
      onDetected(cleaned);
    }
  };

  // Initialize ZXing Reader with high-performance hints (TRY_HARDER disabled for max speed)
  const createConfiguredReader = (): BrowserMultiFormatReader => {
    const hints = new Map();
    const formats = [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    // CRITICAL: Disable TRY_HARDER to prevent CPU lag & frame drops
    hints.set(DecodeHintType.TRY_HARDER, false);

    const reader = new BrowserMultiFormatReader(hints);
    reader.timeBetweenDecodingAttempts = 40; // 40ms interval (~25fps scanning)
    return reader;
  };

  const startCamera = async () => {
    setError(null);
    setIsScanning(true);
    isScanningRef.current = true;

    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // 1. FAST PATH: Request video stream with resilient fallbacks
      let stream: MediaStream | null = null;
      
      try {
        const constraints: MediaStreamConstraints = {
          video: selectedDeviceId
            ? {
                deviceId: { exact: selectedDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err1) {
        console.warn('Initial camera constraints failed, attempting fallback facingMode:', err1);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
        } catch (err2) {
          console.warn('Environment facingMode failed, attempting basic video:', err2);
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      if (!stream) {
        throw new Error('Could not obtain video stream from any media device.');
      }

      if (!isScanningRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      // 2. Populate available video input devices in background asynchronously
      navigator.mediaDevices.enumerateDevices().then((allDevices) => {
        const vDevices = allDevices.filter((d) => d.kind === 'videoinput');
        if (vDevices.length > 0) {
          setVideoDevices(vDevices);
          if (!selectedDeviceId) {
            const currentTrack = stream.getVideoTracks()[0];
            const activeId = currentTrack?.getSettings()?.deviceId;
            if (activeId) {
              setSelectedDeviceId(activeId);
            }
          }
        }
      }).catch((e) => console.warn('Enumerate devices error:', e));

      // 3. Detect hardware capabilities (torch, zoom)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = (videoTrack.getCapabilities ? videoTrack.getCapabilities() : {}) as any;
          setHasTorch(Boolean(capabilities.torch));

          if (capabilities.zoom) {
            setHasZoom(true);
            setMinZoom(capabilities.zoom.min || 1);
            setMaxZoom(capabilities.zoom.max || 4);
            setZoomLevel(capabilities.zoom.min || 1);
          } else {
            setHasZoom(false);
          }
        } catch (capErr) {
          console.warn('Track capabilities check error:', capErr);
        }
      }

      // 4. Attach stream to video element and play instantly
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});

        // Wait briefly if dimensions aren't ready yet
        if (videoRef.current.videoWidth === 0) {
          await new Promise<void>((resolve) => {
            const video = videoRef.current;
            if (!video) return resolve();
            const checkReady = () => {
              if (video.videoWidth > 0 && video.videoHeight > 0) {
                video.removeEventListener('loadeddata', checkReady);
                video.removeEventListener('playing', checkReady);
                resolve();
              }
            };
            video.addEventListener('loadeddata', checkReady);
            video.addEventListener('playing', checkReady);
            setTimeout(resolve, 400);
          });
        }

        // 5. High-Speed Detection Engine Selection
        const hasNativeBarcodeDetector = 'BarcodeDetector' in window;

        if (hasNativeBarcodeDetector) {
          // ENGINE A: Hardware-Accelerated Native BarcodeDetector (Instant GPU execution)
          try {
            const barcodeDetector = new (window as any).BarcodeDetector({
              formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e', 'code_39', 'code_93', 'itf']
            });

            let isFrameProcessing = false;
            const detectFrame = async () => {
              if (!isScanningRef.current || !videoRef.current || videoRef.current.videoWidth === 0) return;
              if (!isFrameProcessing) {
                isFrameProcessing = true;
                try {
                  const barcodes = await barcodeDetector.detect(videoRef.current);
                  if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                    handleBarcodeSuccess(barcodes[0].rawValue);
                  }
                } catch (e) {
                  // Frame detect error ignore
                } finally {
                  isFrameProcessing = false;
                }
              }
              if (isScanningRef.current) {
                requestAnimationFrame(detectFrame);
              }
            };

            requestAnimationFrame(detectFrame);
          } catch (e) {
            console.warn('Native BarcodeDetector failed, falling back to ZXing:', e);
          }
        } else {
          // ENGINE B: ZXing Reader Fallback (For browsers without native BarcodeDetector)
          if (!codeReaderRef.current) {
            codeReaderRef.current = createConfiguredReader();
          }
          const codeReader = codeReaderRef.current;

          if (isScanningRef.current && videoRef.current && videoRef.current.videoWidth > 0) {
            try {
              const controlsPromise = codeReader.decodeFromVideoElement(
                videoRef.current,
                (result) => {
                  if (!isScanningRef.current) return;
                  if (result) {
                    const text = result.getText();
                    if (text) {
                      handleBarcodeSuccess(text);
                    }
                  }
                }
              );
              if (controlsPromise && typeof (controlsPromise as any).catch === 'function') {
                (controlsPromise as any).catch(() => {});
              }
            } catch (decodeErr) {
              console.warn('ZXing decodeFromVideoElement error:', decodeErr);
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('interrupted')) {
        return;
      }
      console.error('Camera initialization error:', err);
      if (isScanningRef.current) {
        setError(
          'تعذر الوصول للكاميرا تلقائياً. يرجى التحقق من إعطاء صلاحيات الكاميرا للمتصفح أو استخدام الإدخال اليدوي.'
        );
      }
      setIsScanning(false);
      isScanningRef.current = false;
    }
  };

  const stopCamera = () => {
    isScanningRef.current = false;
    setIsScanning(false);
    setIsTorchOn(false);

    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch (e) {}
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Toggle Flashlight/Torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        const nextState = !isTorchOn;
        await videoTrack.applyConstraints({
          advanced: [{ torch: nextState } as any]
        });
        setIsTorchOn(nextState);
      } catch (e) {
        console.warn('Could not toggle torch:', e);
      }
    }
  };

  // Change Hardware Zoom
  const changeZoom = async (newZoomLevel: number) => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      try {
        await videoTrack.applyConstraints({
          advanced: [{ zoom: newZoomLevel } as any]
        });
        setZoomLevel(newZoomLevel);
      } catch (e) {
        console.warn('Could not change zoom:', e);
      }
    }
  };

  // Switch Camera device
  const switchCamera = () => {
    if (videoDevices.length < 2) return;
    const currentIndex = videoDevices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % videoDevices.length;
    stopCamera();
    setSelectedDeviceId(videoDevices[nextIndex].deviceId);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleBarcodeSuccess(manualInput.trim());
      setManualInput('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-lg flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-900 text-white rounded-3xl shadow-2xl border border-slate-700 max-w-lg w-full overflow-hidden relative flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 dir-rtl">
        
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Camera className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base text-slate-100 flex items-center gap-1.5">
                <span>{title}</span>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  v2.5 High-Speed
                </span>
              </h3>
              <p className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>ماسح فائق السرعة يدعم كافة الترميزات العالمية</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition ${
                soundEnabled
                  ? 'bg-slate-800 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800/60 text-slate-500 border-slate-700'
              }`}
              title={soundEnabled ? 'تعطيل الصوت' : 'تفعيل الصوت'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Vibration Toggle */}
            <button
              type="button"
              onClick={() => setVibrationEnabled(!vibrationEnabled)}
              className={`p-2 rounded-xl border transition ${
                vibrationEnabled
                  ? 'bg-slate-800 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800/60 text-slate-500 border-slate-700'
              }`}
              title={vibrationEnabled ? 'تعطيل الاهتزاز' : 'تفعيل الاهتزاز'}
            >
              <Vibrate className="w-4 h-4" />
            </button>

            {/* Switch Camera */}
            {videoDevices.length > 1 && (
              <button
                type="button"
                onClick={switchCamera}
                className="p-2 text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition"
                title="تبديل الكاميرا"
              >
                <SwitchCamera className="w-4 h-4" />
              </button>
            )}

            {/* Close Modal */}
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-rose-600/30 rounded-xl border border-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video Viewport & Overlays */}
        <div className="relative aspect-video sm:aspect-4/3 bg-slate-950 flex items-center justify-center overflow-hidden shrink-0">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />

          {/* Scanner Lasers & Overlay */}
          <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_25px_#10b981] animate-pulse pointer-events-none" />

          {/* Viewfinder Target Frame */}
          <div className="absolute border-2 border-emerald-400/80 rounded-2xl w-64 sm:w-80 h-36 sm:h-44 pointer-events-none flex flex-col items-center justify-between p-2 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <div className="w-full flex justify-between">
              <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
              <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
            </div>

            <div className="bg-slate-950/85 backdrop-blur-md px-3 py-1 rounded-full border border-emerald-500/40 text-[10px] sm:text-xs text-emerald-300 font-mono font-bold flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>وجه الكاميرا بوضوح نحو ملصق الباركود</span>
            </div>

            <div className="w-full flex justify-between">
              <div className="w-b-2 border-b-2 border-r-2 border-emerald-400 w-4 h-4" />
              <div className="w-b-2 border-b-2 border-l-2 border-emerald-400 w-4 h-4" />
            </div>
          </div>

          {/* Detection Toast Banner */}
          {lastScannedFeedback && (
            <div className="absolute top-4 inset-x-4 bg-emerald-600 text-white p-2.5 rounded-2xl shadow-2xl flex items-center justify-between font-mono font-black text-xs sm:text-sm animate-in slide-in-from-top-4 duration-150 border border-emerald-300">
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 bg-white/20 rounded-full p-0.5 shrink-0" />
                <span>تم المسح بنجاح: {lastScannedFeedback}</span>
              </div>
              <span className="text-[10px] bg-emerald-800 px-2 py-0.5 rounded-full font-sans">ناجح</span>
            </div>
          )}

          {/* Quick Hardware Controls (Torch & Zoom) Floating Bar */}
          <div className="absolute bottom-3 inset-x-4 flex items-center justify-between pointer-events-auto">
            {/* Flashlight Torch */}
            {hasTorch ? (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-2.5 rounded-2xl backdrop-blur-md border text-xs font-bold flex items-center gap-1.5 transition ${
                  isTorchOn
                    ? 'bg-amber-500 text-slate-950 border-amber-300 shadow-[0_0_15px_#f59e0b]'
                    : 'bg-slate-900/80 text-white border-slate-700 hover:bg-slate-800'
                }`}
              >
                {isTorchOn ? <Zap className="w-4 h-4 fill-slate-950" /> : <ZapOff className="w-4 h-4 text-slate-400" />}
                <span>{isTorchOn ? 'الكشاف يعمل' : 'تشغيل الكشاف'}</span>
              </button>
            ) : <div />}

            {/* Hardware Zoom presets */}
            {hasZoom && (
              <div className="flex items-center gap-1 bg-slate-900/85 backdrop-blur-md p-1 rounded-2xl border border-slate-700">
                {[1, 1.5, 2, 3].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => changeZoom(level)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black font-mono transition ${
                      zoomLevel === level
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {level}x
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Control Toolbar & Mode Switcher */}
        <div className="p-3.5 sm:p-4 space-y-3 bg-slate-900 overflow-y-auto flex-1">
          
          {/* Scan Mode Toggle (Single vs Continuous Multi-Scan) */}
          {allowContinuous && (
            <div className="bg-slate-950/80 p-1.5 rounded-2xl border border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setIsContinuousMode(false)}
                className={`flex-1 py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
                  !isContinuousMode
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>مسح فردي وتسكير</span>
              </button>

              <button
                type="button"
                onClick={() => setIsContinuousMode(true)}
                className={`flex-1 py-2 px-3 rounded-xl font-bold transition flex items-center justify-center gap-1.5 ${
                  isContinuousMode
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ListPlus className="w-3.5 h-3.5" />
                <span>مسح مستمر متتابع ({scannedHistory.length})</span>
              </button>
            </div>
          )}

          {/* Error Message if camera failed */}
          {error && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-2xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Manual Barcode Input Form */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="أدخل رقم الباركود يدوياً أو استخدم القارئ السلكي..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              disabled={!manualInput.trim()}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-1 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>إدخال</span>
            </button>
          </form>

          {/* Scanned History Bar (in continuous mode) */}
          {scannedHistory.length > 0 && (
            <div className="bg-slate-950/60 rounded-2xl border border-slate-800 p-2.5 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300 font-bold px-1">
                <span className="flex items-center gap-1 text-[11px]">
                  <History className="w-3.5 h-3.5 text-indigo-400" />
                  <span>آخر الباركودات الممسوحة ({scannedHistory.length}):</span>
                </span>
                <button
                  type="button"
                  onClick={() => setScannedHistory([])}
                  className="text-[10px] text-rose-400 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>مسح القائمة</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                {scannedHistory.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-xl font-mono text-[11px] text-slate-200 flex items-center gap-2"
                  >
                    <span className="font-bold text-emerald-400">{item.code}</span>
                    <span className="text-[9px] text-slate-400">{item.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Action Close */}
          <div className="flex justify-between items-center pt-1 border-t border-slate-800">
            <span className="text-[11px] text-slate-500 font-bold">
              {isContinuousMode ? 'الكاميرا مفتوحة للمسح المتتابع المتكرر' : 'جاهز للمسح الضوئي'}
            </span>

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 rounded-xl transition"
            >
              إلغاء وإغلاق
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

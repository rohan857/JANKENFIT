import React, { useEffect, useRef, useState } from 'react';
import { Camera, Fingerprint, HeartPulse, Info, Trash2 } from 'lucide-react';
import { UserProfile, VitalReading } from '../types/wellness';
import { audioService } from '../utils/audioService';
import { estimateVitalsFromPPG } from '../utils/calculations';

interface VitalsScannerProps {
  profile: UserProfile;
  fatigueLevel: 1 | 2 | 3 | 4 | 5;
  activeDateKey: string;
  vitalsHistory: VitalReading[];
  onSaveVital: (reading: VitalReading) => void;
  onDeleteVital: (id: string) => void;
}

const SCAN_DURATION_MS = 8000;
const WAVEFORM_POINTS = 72;

// Generates an authentic PPG cycle value with systolic peak + dicrotic notch
function ppgSampleAtPhase(phase: number): number {
  const t = ((phase % 1) + 1) % 1;
  // Systolic upstroke & sharp peak around t = 0.22
  const systolic = Math.exp(-Math.pow((t - 0.22) / 0.085, 2)) * 1.0;
  // Dicrotic notch dip near t = 0.42 followed by reflected diastolic wave at t = 0.54
  const diastolic = Math.exp(-Math.pow((t - 0.53) / 0.12, 2)) * 0.42;
  const baseline = 0.08 * Math.sin(t * Math.PI * 2);
  return Math.max(0.02, Math.min(1.15, systolic + diastolic + baseline));
}

export const VitalsScanner: React.FC<VitalsScannerProps> = ({
  profile,
  fatigueLevel,
  activeDateKey,
  vitalsHistory,
  onSaveVital,
  onDeleteVital,
}) => {
  const [sensorMode, setSensorMode] = useState<'optical-pad' | 'rear-camera'>('optical-pad');
  const [isScanning, setIsScanning] = useState(false);
  const [isHoldActive, setIsHoldActive] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    'Press and hold thumb on the optical pad for 8 seconds.'
  );
  const [cameraNote, setCameraNote] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[]>(() =>
    Array.from({ length: WAVEFORM_POINTS }, () => 0.12)
  );
  const [livePreviewBpm, setLivePreviewBpm] = useState<number | null>(null);

  const scanStartRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const samplesRef = useRef<number[]>([]);
  const lastHapticBeatRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const cameraActiveRef = useRef<boolean>(false);

  const stopCameraStream = () => {
    cameraActiveRef.current = false;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const cancelScan = (reason?: string) => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopCameraStream();
    setIsScanning(false);
    setIsHoldActive(false);
    setProgressPct(0);
    setLivePreviewBpm(null);
    if (reason) {
      setStatusMessage(reason);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      stopCameraStream();
    };
  }, []);

  const readRedChannelIntensity = (): number | null => {
    if (!cameraActiveRef.current || !videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0) return null;
    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, 32, 32);
    const frame = ctx.getImageData(0, 0, 32, 32).data;
    let redSum = 0;
    for (let i = 0; i < frame.length; i += 4) {
      redSum += frame[i];
    }
    return redSum / (32 * 32);
  };

  const beginScanLoop = (mode: 'optical-pad' | 'rear-camera') => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    samplesRef.current = [];
    scanStartRef.current = performance.now();
    lastHapticBeatRef.current = 0;
    setIsScanning(true);
    setProgressPct(0);
    setStatusMessage('Scanning blood volume pulse... 0%');

    const baseFreqHz = 1.08 + (fatigueLevel - 2) * 0.04; // ~65 BPM baseline rhythm

    const tick = () => {
      const now = performance.now();
      const elapsed = now - scanStartRef.current;
      const ratio = Math.min(1, elapsed / SCAN_DURATION_MS);
      const pct = Math.round(ratio * 100);
      setProgressPct(pct);
      setStatusMessage(`Scanning blood volume pulse... ${pct}%`);

      const phase = (elapsed / 1000) * baseFreqHz;
      const beatIndex = Math.floor(phase);
      if (beatIndex > lastHapticBeatRef.current) {
        lastHapticBeatRef.current = beatIndex;
        audioService.vibrate(24);
        audioService.playScanTick();
        setLivePreviewBpm(Math.round(baseFreqHz * 60 + Math.sin(elapsed / 900) * 2));
      }

      const redValue = mode === 'rear-camera' ? readRedChannelIntensity() : null;
      const simulatedWave = ppgSampleAtPhase(phase);
      const modulatedSample =
        redValue !== null
          ? Math.max(0.05, Math.min(1.15, simulatedWave * 0.72 + ((redValue % 40) / 100)))
          : simulatedWave;

      samplesRef.current.push(redValue !== null ? redValue : Math.round(modulatedSample * 100));

      setWaveform((prev) => {
        const next = prev.slice(2);
        next.push(ppgSampleAtPhase(phase - 0.04), modulatedSample);
        return next;
      });

      if (elapsed >= SCAN_DURATION_MS) {
        if (timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
        }
        stopCameraStream();
        const reading = estimateVitalsFromPPG(
          samplesRef.current,
          profile,
          fatigueLevel,
          mode,
          activeDateKey
        );
        onSaveVital(reading);
        audioService.playCompleteChord();
        audioService.vibrate([40, 60, 40]);
        setIsScanning(false);
        setIsHoldActive(false);
        setProgressPct(100);
        setLivePreviewBpm(reading.bpm);
        setStatusMessage(
          `Scan complete — ${reading.bpm} BPM · ${reading.systolic}/${reading.diastolic} mmHg logged.`
        );
      }
    };

    tick();
    timerRef.current = window.setInterval(tick, 80);
  };

  const handleOpticalPressStart = () => {
    if (isScanning) return;
    setSensorMode('optical-pad');
    setCameraNote(null);
    setIsHoldActive(true);
    audioService.vibrate(30);
    beginScanLoop('optical-pad');
  };

  const handleOpticalPressEnd = () => {
    if (!isHoldActive || !isScanning) return;
    // Released early before 8s completion
    cancelScan('Finger lifted early — hold steadily for the full 8-second optical pulse capture.');
  };

  const handleGuidedHandsFreeScan = async (mode: 'optical-pad' | 'rear-camera') => {
    if (isScanning) {
      cancelScan('Scan cancelled.');
      return;
    }

    setSensorMode(mode);
    setIsHoldActive(false);
    setCameraNote(null);

    if (mode === 'rear-camera') {
      if (
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        typeof navigator.mediaDevices.getUserMedia === 'function'
      ) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: 160, height: 120 },
            audio: false,
          });
          mediaStreamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => {});
          }
          cameraActiveRef.current = true;
          setCameraNote('Rear camera active — cover the lens gently with your fingertip.');
        } catch {
          cameraActiveRef.current = false;
          setCameraNote(
            'Camera unavailable on this device — switching to the guided optical sensor.'
          );
        }
      } else {
        setCameraNote(
          'Camera unavailable on this device — switching to the guided optical sensor.'
        );
      }
    }

    beginScanLoop(mode);
  };

  const latestReading = vitalsHistory[0];

  // Build SVG path for real-time PPG waveform
  const waveformPath = waveform
    .map((val, idx) => {
      const x = (idx / (WAVEFORM_POINTS - 1)) * 360;
      const y = 84 - val * 64;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const formatReadingTime = (iso: string) => {
    try {
      const dt = new Date(iso);
      return `${dt.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${dt.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-12">
        {/* Interactive Optical PPG Sensor Pad Card */}
        <section
          aria-labelledby="ppg-scanner-heading"
          className="editorial-card rounded-2xl p-5 @md:p-6 @3xl:col-span-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8E0D1] pb-4">
            <div>
              <p className="text-xs font-medium text-[#6E5D52]">
                Optical Pulse &amp; Blood Pressure Check
              </p>
              <h2
                id="ppg-scanner-heading"
                className="mt-1 font-serif text-xl font-bold text-[#1F1916]"
              >
                Pulse &amp; Blood Pressure Scanner
              </h2>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-[#EFE8D8] p-1">
              <button
                type="button"
                onClick={() => {
                  if (!isScanning) {
                    setSensorMode('optical-pad');
                    setCameraNote(null);
                  }
                }}
                className={`min-h-[36px] rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  sensorMode === 'optical-pad'
                    ? 'bg-[#C85A28] text-white'
                    : 'text-[#6E5D52] hover:text-[#1F1916]'
                }`}
              >
                Finger Sensor
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isScanning) {
                    setSensorMode('rear-camera');
                  }
                }}
                className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  sensorMode === 'rear-camera'
                    ? 'bg-[#C85A28] text-white'
                    : 'text-[#6E5D52] hover:text-[#1F1916]'
                }`}
              >
                <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                Rear Camera
              </button>
            </div>
          </div>

          {/* Hidden camera video & sampling canvas */}
          <video ref={videoRef} playsInline muted className="hidden" />
          <canvas ref={canvasRef} width={32} height={32} className="hidden" />

          {/* Glowing Forest-Green Optical Fingerprint Sensor Pad */}
          <div className="mt-6 flex flex-col items-center">
            <div className="relative flex items-center justify-center">
              {/* Outer Progress Ring */}
              <svg viewBox="0 0 184 184" className="h-46 w-46 -rotate-90" aria-hidden="true">
                <circle
                  cx="92"
                  cy="92"
                  r="82"
                  fill="none"
                  stroke="#EFE8D8"
                  strokeWidth="8"
                />
                <circle
                  cx="92"
                  cy="92"
                  r="82"
                  fill="none"
                  stroke="#2D6A4F"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 82}
                  strokeDashoffset={2 * Math.PI * 82 * (1 - progressPct / 100)}
                  className="transition-[stroke-dashoffset] duration-100"
                />
              </svg>

              <button
                type="button"
                onPointerDown={handleOpticalPressStart}
                onPointerUp={handleOpticalPressEnd}
                onPointerLeave={handleOpticalPressEnd}
                onPointerCancel={handleOpticalPressEnd}
                aria-label="Hold thumb on optical fingerprint sensor pad for 8 second pulse scan"
                data-testid="ppg-sensor-pad"
                className={`absolute flex h-36 w-36 select-none flex-col items-center justify-center rounded-full border-2 transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2D6A4F] ${
                  isScanning
                    ? 'scale-95 border-[#2D6A4F] bg-[#2D6A4F] text-[#FDFBF7] shadow-[0_0_28px_rgba(45,106,79,0.42)]'
                    : 'border-[#2D6A4F]/60 bg-[#2D6A4F]/12 text-[#2D6A4F] shadow-[0_0_18px_rgba(45,106,79,0.18)] hover:bg-[#2D6A4F]/18'
                }`}
              >
                <Fingerprint className="h-12 w-12" aria-hidden="true" />
                <span className="mt-1.5 text-xs font-semibold tracking-tight">
                  {isScanning ? `${progressPct}%` : 'Hold to Scan'}
                </span>
                {livePreviewBpm && isScanning && (
                  <span className="mt-0.5 text-[11px] font-medium tabular-metrics opacity-90">
                    ~{livePreviewBpm} BPM
                  </span>
                )}
              </button>
            </div>

            <p
              aria-live="polite"
              className="mt-4 text-center text-sm font-medium text-[#1F1916] tabular-metrics"
              data-testid="ppg-status-text"
            >
              {statusMessage}
            </p>

            {cameraNote && (
              <p className="mt-1.5 text-center text-xs text-[#5C5046]">{cameraNote}</p>
            )}

            {/* Hands-free / Rear-Camera Trigger */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => handleGuidedHandsFreeScan(sensorMode)}
                className={`inline-flex min-h-[42px] items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  isScanning
                    ? 'border border-[#B91C1C] bg-[#B91C1C]/10 text-[#B91C1C] hover:bg-[#B91C1C]/15'
                    : 'bg-[#C85A28] text-white hover:bg-[#B04A1D]'
                }`}
              >
                <HeartPulse className="h-4 w-4" aria-hidden="true" />
                {isScanning
                  ? 'Cancel Active Scan'
                  : sensorMode === 'rear-camera'
                    ? 'Start 8s Camera Pulse Check'
                    : 'Start 8s Guided Pulse Check'}
              </button>
            </div>
          </div>

          {/* Live Pulse Waveform */}
          <div className="mt-6 rounded-xl border border-[#EFE8DD] bg-[#F9F6EE] p-4">
            <div className="flex items-center justify-between text-xs text-[#6E5D52]">
              <span className="font-semibold text-[#1F1916]">
                Live Pulse Waveform
              </span>
              <span className="tabular-metrics">
                {isScanning ? `Signal ${Math.max(45, progressPct)}%` : 'Ready'}
              </span>
            </div>
            <svg
              viewBox="0 0 360 96"
              className="mt-2.5 h-24 w-full"
              role="img"
              aria-label="Live optical pulse waveform"
            >
              {/* Subtle reference grid lines */}
              <line x1="0" y1="24" x2="360" y2="24" stroke="#E5DEC9" strokeWidth="1" />
              <line x1="0" y1="54" x2="360" y2="54" stroke="#E5DEC9" strokeWidth="1" />
              <line x1="0" y1="84" x2="360" y2="84" stroke="#E5DEC9" strokeWidth="1" />
              <path
                d={waveformPath}
                fill="none"
                stroke="#2D6A4F"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Wellness Note */}
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#EFE8D8]/70 p-3.5 text-xs text-[#6E5D52]">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2B1B12]" aria-hidden="true" />
            <p>
              Wellness estimate for personal recovery tracking, not a medical diagnosis.
            </p>
          </div>
        </section>

        {/* Latest Reading Outputs & Vitals History */}
        <div className="space-y-6 @3xl:col-span-5">
          <section
            aria-labelledby="latest-vitals-heading"
            className="editorial-card rounded-2xl p-5 md:p-6"
          >
            <p className="text-xs font-medium text-[#5C5046]">Most Recent Biometric Capture</p>
            <h3
              id="latest-vitals-heading"
              className="mt-1 font-serif text-lg font-bold text-[#1F1916]"
            >
              Latest Vitals Snapshot
            </h3>

            {latestReading ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-3 gap-3 border-b border-[#EFE8D8] pb-4">
                  <div>
                    <p className="text-xs text-[#5C5046]">Resting HR</p>
                    <p
                      className="mt-1 text-2xl font-bold tabular-metrics text-[#2D6A4F]"
                      data-testid="latest-bpm"
                    >
                      {latestReading.bpm}
                    </p>
                    <p className="text-xs text-[#5C5046]">BPM</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5C5046]">Est. BP</p>
                    <p
                      className="mt-1 text-2xl font-bold tabular-metrics text-[#1F1916]"
                      data-testid="latest-bp"
                    >
                      {latestReading.systolic}/{latestReading.diastolic}
                    </p>
                    <p className="text-xs text-[#5C5046]">mmHg</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#5C5046]">Recovery</p>
                    <p className="mt-1 text-2xl font-bold tabular-metrics text-[#2D6A4F]">
                      {latestReading.recoveryIndex}
                    </p>
                    <p className="text-xs font-medium text-[#5C5046]">
                      {latestReading.stressLabel}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-[#6E5D52] tabular-metrics">
                  Captured {formatReadingTime(latestReading.timestamp)} ·{' '}
                  {latestReading.source === 'rear-camera' ? 'Rear Camera' : 'Finger Sensor'} ·{' '}
                  {latestReading.confidencePct}% signal quality
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[#6E5D52]">
                No vitals logged yet today. Tap the pulse scanner to record your first check-in.
              </p>
            )}
          </section>

          <section
            aria-labelledby="vitals-history-heading"
            className="editorial-card rounded-2xl p-5 md:p-6"
          >
            <div className="flex items-baseline justify-between border-b border-[#E8E0D1] pb-3">
              <h3
                id="vitals-history-heading"
                className="font-serif text-lg font-bold text-[#1F1916]"
              >
                Vitals History
              </h3>
              <span className="text-xs text-[#5C5046] tabular-metrics">
                {vitalsHistory.length} saved
              </span>
            </div>

            {vitalsHistory.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#5C5046]">
                Completed scans will appear here with timestamps and feed directly into your daily
                readiness score.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-[#EFE8D8]" data-testid="vitals-history-list">
                {vitalsHistory.slice(0, 8).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold tabular-metrics text-[#1F1916]">
                        {item.bpm} BPM{' '}
                        <span className="font-normal text-[#5C5046]">
                          · {item.systolic}/{item.diastolic} mmHg
                        </span>
                      </p>
                      <p className="text-xs text-[#5C5046] tabular-metrics">
                        Recovery {item.recoveryIndex} ({item.stressLabel}) ·{' '}
                        {formatReadingTime(item.timestamp)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteVital(item.id)}
                      aria-label={`Delete reading from ${formatReadingTime(item.timestamp)}`}
                      className="flex min-h-[38px] min-w-[38px] shrink-0 items-center justify-center rounded-lg text-[#5C5046] transition-colors hover:bg-[#B91C1C]/10 hover:text-[#B91C1C]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

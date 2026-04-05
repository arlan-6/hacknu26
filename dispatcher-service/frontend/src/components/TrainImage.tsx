import train_white from "../assets/train_white_.png";
import train_black from "../assets/train_black_.png";
import NumberFlow from "@number-flow/react";

type ThemeMode = "dark" | "light" | "ops";

interface TrainImageProps {
  className?: string;
  temperatureC?: number;
  brakePressureKpa?: number;
  voltageV?: number;
  theme?: ThemeMode;
  showEngineFault?: boolean;
  showBrakeFault?: boolean;
  showElectricalFault?: boolean;
}

const TrainImage = ({
  className = "",
  theme = "dark",
  temperatureC = 0,
  brakePressureKpa = 0,
  voltageV = 0,
  showEngineFault = false,
  showBrakeFault = false,
  showElectricalFault = false,
}: TrainImageProps) => {
  const isDarkTheme = theme !== "light";
  const trainImage = isDarkTheme ? train_black : train_white;

  return (
    <div
      className={`group relative overflow-hidden rounded-[2rem] border border-[var(--ui-border)] bg-[var(--ui-bg)] p-8 shadow-[var(--ui-shadow)] flex flex-col justify-between ${className}`}
    >
      <style>{`
        @keyframes scan-beam {
          0% { transform: translateX(-200%) skewX(-15deg); }
          100% { transform: translateX(800%) skewX(-15deg); }
        }
        @keyframes scroll-track {
          0% { transform: translateX(0); }
          100% { transform: translateX(-40px); }
        }
      `}</style>

      {/* Deep Background Depth: Blueprint grid & lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--ui-panel)_0%,var(--ui-bg)_100%)] opacity-80" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(circle_at_center,black_40%,transparent_100%)] opacity-50" />
      
      {/* High-tech Header Module */}
      <div className="relative z-30 flex items-center justify-between mb-2">
        <div className="flex items-center gap-3 backdrop-blur-md bg-[var(--ui-panel)]/40 rounded-full px-4 py-1.5 border border-[var(--ui-border)]/50">
           <span className="relative flex h-2.5 w-2.5">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--status-info)] opacity-75"></span>
             <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--status-info)] shadow-[0_0_8px_var(--status-info)]"></span>
           </span>
           <h3 className="text-xs font-bold tracking-[0.25em] text-[var(--ui-text)] uppercase pt-0.5">
             Locomotive Digital Twin
           </h3>
        </div>
        <div className="flex gap-2 text-[9px] font-mono tracking-widest text-[var(--ui-text-muted)] uppercase">
           <span className="border border-[var(--ui-border)] px-3 py-1 rounded bg-[var(--ui-panel)]/30 backdrop-blur-sm">Sys: Online</span>
           <span className="border border-[var(--ui-border)] px-3 py-1 rounded bg-[var(--ui-panel)]/30 backdrop-blur-sm shadow-[inset_0_0_8px_rgba(59,130,246,0.2)] text-[var(--status-info)] animate-pulse">Scanning</span>
        </div>
      </div>

      {/* Central Viewport - Fixed aspect ratio to keep train grounded and markers aligned */}
      <div className="relative z-10 w-full mb-1 aspect-[21/8] bg-black/5 rounded-2xl flex flex-col items-center justify-end overflow-hidden">
        
        {/* Dynamic Sweep Scanner */}
        <div className="absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-[var(--status-info)]/10 to-transparent blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-1000 animate-[scan-beam_6s_ease-in-out_infinite_alternate]" />

        {/* HUD Crosshairs */}
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-[var(--status-info)]/20 [mask-image:radial-gradient(circle,black,transparent)]" />
        <div className="absolute left-1/2 top-0 h-full w-[1px] bg-[var(--status-info)]/20 [mask-image:radial-gradient(circle,black,transparent)]" />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 border border-[var(--status-info)]/10 rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 border border-[var(--status-info)]/10 border-dashed rounded-full transform -translate-x-1/2 -translate-y-1/2 animate-[spin_40s_linear_infinite] pointer-events-none" />

        {/* HUD Data Corner Anchors */}
        <div className="absolute top-4 left-4 w-12 h-12 border-t border-l border-[var(--status-info)]/40 rounded-tl-2xl transition-all group-hover:border-[var(--status-info)]/80 duration-500" />
        <div className="absolute top-4 right-4 w-12 h-12 border-t border-r border-[var(--status-info)]/40 rounded-tr-2xl transition-all group-hover:border-[var(--status-info)]/80 duration-500" />
        <div className="absolute bottom-10 left-4 w-12 h-12 border-b border-l border-[var(--status-info)]/40 rounded-bl-2xl transition-all group-hover:border-[var(--status-info)]/80 duration-500" />
        <div className="absolute bottom-10 right-4 w-12 h-12 border-b border-r border-[var(--status-info)]/40 rounded-br-2xl transition-all group-hover:border-[var(--status-info)]/80 duration-500" />

        {/* Floating Technical Stats (HUD Overlays) */}
        <div className="absolute top-8 left-10 flex flex-col font-mono text-left z-20 pointer-events-none">
          <div className="text-[var(--ui-text-muted)] tracking-widest uppercase text-[10px] mb-0.5">Eng. Temp</div>
          <div className={`text-2xl font-bold tabular-nums tracking-tight ${showEngineFault ? "text-[var(--status-critical)] drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "text-[var(--ui-text)]"}`}>
            <NumberFlow value={temperatureC} format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} /><span className="text-xs text-[var(--ui-text-muted)] ml-1">°C</span>
          </div>
          <div className="w-16 h-px mt-1 bg-gradient-to-r from-[var(--ui-text)] to-transparent opacity-30" />
        </div>

        <div className="absolute top-8 right-10 flex flex-col font-mono text-right z-20 pointer-events-none">
          <div className="text-[var(--ui-text-muted)] tracking-widest uppercase text-[10px] mb-0.5">Voltage Line</div>
          <div className={`text-2xl font-bold tabular-nums tracking-tight ${showElectricalFault ? "text-[var(--status-warning)] drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" : "text-[var(--ui-text)]"}`}>
            <NumberFlow value={voltageV} /><span className="text-xs text-[var(--ui-text-muted)] ml-1">V</span>
          </div>
          <div className="w-16 h-px mt-1 ml-auto bg-gradient-to-l from-[var(--ui-text)] to-transparent opacity-30" />
        </div>

        <div className="absolute bottom-16 right-10 flex flex-col font-mono text-right z-20 pointer-events-none">
          <div className="text-[var(--ui-text-muted)] tracking-widest uppercase text-[10px] mb-0.5">Brake System</div>
          <div className={`text-2xl font-bold tabular-nums tracking-tight ${showBrakeFault ? "text-[var(--status-purple)] drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" : "text-[var(--ui-text)]"}`}>
            <NumberFlow value={brakePressureKpa} format={{ maximumFractionDigits: 0 }} /><span className="text-xs text-[var(--ui-text-muted)] ml-1">kPa</span>
          </div>
          <div className="w-16 h-px mt-1 ml-auto bg-gradient-to-l from-[var(--ui-text)] to-transparent opacity-30" />
        </div>

        {/* The Train Image */}
        <img
          src={trainImage}
          alt="Locomotive side view"
          className={`relative z-30 w-full max-w-[85%] object-contain -mb-4 transition-transform duration-1000 ease-out group-hover:scale-[1.03] group-hover:-translate-y-2 ${
            isDarkTheme
              ? "drop-shadow-[0_30px_40px_rgba(0,0,0,0.85)] filter brightness-110 contrast-125"
              : "drop-shadow-[0_20px_40px_rgba(15,23,42,0.2)]"
          }`}
        />

        {/* Engine Fault Marker & Tooltip */}
        {showEngineFault && (
          <div className="absolute top-[35%] left-[48%] z-40 flex items-center group/marker transition-all duration-300">
            <span className="relative flex h-5 w-5 justify-center items-center">
              <span className="animate-ping absolute inline-flex h-10 w-10 rounded-full border border-[var(--status-critical)] opacity-50"></span>
              <span className="relative inline-flex rounded-sm h-3 w-3 bg-[var(--status-critical)] shadow-[0_0_15px_rgba(239,68,68,1)]"></span>
              {/* Sci-fi bracket crosshairs */}
              <div className="absolute inset-[-4px] border-t border-l border-[var(--status-critical)] rounded-tl-sm" />
              <div className="absolute inset-[-4px] border-b border-r border-[var(--status-critical)] rounded-br-sm" />
            </span>
            <div className="ml-4 flex items-center opacity-80 group-hover/marker:opacity-100 transition-opacity">
              <div className="h-px w-12 bg-gradient-to-r from-[var(--status-critical)] to-transparent" />
              <div className="ml-1 flex flex-col border-l-2 border-[var(--status-critical)] bg-black/60 backdrop-blur-xl px-3 py-2 text-[10px] font-mono tracking-widest text-[var(--status-critical)] uppercase shadow-lg whitespace-nowrap">
                <span className="font-bold text-white mb-0.5">Critical Subsystem</span>
                Engine Hotspot Detected
              </div>
            </div>
          </div>
        )}

        {/* Brake Fault Marker & Tooltip */}
        {showBrakeFault && (
          <div className="absolute bottom-[28%] left-[36%] z-40 flex items-center group/marker transition-all duration-300">
             <span className="relative flex h-5 w-5 justify-center items-center">
              <span className="animate-ping absolute inline-flex h-10 w-10 rounded-full border border-[var(--status-purple)] opacity-50"></span>
              <span className="relative inline-flex rounded-sm h-3 w-3 bg-[var(--status-purple)] shadow-[0_0_15px_rgba(168,85,247,1)]"></span>
              <div className="absolute inset-[-4px] border-t border-l border-[var(--status-purple)] rounded-tl-sm" />
              <div className="absolute inset-[-4px] border-b border-r border-[var(--status-purple)] rounded-br-sm" />
            </span>
            <div className="ml-4 flex items-center opacity-80 group-hover/marker:opacity-100 transition-opacity">
              <div className="h-px w-12 bg-gradient-to-r from-[var(--status-purple)] to-transparent" />
              <div className="ml-1 flex flex-col border-l-2 border-[var(--status-purple)] bg-black/60 backdrop-blur-xl px-3 py-2 text-[10px] font-mono tracking-widest text-[var(--status-purple)] uppercase shadow-lg whitespace-nowrap">
                <span className="font-bold text-white mb-0.5">Pneumatic Warning</span>
                Brake Pressure Loss
              </div>
            </div>
          </div>
        )}

        {/* Electrical Fault Marker & Tooltip */}
        {showElectricalFault && (
          <div className="absolute top-[22%] right-[25%] z-40 flex items-center flex-row-reverse group/marker transition-all duration-300">
             <span className="relative flex h-5 w-5 justify-center items-center">
              <span className="animate-ping absolute inline-flex h-10 w-10 rounded-full border border-[var(--status-warning)] opacity-50"></span>
              <span className="relative inline-flex rounded-sm h-3 w-3 bg-[var(--status-warning)] shadow-[0_0_15px_rgba(245,158,11,1)]"></span>
              <div className="absolute inset-[-4px] border-t border-r border-[var(--status-warning)] rounded-tr-sm" />
              <div className="absolute inset-[-4px] border-b border-l border-[var(--status-warning)] rounded-bl-sm" />
            </span>
            <div className="mr-4 flex items-center flex-row-reverse opacity-80 group-hover/marker:opacity-100 transition-opacity">
              <div className="h-px w-12 bg-gradient-to-l from-[var(--status-warning)] to-transparent" />
              <div className="mr-1 flex flex-col border-r-2 border-[var(--status-warning)] bg-black/60 backdrop-blur-xl px-3 py-2 text-[10px] text-right font-mono tracking-widest text-[var(--status-warning)] uppercase shadow-lg whitespace-nowrap">
                <span className="font-bold text-white mb-0.5">Traction Fault</span>
                Voltage Drop Detected
              </div>
            </div>
          </div>
        )}
        
        {/* Animated Scrolling Train Track at the exact bottom of the container */}
        <div className="absolute bottom-0 w-[200%] h-8 opacity-40 group-hover:opacity-80 transition-opacity duration-1000 [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)]">
          {/* Main rail */}
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[var(--ui-text)] to-transparent shadow-[0_0_5px_var(--ui-text)] blur-[0.5px]" />
          {/* Cross ties - sliding */}
          <div className="absolute inset-0 flex items-center gap-10 animate-[scroll-track_0.5s_linear_infinite]">
            {Array.from({ length: 40 }).map((_, idx) => (
              <div key={idx} className="h-4 w-[2px] bg-[var(--ui-text)]/70 transform -skew-x-[25deg] shadow-[1px_0_3px_rgba(255,255,255,0.2)]" />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default TrainImage;

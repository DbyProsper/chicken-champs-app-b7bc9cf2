import { useState } from "react";
import { MapPin, Check, ChevronDown } from "lucide-react";
import { useBranch } from "@/lib/branch";
import { cn } from "@/lib/utils";

export function BranchSwitcher({ compact = false }: { compact?: boolean }) {
  const { branches, active, setActive, needsPicker, dismissPicker } = useBranch();
  const [open, setOpen] = useState(false);

  if (!active) return null;
  const showModal = open || needsPicker;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-brand",
          compact ? "" : "",
        )}
      >
        <MapPin className="h-3.5 w-3.5 text-brand" />
        <span className="truncate max-w-[10rem]">{active.city}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/50 p-0 sm:p-4"
          onClick={() => { setOpen(false); dismissPicker(); }}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl bg-background border border-border shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b">
              <div className="text-xs uppercase tracking-widest text-brand font-bold">Choose your Champs</div>
              <div className="mt-1 font-display text-2xl">Which branch?</div>
              <p className="mt-1 text-xs text-muted-foreground">Menu and delivery are handled per branch.</p>
            </div>
            <div className="p-2">
              {branches.map((b) => {
                const isActive = b.id === active.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => { setActive(b); setOpen(false); }}
                    className={cn(
                      "w-full flex items-start gap-3 rounded-2xl p-3 text-left transition-colors",
                      isActive ? "bg-brand/10" : "hover:bg-muted",
                    )}
                  >
                    <div className={cn("grid h-10 w-10 place-items-center rounded-full shrink-0", isActive ? "bg-brand text-brand-foreground" : "bg-muted")}>
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold">{b.name}</div>
                        {isActive && <Check className="h-4 w-4 text-brand" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{b.address}, {b.city}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
                        Open daily {b.opens_at.slice(0, 5)} – {b.closes_at.slice(0, 5)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="p-4 pt-1">
              <button
                onClick={() => { setOpen(false); dismissPicker(); }}
                className="w-full rounded-full bg-brand py-3 text-sm font-bold text-brand-foreground hover:bg-brand-dark"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

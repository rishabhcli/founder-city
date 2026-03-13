type ScoreBarProps = {
  label: string;
  score: number;
};

export function ScoreBar({ label, score }: ScoreBarProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm font-medium text-zinc-200">
        <span>{label}</span>
        <span>{Math.round(score)}</span>
      </div>
      <div className="h-2 w-full rounded-full border border-zinc-700/70 bg-zinc-900/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-rose-300"
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}


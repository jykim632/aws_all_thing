"use client";

interface TimeRangeSelectorProps {
  value: number; // milliseconds
  onChange: (ms: number) => void;
}

const TIME_RANGES = [
  { label: "1시간", value: 60 * 60 * 1000 },
  { label: "6시간", value: 6 * 60 * 60 * 1000 },
  { label: "24시간", value: 24 * 60 * 60 * 1000 },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex gap-1">
      {TIME_RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range.value)}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            value === range.value
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

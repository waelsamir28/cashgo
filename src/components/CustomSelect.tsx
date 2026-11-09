"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export default function CustomSelect({ value, onChange, options, placeholder = "اختر...", className = "", disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      const target =
        listRef.current?.querySelector<HTMLElement>(".cselect-item.selected") ??
        (listRef.current?.firstElementChild as HTMLElement | null);
      target?.scrollIntoView({ block: "nearest" });
    }, 30);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <div ref={rootRef} className={`cselect ${open ? "is-open" : ""} ${className}`}>
      <button
        type="button"
        className="cselect-btn"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="cselect-value">{selected ? selected.label : placeholder}</span>
        <ChevronDown size={15} className="cselect-caret" />
      </button>
      {open && (
        <div ref={listRef} className="cselect-menu" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`cselect-item ${option.value === value ? "selected" : ""}`}
              onClick={() => { onChange(option.value); setOpen(false); }}
            >
              <span>
                {option.label}
                {option.hint && <small> · {option.hint}</small>}
              </span>
              {option.value === value && <Check size={14} className="cselect-check" />}
            </button>
          ))}
          {options.length === 0 && <div className="cselect-empty">لا توجد خيارات</div>}
        </div>
      )}
    </div>
  );
}

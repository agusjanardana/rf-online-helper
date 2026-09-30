"use client";

import { useId, useState } from "react";
import { useWords } from "./ui";

export function SearchSelect({
  label,
  options,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const w = useWords();
  const id = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const filtered = options.filter((option) =>
    option.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  function choose(option: string) {
    onChange(option);
    setQuery(option);
    setOpen(false);
    setActive(0);
  }
  return (
    <div
      className="guild-field guild-search-select"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
          setQuery(value);
        }
      }}
    >
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={
          open && filtered[active] ? `${id}-${active}` : undefined
        }
        autoComplete="off"
        disabled={disabled}
        required
        value={query}
        placeholder={w("Cari dan pilih…", "Search and select…")}
        onFocus={() => {
          setQuery("");
          setActive(0);
          setOpen(true);
        }}
        onClick={() => {
          if (!open) {
            setQuery("");
            setActive(0);
            setOpen(true);
          }
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((index) =>
              Math.max(
                0,
                Math.min(
                  filtered.length - 1,
                  index + (event.key === "ArrowDown" ? 1 : -1),
                ),
              ),
            );
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            if (filtered[active]) choose(filtered[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
            setQuery(value);
          }
        }}
      />
      {open && (
        <ul id={`${id}-options`} role="listbox" aria-label={label}>
          {filtered.map((option, index) => (
            <li
              key={option}
              id={`${id}-${index}`}
              role="option"
              aria-selected={option === value}
              className={index === active ? "is-active" : ""}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setActive(index)}
              onClick={() => choose(option)}
            >
              {option}
            </li>
          ))}
          {!filtered.length && (
            <li role="presentation">
              {w("Tidak ada pilihan yang cocok", "No matching options")}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

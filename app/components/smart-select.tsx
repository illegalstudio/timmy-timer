"use client";

import {
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "./icon";
import { useI18n } from "../i18n/i18n-provider";

export type SmartSelectOption = {
  value: string;
  label: string;
  hint?: string;
  color?: string;
  keywords?: string;
};

type SmartSelectProps = {
  label: string;
  name?: string;
  options: SmartSelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  required?: boolean;
  className?: string;
};

export function SmartSelect({
  label,
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  required = false,
  className = "",
}: SmartSelectProps) {
  const { locale, t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t("select.placeholder");
  const resolvedSearchPlaceholder = searchPlaceholder ?? t("select.search");
  const resolvedEmptyText = emptyText ?? t("select.noResults");
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(
    defaultValue ?? options[0]?.value ?? "",
  );
  const fallbackValue =
    options.find((option) => option.value === defaultValue)?.value ??
    options[0]?.value ??
    "";
  const selectedValue = isControlled
    ? value
    : options.some((option) => option.value === internalValue)
      ? internalValue
      : fallbackValue;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [popoverPosition, setPopoverPosition] = useState({
    left: 0,
    width: 290,
  });

  const selected = options.find((option) => option.value === selectedValue);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = normalize(query.trim(), locale);
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      normalize(
        `${option.label} ${option.hint ?? ""} ${option.keywords ?? ""}`,
        locale,
      ).includes(normalizedQuery),
    );
  }, [locale, options, query]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) return;

    function handleOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    window.addEventListener("pointerdown", handleOutside);
    return () => window.removeEventListener("pointerdown", handleOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleResize() {
      setPopoverPosition(calculatePopoverPosition(rootRef.current));
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open]);

  function choose(option: SmartSelectOption) {
    if (!isControlled) setInternalValue(option.value);
    onValueChange?.(option.value);
    setOpen(false);
    setQuery("");
    window.requestAnimationFrame(() =>
      rootRef.current
        ?.querySelector<HTMLButtonElement>(".smart-select-trigger")
        ?.focus(),
    );
  }

  function openMenu() {
    setQuery("");
    setPopoverPosition(calculatePopoverPosition(rootRef.current));
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((option) => option.value === selectedValue),
      ),
    );
    setOpen(true);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) =>
        Math.min(index + 1, filteredOptions.length - 1),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === "Enter" && filteredOptions[activeIndex]) {
      event.preventDefault();
      choose(filteredOptions[activeIndex]);
    }
  }

  return (
    <div className={`smart-select-field ${className}`} ref={rootRef}>
      <label id={`${id}-label`}>{label}</label>
      {name && <input type="hidden" name={name} value={selectedValue} />}
      <div className={`smart-select ${open ? "is-open" : ""}`}>
        <button
          className="smart-select-trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${id}-label ${id}-value`}
          data-required={required || undefined}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={handleTriggerKeyDown}
        >
          <OptionMarker option={selected} />
          <span className="smart-select-value" id={`${id}-value`}>
            <strong>{selected?.label ?? resolvedPlaceholder}</strong>
            {selected?.hint && <small>{selected.hint}</small>}
          </span>
          <Icon className="smart-select-chevron" name="chevron-down" />
        </button>

        {open && (
          <div
            className="smart-select-popover"
            style={{
              left: popoverPosition.left,
              width: popoverPosition.width,
            }}
          >
            <div className="smart-select-search">
              <Icon name="search" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={resolvedSearchPlaceholder}
                aria-label={resolvedSearchPlaceholder}
              />
            </div>
            <div
              className="smart-select-options"
              role="listbox"
              aria-labelledby={`${id}-label`}
            >
              {filteredOptions.map((option, index) => (
                <button
                  className={`smart-select-option ${
                    option.value === selectedValue ? "selected" : ""
                  } ${index === activeIndex ? "active" : ""}`}
                  type="button"
                  role="option"
                  aria-selected={option.value === selectedValue}
                  data-option-index={index}
                  key={option.value}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                >
                  <OptionMarker option={option} />
                  <span>
                    <strong>{option.label}</strong>
                    {option.hint && <small>{option.hint}</small>}
                  </span>
                  {option.value === selectedValue && <Icon name="check" />}
                </button>
              ))}
              {!filteredOptions.length && (
                <div className="smart-select-empty">
                  <Icon name="search" />
                  <span>
                    <strong>{resolvedEmptyText}</strong>
                    <small>{t("select.tryDifferent")}</small>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OptionMarker({ option }: { option?: SmartSelectOption }) {
  if (!option?.color) return null;
  return (
    <span
      className="smart-select-marker"
      style={{
        background: option.color,
        color: readableTextColor(option.color),
      }}
      aria-hidden="true"
    >
      {option.label.trim().slice(0, 1).toUpperCase() || "P"}
    </span>
  );
}

function normalize(value: string, locale: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase(locale);
}

function readableTextColor(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const [red, green, blue] = [0, 2, 4].map((index) =>
    Number.parseInt(hex.slice(index, index + 2), 16),
  );
  return red * 0.299 + green * 0.587 + blue * 0.114 > 165
    ? "#2d2038"
    : "#ffffff";
}

function calculatePopoverPosition(element: HTMLElement | null) {
  const viewportPadding = 12;
  const fallback = { left: 0, width: 290 };
  if (!element) return fallback;

  const bounds = element.getBoundingClientRect();
  const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
  const width = Math.min(Math.max(bounds.width, 290), availableWidth);
  const viewportLeft = Math.max(
    viewportPadding,
    Math.min(bounds.left, window.innerWidth - viewportPadding - width),
  );

  return {
    left: viewportLeft - bounds.left,
    width,
  };
}

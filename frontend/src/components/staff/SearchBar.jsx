import React, { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

export default function SearchBar({
  value = "",
  onSearch,
  placeholder = "Search...",
  className = "",
  debounceMs = 400,
}) {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value ?? "");
  }, [value]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch?.(inputValue);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [inputValue, debounceMs, onSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch?.(inputValue);
  };

  const handleClear = () => {
    setInputValue("");
    onSearch?.("");
  };

  return (
    <form className={`search-bar ${className}`} onSubmit={handleSubmit}>
      <Search className="search-bar__icon" size={18} />
      <input
        type="text"
        className="search-bar__input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
      />
      {inputValue ? (
        <button
          type="button"
          className="search-bar__clear"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      ) : null}
    </form>
  );
}
'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X, Check } from 'lucide-react';

const SearchableSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  labelKey = 'label',
  valueKey = 'value',
  renderOption,
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = options.filter(option => {
    const label = typeof option === 'object' ? option[labelKey] : option;
    return label?.toString().toLowerCase().includes(searchTerm.toLowerCase());
  });

  const selectedOption = options.find(option => {
    const optValue = typeof option === 'object' ? option[valueKey] : option;
    return optValue?.toString() === value?.toString();
  });

  const getDisplayLabel = (option) => {
    if (!option) return '';
    return typeof option === 'object' ? option[labelKey] : option;
  };

  const getOptionValue = (option) => {
    return typeof option === 'object' ? option[valueKey] : option;
  };

  const handleSelect = (option) => {
    onChange(getOptionValue(option));
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected Value Display */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full border border-neutral-200 rounded-lg px-3 py-2.5 text-sm flex items-center justify-between cursor-pointer transition-all ${
          disabled
            ? 'bg-neutral-100 cursor-not-allowed'
            : isOpen
              ? 'ring-2 ring-neutral-900 border-transparent'
              : 'hover:border-neutral-300 bg-white'
        }`}
      >
        <span className={selectedOption ? 'text-neutral-900' : 'text-neutral-400'}>
          {selectedOption ? getDisplayLabel(selectedOption) : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-neutral-100 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5 text-neutral-400" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-neutral-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-neutral-400"
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-sm text-neutral-500 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const optValue = getOptionValue(option);
                const isSelected = optValue?.toString() === value?.toString();

                return (
                  <div
                    key={optValue || index}
                    onClick={() => handleSelect(option)}
                    className={`px-3 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-neutral-100 text-neutral-900'
                        : 'text-neutral-700 hover:bg-neutral-50'
                    }`}
                  >
                    {renderOption ? renderOption(option) : (
                      <span>{getDisplayLabel(option)}</span>
                    )}
                    {isSelected && (
                      <Check className="w-4 h-4 text-neutral-900" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;

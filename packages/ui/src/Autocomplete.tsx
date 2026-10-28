import { Autocomplete as BaseAutocomplete } from "@base-ui/react/autocomplete";

export type AutocompleteProps = {
  /** The text in the field. */
  value: string;
  onValueChange: (value: string) => void;
  /** The texts the list offers. The user can also type any other text. */
  suggestions: readonly string[];
  placeholder?: string;
  "aria-label"?: string;
  /** Layout classes, for example width. */
  className?: string;
};

/**
 * A text field with a list of suggestions that it filters as the user
 * types, with Base UI Autocomplete inside. Its role is combobox. A pick
 * puts the suggestion in the field. Put it in a label, or give it an
 * `aria-label`.
 */
export function Autocomplete({ value, onValueChange, suggestions, placeholder, "aria-label": ariaLabel, className }: AutocompleteProps) {
  return (
    <BaseAutocomplete.Root items={suggestions} value={value} onValueChange={onValueChange}>
      <BaseAutocomplete.Input placeholder={placeholder} aria-label={ariaLabel} className={className ? `ui-combobox ${className}` : "ui-combobox"} />
      <BaseAutocomplete.Portal>
        <BaseAutocomplete.Positioner sideOffset={2} className="ui-select-positioner">
          <BaseAutocomplete.Popup className="ui-select-popup">
            <BaseAutocomplete.List>
              {(suggestion: string) => (
                <BaseAutocomplete.Item key={suggestion} value={suggestion} className="ui-select-item">
                  {suggestion}
                </BaseAutocomplete.Item>
              )}
            </BaseAutocomplete.List>
          </BaseAutocomplete.Popup>
        </BaseAutocomplete.Positioner>
      </BaseAutocomplete.Portal>
    </BaseAutocomplete.Root>
  );
}

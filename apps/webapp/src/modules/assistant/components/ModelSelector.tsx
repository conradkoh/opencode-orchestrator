'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Props for ModelSelector component.
 */
export interface ModelSelectorProps {
  /** Array of available model identifiers */
  models: string[];
  /** Currently selected model, or null if none selected */
  selectedModel: string | null;
  /** Callback fired when model selection changes */
  onModelChange: (model: string) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
}

/**
 * Selector component for choosing an AI model from available options.
 * Used when starting a new chat session with an assistant.
 *
 * @example
 * ```typescript
 * <ModelSelector
 *   models={["claude-sonnet-4-5", "gpt-4"]}
 *   selectedModel={selectedModel}
 *   onModelChange={setSelectedModel}
 * />
 * ```
 */
export function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  disabled,
}: ModelSelectorProps) {
  return (
    <Select
      value={selectedModel ?? ''}
      onValueChange={onModelChange}
      disabled={disabled || models.length === 0}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a model..." />
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model} value={model}>
            {model}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

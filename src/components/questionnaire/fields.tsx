"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export type FieldErrors = Record<string, string | undefined>;

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function Hint({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-sm text-muted-foreground">
      {children}
    </p>
  );
}

const errorId = (name: string) => `${name.replaceAll(".", "-")}-error`;
const hintId = (name: string) => `${name.replaceAll(".", "-")}-hint`;

type BaseProps = {
  name: string;
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  optional?: boolean;
};

function Optional() {
  return <span className="font-normal text-muted-foreground">(optional)</span>;
}

export function TextField({
  name,
  label,
  hint,
  error,
  optional,
  defaultValue,
  ...props
}: BaseProps & Omit<React.ComponentProps<typeof Input>, "name" | "id">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label} {optional && <Optional />}
      </Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId(name) : hint ? hintId(name) : undefined}
        {...props}
      />
      {hint && <Hint id={hintId(name)}>{hint}</Hint>}
      <FieldError id={errorId(name)} message={error} />
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  error,
  optional,
  defaultValue,
  ...props
}: BaseProps & Omit<React.ComponentProps<typeof Textarea>, "name" | "id">) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label} {optional && <Optional />}
      </Label>
      <Textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId(name) : hint ? hintId(name) : undefined}
        {...props}
      />
      {hint && <Hint id={hintId(name)}>{hint}</Hint>}
      <FieldError id={errorId(name)} message={error} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  hint,
  error,
  optional,
  options,
  placeholder,
  defaultValue,
  selectRef,
}: BaseProps & {
  options: ReadonlyArray<{ value: string; label: string }>;
  placeholder: string;
  defaultValue?: string;
  selectRef?: React.Ref<HTMLSelectElement>;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label} {optional && <Optional />}
      </Label>
      <NativeSelect
        key={defaultValue ?? ""}
        ref={selectRef}
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId(name) : hint ? hintId(name) : undefined}
        className="w-full"
      >
        <NativeSelectOption value="" disabled>
          {placeholder}
        </NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {hint && <Hint id={hintId(name)}>{hint}</Hint>}
      <FieldError id={errorId(name)} message={error} />
    </div>
  );
}

const optionClass =
  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors has-checked:border-primary has-checked:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50";

export function CheckboxGroup({
  name,
  label,
  hint,
  error,
  options,
  defaultValue = [],
  columns = 2,
}: BaseProps & {
  options: ReadonlyArray<{ value: string; label: string }>;
  defaultValue?: readonly string[];
  columns?: 1 | 2 | 3;
}) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[columns];
  return (
    <fieldset className="space-y-3" aria-describedby={error ? errorId(name) : hintId(name)}>
      <legend className="text-sm font-medium">{label}</legend>
      <Hint id={hintId(name)}>{hint ?? "Choose all that apply."}</Hint>
      <div className={`grid gap-2 ${cols}`}>
        {options.map((option) => (
          <label key={option.value} className={optionClass}>
            <input
              type="checkbox"
              name={name}
              value={option.value}
              defaultChecked={defaultValue.includes(option.value)}
              className="mt-0.5 size-4 accent-primary outline-none"
            />
            {option.label}
          </label>
        ))}
      </div>
      <FieldError id={errorId(name)} message={error} />
    </fieldset>
  );
}

export function RadioGroup({
  name,
  label,
  hint,
  error,
  options,
  defaultValue,
  columns = 2,
}: BaseProps & {
  options: ReadonlyArray<{ value: string; label: string; description?: string }>;
  defaultValue?: string;
  columns?: 1 | 2 | 3;
}) {
  const cols = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[columns];
  return (
    <fieldset
      className="space-y-3"
      aria-describedby={error ? errorId(name) : hint ? hintId(name) : undefined}
    >
      <legend className="text-sm font-medium">{label}</legend>
      {hint && <Hint id={hintId(name)}>{hint}</Hint>}
      <div className={`grid gap-2 ${cols}`}>
        {options.map((option) => (
          <label key={option.value} className={optionClass}>
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={defaultValue === option.value}
              className="mt-0.5 size-4 accent-primary outline-none"
            />
            <span className="space-y-0.5">
              <span className="block">{option.label}</span>
              {option.description && (
                <span className="block text-muted-foreground">{option.description}</span>
              )}
            </span>
          </label>
        ))}
      </div>
      <FieldError id={errorId(name)} message={error} />
    </fieldset>
  );
}

export const toOptions = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

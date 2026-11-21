import { Controller, type Control, type FieldErrors, type FieldValues, type Path } from 'react-hook-form';
import { DatePicker, TimePicker } from '@/shared/components/pickers';
import { Input, Select } from '@/shared/components/ui';

/** Campos de formulario conectados a React Hook Form (reutilizados en los tres submódulos de servicios). */
export function TextField<T extends FieldValues>({ control, name, label, errors, numeric, className, multiline }: {
  control: Control<T>; name: Path<T>; label: string; errors: FieldErrors<T>; numeric?: boolean; className?: string; multiline?: boolean;
}) {
  return (
    <Controller control={control} name={name} render={({ field }) => (
      <Input className={className ?? 'flex-1 min-w-[200px]'} label={label} multiline={multiline} keyboardType={numeric ? 'numeric' : 'default'}
        value={field.value === undefined || field.value === null ? '' : String(field.value)}
        onChangeText={(t) => field.onChange(numeric ? (t === '' ? undefined : Number(t)) : t)} onBlur={field.onBlur}
        error={errors[name]?.message as string | undefined} />
    )} />
  );
}

export function ChoiceField<T extends FieldValues>({ control, name, label, options, errors }: {
  control: Control<T>; name: Path<T>; label: string; options: readonly string[] | readonly { value: string; label: string }[]; errors: FieldErrors<T>;
}) {
  return (
    <Controller control={control} name={name} render={({ field }) => (
      <Select label={label} value={field.value ?? ''} options={options as readonly string[]} onChange={(v) => v && field.onChange(v)} error={errors[name]?.message as string | undefined} />
    )} />
  );
}

export function DateField<T extends FieldValues>({ control, name, label, errors, className }: {
  control: Control<T>; name: Path<T>; label: string; errors: FieldErrors<T>; className?: string;
}) {
  return (
    <Controller control={control} name={name} render={({ field }) => (
      <DatePicker className={className ?? 'flex-1 min-w-[200px]'} label={label} value={field.value ?? ''} onChange={field.onChange} error={errors[name]?.message as string | undefined} />
    )} />
  );
}

export function TimeField<T extends FieldValues>({ control, name, label, errors, className }: {
  control: Control<T>; name: Path<T>; label: string; errors: FieldErrors<T>; className?: string;
}) {
  return (
    <Controller control={control} name={name} render={({ field }) => (
      <TimePicker className={className ?? 'flex-1 min-w-[200px]'} label={label} value={field.value ?? ''} onChange={field.onChange} error={errors[name]?.message as string | undefined} />
    )} />
  );
}

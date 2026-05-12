type Props = {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  multiline?: boolean;
};

export function FormField({ name, label, type = "text", defaultValue, required, multiline }: Props) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {multiline ? (
        <textarea id={name} name={name} defaultValue={defaultValue} rows={4} required={required} />
      ) : (
        <input id={name} name={name} type={type} defaultValue={defaultValue} required={required} />
      )}
    </div>
  );
}

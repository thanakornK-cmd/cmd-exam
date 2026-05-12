type Props = {
  name: string;
  label: string;
  multiple?: boolean;
  accept?: string;
  hint?: string;
};

export function FileUpload({ name, label, multiple, accept, hint }: Props) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="file" multiple={multiple} accept={accept} />
      {hint ? <p className="muted">{hint}</p> : null}
    </div>
  );
}

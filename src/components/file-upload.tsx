type Props = {
  name: string;
  label: string;
  multiple?: boolean;
};

export function FileUpload({ name, label, multiple }: Props) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="file" multiple={multiple} />
    </div>
  );
}

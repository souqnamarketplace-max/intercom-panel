const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

export default function OnScreenKeyboard({
  onKey, onBackspace, onSpace,
}: {
  onKey: (char: string) => void;
  onBackspace: () => void;
  onSpace: () => void;
}) {
  return (
    <div className="osk">
      {ROWS.map((row, i) => (
        <div className="osk-row" key={i}>
          {i === 2 && <div className="osk-spacer" />}
          {row.map((char) => (
            <button key={char} className="osk-key" onClick={() => onKey(char)}>
              {char}
            </button>
          ))}
          {i === 2 && (
            <button className="osk-key osk-wide" onClick={onBackspace}>⌫</button>
          )}
        </div>
      ))}
      <div className="osk-row">
        <button className="osk-key osk-space" onClick={onSpace}>space</button>
      </div>
    </div>
  );
}

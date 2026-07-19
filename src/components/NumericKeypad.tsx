export default function NumericKeypad({
  onDigit, onBackspace, onClear,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  const pad = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'del'];
  return (
    <div className="numpad-grid">
      {pad.map((k) =>
        k === 'clear' ? (
          <button key={k} className="numpad-btn action" onClick={onClear}>Clear</button>
        ) : k === 'del' ? (
          <button key={k} className="numpad-btn action" onClick={onBackspace}>⌫</button>
        ) : (
          <button key={k} className="numpad-btn" onClick={() => onDigit(k)}>{k}</button>
        ),
      )}
    </div>
  );
}

interface PopupProps {
  text: string;
}

export function Popup({ text }: PopupProps): JSX.Element {
  return (
    <div className="flex h-screen items-center justify-center bg-transparent p-4">
      <div
        className="animate-fade-in-up rounded-popup border border-border bg-popup-bg px-8 py-6 text-center shadow-popup backdrop-blur-popup"
        style={{ maxWidth: 520 }}
      >
        <p
          className="font-arabic text-text"
          style={{ fontSize: 22, lineHeight: 1.7, fontWeight: 500 }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

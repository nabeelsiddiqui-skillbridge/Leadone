export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        The root layout's globals.css applies `bg-background` to <body> for
        every route in the app. This page is loaded inside a customer's
        iframe sized tightly to the bubble/chat panel, so an opaque body
        background would show as a solid square block around the rounded
        bubble/panel corners instead of letting the host page show through.
      */}
      <style>{`html, body { background: transparent !important; }`}</style>
      {children}
    </>
  );
}

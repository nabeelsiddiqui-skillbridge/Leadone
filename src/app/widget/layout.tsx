export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/*
        The root layout's globals.css applies `bg-background` to <body> for
        every route in the app. This page is loaded inside a customer's
        iframe sized tightly to the bubble/chat panel, so an opaque body
        background would show as a solid square block around the rounded
        bubble/panel corners instead of letting the host page show through.
        overflow: hidden is a safety net: the embed script sizes the iframe
        to match this page's content via postMessage (see widget-chat.tsx),
        and if that math is ever a pixel or two short, a scrollbar
        appearing would steal width/height from the visible area and clip
        the bubble/panel instead of just adding an invisible sliver of
        empty space.
      */}
      <style>{`html, body { background: transparent !important; overflow: hidden !important; }`}</style>
      {children}
    </>
  );
}

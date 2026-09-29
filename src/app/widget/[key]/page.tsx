import { notFound } from "next/navigation";

import { getActiveWidgetByKey } from "@/lib/widget-lookup";
import { WidgetChat } from "@/components/widget/widget-chat";

export const dynamic = "force-dynamic";

export default async function WidgetPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const { widget } = await getActiveWidgetByKey(key);

  if (!widget) notFound();

  return (
    <div className="flex h-dvh w-full items-end justify-end bg-transparent p-2">
      <WidgetChat
        widgetKey={key}
        name={widget.name}
        mode={widget.mode}
        primaryColor={widget.primary_color}
        size={widget.size}
        greetingMessage={widget.greeting_message}
      />
    </div>
  );
}

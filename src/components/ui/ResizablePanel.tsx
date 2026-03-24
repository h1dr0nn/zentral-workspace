import {
  Panel,
  Group,
  Separator,
  type GroupProps,
  type SeparatorProps,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

export function ResizablePanelGroup({
  className,
  direction,
  ...props
}: GroupProps & { direction: "horizontal" | "vertical" }) {
  // @ts-expect-error Types in this react-resizable-panels version miss direction on Group
  return <Group direction={direction} className={cn("flex h-full w-full", className)} {...props} />;
}

export const ResizablePanel = Panel;

export function ResizableHandle({
  className,
  ...props
}: SeparatorProps & { className?: string }) {
  return (
    <Separator
      className={cn(
        "relative flex w-px cursor-col-resize items-center justify-center bg-border after:absolute after:inset-y-0 after:-left-1 after:-right-1 after:content-[''] hover:bg-primary/50",
        className,
      )}
      {...props}
    />
  );
}

import CommandMenu from "@/components/functional/command-menu";
import Logo from "@/components/functional/logo";
import WindowControls from "@/components/functional/window-controls";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NO_DRAG = { ["--wails-draggable" as string]: "no-drag" };

// Header na MESMA camada do sidebar: a faixa esquerda fica sobre o sidebar e
// acompanha sua largura (expandido ↔ recolhido). É montado dentro do
// SidebarProvider (panel/-layout.tsx) para ter acesso ao `useSidebar()`.
export default function AppHeader() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    // A header inteira é uma drag region (frameless window). Zonas
    // interativas (menubar, trigger, command, controles) resetam no-drag.
    <header
      style={{ ["--wails-draggable" as string]: "drag" }}
      className="flex h-12 w-full shrink-0 items-center border-b border-border bg-background"
    >
      {/* Faixa sobre o sidebar: mesma largura, encolhe/expande junto. */}
      <div
        className={cn(
          "flex h-full shrink-0 items-center gap-2 border-r border-border px-2.5 transition-[width] duration-200 ease-linear",
          collapsed ? "w-(--sidebar-width-icon)" : "w-(--sidebar-width)",
        )}
      >
        <Logo className="h-6 w-6 shrink-0" />
        {!collapsed && (
          <>
            <span className="text-sm font-medium">Putch.</span>
            <SidebarTrigger style={NO_DRAG} className="ml-auto size-6" />
          </>
        )}
      </div>

      {/* Faixa sobre o conteúdo: command ao centro, controles de janela à
          direita. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        <div className="flex min-w-0 flex-1 items-center" />
        <CommandMenu />
        <div className="flex min-w-0 flex-1 items-center justify-end">
          <WindowControls />
        </div>
      </div>
    </header>
  );
}

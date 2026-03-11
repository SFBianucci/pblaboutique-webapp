import React from "react";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
  className?: string;
  title?: string;
}

export const Dialog = ({ open, onOpenChange, children, className, title }: DialogProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop: Más oscuro y con blur para foco total */}
      <div 
        className="fixed inset-0 bg-gray-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
        onClick={() => onOpenChange(false)}
      />
      
      {/* Content: Fondo blanco sólido garantizado, sombra profunda */}
      <div className={cn(
          "relative z-50 grid w-full max-w-lg scale-100 gap-4 bg-white p-0 shadow-2xl duration-200 sm:rounded-xl animate-in fade-in-0 zoom-in-95 border border-gray-100 overflow-hidden", 
          className
      )}>
        {/* Header estandarizado */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-white">
            {title && <h3 className="text-lg font-bold leading-none tracking-tight text-gray-900">{title}</h3>}
            <button
                onClick={() => onOpenChange(false)}
                className="rounded-full p-1 opacity-70 ring-offset-background transition-all hover:opacity-100 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
                <X className="h-5 w-5 text-gray-500" />
                <span className="sr-only">Cerrar</span>
            </button>
        </div>
        
        {/* Body scrollable si es necesario */}
        <div className="px-5 pb-5 pt-2 max-h-[85vh] overflow-y-auto custom-scrollbar">
            {children}
        </div>
      </div>
    </div>
  );
};
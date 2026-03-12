import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Menu, X } from 'lucide-react';

export const Layout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:block w-[200px] fixed inset-y-0 left-0 z-50 border-r border-gray-200 bg-[#0a1f11]">
        <Sidebar />
      </aside>

      {/* MOBILE HEADER */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0a1f11] flex items-center justify-between px-4 z-40 shadow-sm">
          <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-500/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-green-500/30">
                     <span className="text-white font-bold italic">B</span>
                </div>
                <span className="text-white font-bold tracking-tight">Bouticapp</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-white/80 hover:text-white p-2 transition-colors">
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
      </div>

      {/* MOBILE SIDEBAR */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-[240px] transform transition-transform duration-300 ease-in-out lg:hidden bg-[#0a1f11]
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
         <Sidebar onMobileClose={() => setIsMobileMenuOpen(false)} />
      </div>

      {/* Backdrop for mobile */}
      {isMobileMenuOpen && (
        <div 
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 lg:pl-[200px] flex flex-col h-screen w-full overflow-hidden bg-[#f8fafc]">
        <div className="flex-1 overflow-y-auto pt-16 lg:pt-0 scroll-smooth flex flex-col">
            <div className="flex-1 p-3 sm:p-4 flex flex-col max-w-full">
                <Outlet />
            </div>
        </div>
      </main>
    </div>
  );
};
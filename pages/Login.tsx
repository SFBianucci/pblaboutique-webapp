import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, ShieldCheck, Wrench } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simular petición de red
    setTimeout(() => {
        onLogin();
    }, 800);
  };

  return (
    <div className="min-h-screen w-full flex">
      
      {/* ==========================================
          MOBILE / TABLET LAYOUT
          Estilo: Fondo corporativo con tarjeta flotante limpia
          ========================================== */}
      <div className="lg:hidden w-full flex flex-col items-center justify-center p-4 bg-[#0a1f11] relative overflow-hidden">
        
        {/* Fondo decorativo sutil para mobile */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-[#114a28] to-[#0a1f11] z-0"></div>
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:20px_20px] z-0 pointer-events-none"></div>

        {/* Brand Header Mobile */}
        <div className="relative z-10 flex flex-col items-center mb-8 text-white">
            <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 mb-4 shadow-xl">
                <span className="text-3xl font-black italic tracking-tighter">B</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Bouticapp</h1>
            <p className="text-green-100/80 text-sm">Gestión Profesional de Talleres</p>
        </div>

        {/* Login Card Mobile */}
        <div className="relative z-10 w-full max-w-md bg-white rounded-3xl shadow-2xl p-8">
            <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">Iniciar Sesión</h2>
                <p className="text-sm text-gray-500 mt-1">Accede a tu panel de control</p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide ml-1">
                        Usuario
                    </label>
                    <Input 
                        id="email-mobile"
                        type="text" 
                        placeholder="admin@bouticapp.com" 
                        className="h-12 bg-white border-gray-200 focus:border-green-600 focus:ring-green-600/20"
                        required
                    />
                </div>
                
                <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                            Contraseña
                        </label>
                    </div>
                    <div className="relative">
                        <Input 
                            id="password-mobile"
                            type={showPassword ? "text" : "password"} 
                            placeholder="••••••••" 
                            className="h-12 pr-10 bg-white border-gray-200 focus:border-green-600 focus:ring-green-600/20"
                            required
                        />
                         <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 focus:outline-none"
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                <Button 
                    type="submit" 
                    className="w-full h-12 text-base font-bold bg-[#114a28] hover:bg-[#0d351d] active:scale-[0.98] transition-all rounded-xl shadow-lg shadow-green-900/20"
                    disabled={isLoading}
                >
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Ingresar"}
                </Button>
            </form>
            
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-400">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-medium">Conexión cifrada y segura</span>
            </div>
        </div>
        
        <p className="relative z-10 text-center text-xs text-white/40 mt-8 font-medium">
            v2025.09.29 • Bouticapp Inc.
        </p>
      </div>


      {/* ==========================================
          DESKTOP LAYOUT (Split Screen) 
          ========================================== */}
      <div className="hidden lg:grid w-full grid-cols-2 h-screen overflow-hidden bg-white">
        
        {/* Left: Brand Panel */}
        <div className="relative flex flex-col justify-between bg-[#0a1f11] p-16 text-white overflow-hidden">
            {/* Background Image Effect */}
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
            <div className="absolute inset-0 bg-gradient-to-br from-[#114a28] via-[#0a1f11] to-[#020804] opacity-95 z-0" />
            
            {/* Pattern */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff33_1px,transparent_1px)] [background-size:24px_24px] z-0 pointer-events-none"></div>

            <div className="relative z-10 flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/20">
                    <span className="text-white font-black italic text-xl tracking-tighter">B</span>
                </div>
                <span className="text-2xl font-bold tracking-tight">Bouticapp</span>
            </div>

            <div className="relative z-10 max-w-lg">
                <div className="w-12 h-1 bg-green-500 mb-8 rounded-full"></div>
                <h2 className="text-5xl font-extrabold tracking-tight mb-6 leading-tight">
                    Gestión inteligente <br/> para tu taller.
                </h2>
                <div className="space-y-5 text-lg text-gray-300 font-light">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20"><Wrench className="w-5 h-5 text-green-400" /></div>
                        <p>Control de reparaciones y stock en tiempo real.</p>
                    </div>
                    <div className="flex items-center gap-4">
                         <div className="p-2 bg-green-500/10 rounded-lg border border-green-500/20"><ShieldCheck className="w-5 h-5 text-green-400" /></div>
                        <p>Facturación automatizada con aseguradoras.</p>
                    </div>
                </div>
            </div>

            <div className="relative z-10 text-xs text-gray-500 font-medium uppercase tracking-widest">
                © 2026 Bouticapp Inc.
            </div>
        </div>

        {/* Right: Login Form */}
        <div className="flex items-center justify-center p-12 bg-white">
            <div className="w-full max-w-[420px] space-y-10">
                <div>
                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">Bienvenido</h2>
                    <p className="mt-2 text-gray-500 text-lg">Ingresa tus credenciales para continuar.</p>
                </div>

                <form className="space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Correo Electrónico</label>
                        <Input 
                          id="email-desktop"
                          type="text" 
                          placeholder="admin@bouticapp.com" 
                          className="h-12 bg-white border-gray-200 focus:border-green-600 focus:ring-green-600/20"
                          required
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-semibold text-gray-700">Contraseña</label>
                        </div>
                        <div className="relative">
                          <Input 
                            id="password-desktop"
                            type={showPassword ? "text" : "password"} 
                            placeholder="••••••••" 
                            className="h-12 pr-10 bg-white border-gray-200 focus:border-green-600 focus:ring-green-600/20"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                          >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                          </button>
                        </div>
                    </div>

                    <Button 
                        type="submit" 
                        className="w-full h-12 text-base font-bold bg-[#114a28] hover:bg-[#0d351d] shadow-xl shadow-green-900/10 hover:shadow-green-900/20 transition-all rounded-lg"
                        disabled={isLoading}
                    >
                      {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Accediendo...
                          </>
                      ) : (
                          "Iniciar Sesión"
                      )}
                    </Button>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
};
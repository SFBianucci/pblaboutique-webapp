import React from 'react';
import { 
  RefreshCw, Printer, Eye, Plus, Filter, PenLine, Trash2
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';

export const Appointments: React.FC = () => {
  const days = [
    { 
        date: "17/02 - Sábado", 
        appointments: [
            { id: 1, status: 'TERMINADO', time: "08:30", car: "Fiat Palio 12 - AA249TA", client: "Rodrigo", phone: "1140579035", insurance: "RIVADAVIA", job: "Parabrisas" },
            { id: 2, status: 'TERMINADO', time: "08:30", car: "Partner -", client: "Cristian", phone: "1168538182", insurance: "SEGUNDA", job: "Psas Partner (Orden Por Kangoo)" },
            { id: 3, status: 'TERMINADO', time: "08:30", car: "Shineray -", client: "Nicolas", phone: "-", insurance: "-", job: "-" },
        ]
    },
    { 
        date: "08/02 - Domingo", 
        appointments: [
            { id: 4, status: 'PENDIENTE', time: "08:30 / 12:30", car: "Palio 05 -", client: "Matias", phone: "1163990076", insurance: "PARTICULAR", job: "Luneta - $360.000" },
            { id: 5, status: 'PENDIENTE', time: "08:30 / 14:00", car: "Stratus - DDV-160", client: "", phone: "1161914454", insurance: "EXPERTA", job: "Parabrisas" },
            { id: 6, status: 'PENDIENTE', time: "09:00", car: "X6 - MIW781", client: "", phone: "-", insurance: "-", job: "-" },
        ]
    },
    { 
        date: "23/02 - Lunes", 
        appointments: [
            { id: 7, status: 'PENDIENTE', time: "08:30", car: "Peugeot 207 - LÍO 625", client: "Paula", phone: "1154178239", insurance: "SAN CRISTOBAL", job: "Techo Solar 207" },
            { id: 8, status: 'PENDIENTE', time: "08:30", car: "Vw Fox -", client: "Gisela", phone: "1131910670", insurance: "PARTICULAR", job: "Destape Ver Manguera Techo" },
            { id: 9, status: 'PENDIENTE', time: "09:00", car: "Chevrolet Tracker - AE528DS", client: "", phone: "-", insurance: "-", job: "-" },
        ]
    },
    {
        date: "24/02 - Martes",
        appointments: [
             { id: 10, status: 'PENDIENTE', time: "10:00", car: "P 207 - KZP 809", client: "Gonza", phone: "1134466778", insurance: "MERCANTIL", job: "Techo P 207" }
        ]
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-white p-2 rounded-lg border shadow-sm">
        <h2 className="text-xl font-bold text-gray-700 ml-2">Turnos</h2>
        
        <div className="flex items-center space-x-2">
           <Button variant="outline" className="text-gray-600 border-gray-300 bg-white">
             <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
           </Button>
           <Button variant="outline" className="text-gray-600 border-gray-300 bg-white">
             <Printer className="w-4 h-4 mr-2" /> Imprimir Turnos
           </Button>
           <Button variant="outline" className="text-gray-600 border-gray-300 bg-white">
             Ver Notas <Eye className="w-4 h-4 ml-2" />
           </Button>
           <Button className="bg-[#114a28] hover:bg-[#0e3b20]">
             Nueva Nota <Plus className="w-4 h-4 ml-1" />
           </Button>
           <Button className="bg-[#114a28] hover:bg-[#0e3b20]">
             Turno Nuevo <Plus className="w-4 h-4 ml-1" />
           </Button>
           <Button variant="outline" className="text-gray-600 border-gray-300 bg-white">
             <Filter className="w-4 h-4 mr-2" /> Filtrar
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 h-[calc(100vh-200px)] overflow-x-auto">
         {days.map((day, idx) => (
             <div key={idx} className="flex flex-col space-y-3 min-w-[300px]">
                 <div className="font-semibold text-gray-600 pl-1">{day.date}</div>
                 {day.appointments.map((apt) => (
                     <div key={apt.id} className="bg-white border rounded-lg shadow-sm p-3 relative group text-sm">
                         <div className="flex justify-between items-start mb-2">
                             <Badge variant={apt.status === 'TERMINADO' ? 'success' : 'secondary'} className={cn("text-[10px] px-1.5 py-0", apt.status === 'TERMINADO' ? 'bg-[#dcfce7] text-[#166534]' : 'bg-orange-100 text-orange-700')}>
                                 {apt.status}
                             </Badge>
                             <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button className="p-1 hover:bg-gray-100 rounded text-gray-500"><PenLine className="w-3 h-3" /></button>
                                 <button className="p-1 hover:bg-red-50 rounded text-red-500"><Trash2 className="w-3 h-3" /></button>
                             </div>
                         </div>
                         
                         <div className="font-bold text-gray-800 mb-1">{apt.time} - {apt.car}</div>
                         <div className="text-gray-600">Cliente: <span className="font-medium text-black">{apt.client}</span></div>
                         <div className="text-gray-600">Teléfono: <span className="font-medium text-black">{apt.phone}</span></div>
                         <div className="text-gray-600">Seguro: <span className="font-medium text-blue-800">{apt.insurance}</span></div>
                         <div className="text-gray-600 mb-2">Trabajo: <span className="font-medium text-black">{apt.job}</span></div>
                         
                         <div className="flex items-center space-x-3 text-[10px] text-gray-500 pt-2 border-t mt-1">
                             <span>Foto: <span className="font-bold text-black">SI</span></span>
                             <span>Polarizado: <span className="font-bold text-black">NO</span></span>
                             <span>Grabado: <span className="font-bold text-black">NO</span></span>
                         </div>
                     </div>
                 ))}
             </div>
         ))}
      </div>
    </div>
  );
};
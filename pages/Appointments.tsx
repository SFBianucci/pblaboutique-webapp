import React, { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Plus,
  Filter,
  PenLine,
  Trash2,
  CheckCircle2,
  Hammer,
  Wrench,
  Loader2,
  MessageCircle,
  CalendarIcon,
  ChevronsUpDown,
  Clock3,
  Check,
  Search,
  X,
} from 'lucide-react';
import { format, isValid, parse, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale/es';
import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { Calendar } from '../components/ui/Calendar';
import { Dialog } from '../components/ui/Dialog';
import { cn } from '../lib/utils';
import { useAuth } from '../lib/AuthContext';
import { useAppData } from '../lib/AppDataContext';

type AppointmentStatus = 'Pendiente' | 'Terminado' | 'Entregado' | 'Eliminado';

interface AppointmentItem {
  id: string;
  status: AppointmentStatus;
  dateText: string;
  dateIso: string;
  dayName: string;
  time: string;
  timeEnd: string;
  insurance: string;
  car: string;
  licensePlate: string;
  requiresPhoto: 'SI' | 'NO';
  client: string;
  phone: string;
  polarized: 'SI' | 'NO';
  engraving: 'SI' | 'NO';
  description: string;
  whatsapp: 'SI' | 'NO';
}

interface AppointmentFormState {
  date: string;
  time: string;
  timeEnd: string;
  insurance: string;
  car: string;
  licensePlate: string;
  requiresPhoto: boolean;
  client: string;
  phone: string;
  polarized: boolean;
  engraving: boolean;
  description: string;
}

type FilterStatusOption = 'pending' | 'finished' | 'delivered' | 'deleted';

interface FilterState {
  from: string;
  to: string;
  statuses: FilterStatusOption[];
  insurances: string[];
  plate: string;
}

const STATUS_OPTIONS: Array<{ value: FilterStatusOption; label: string; backend: string }> = [
  { value: 'pending', label: 'Pendiente', backend: 'pendiente' },
  { value: 'finished', label: 'Terminado', backend: 'terminado' },
  { value: 'delivered', label: 'Entregado', backend: 'entregado' },
  { value: 'deleted', label: 'Eliminado', backend: 'eliminado' },
];

const DEFAULT_FILTERS: FilterState = {
  from: '',
  to: '',
  statuses: [],
  insurances: [],
  plate: '',
};

const EMPTY_FORM: AppointmentFormState = {
  date: format(new Date(), 'yyyy-MM-dd'),
  time: '',
  timeEnd: '',
  insurance: '',
  car: '',
  licensePlate: '',
  requiresPhoto: false,
  client: '',
  phone: '',
  polarized: false,
  engraving: false,
  description: '',
};

const HOUR_OPTIONS = Array.from({ length: 48 }).map((_, idx) => {
  const totalMinutes = idx * 30;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
});

const parseTextDate = (value: string) => {
  const parsed = parse(value, 'dd/MM/yyyy', new Date());
  if (!isValid(parsed)) return null;
  return parsed;
};

const normalizePhone = (value: string) => String(value || '').replace(/[^0-9]/g, '');

const formatDateHeader = (dateIso: string) => {
  const parsed = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateIso;
  const label = format(parsed, 'dd/MM - EEEE', { locale: es });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const mapStatusToClasses: Record<AppointmentStatus, string> = {
  Pendiente: 'bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
  Terminado: 'bg-gradient-to-r from-lime-50 to-emerald-50 text-lime-700 border border-lime-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
  Entregado: 'bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-700 border border-emerald-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
  Eliminado: 'bg-gradient-to-r from-slate-100 to-slate-50 text-slate-600 border border-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]',
};

const mapStatusCardTone: Record<AppointmentStatus, string> = {
  Pendiente: 'bg-gradient-to-br from-white via-white to-amber-50/30 border-amber-100',
  Terminado: 'bg-gradient-to-br from-white via-white to-lime-50/35 border-lime-100',
  Entregado: 'bg-gradient-to-br from-white via-white to-emerald-50/35 border-emerald-100',
  Eliminado: 'bg-gradient-to-br from-white via-white to-slate-100/60 border-slate-200',
};

const mapStatusText = (status: string): AppointmentStatus => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'terminado') return 'Terminado';
  if (normalized === 'entregado' || normalized === 'retirado') return 'Entregado';
  if (normalized === 'eliminado') return 'Eliminado';
  return 'Pendiente';
};

const toWhatsAppUrl = (phone: string, text: string) => {
  const clean = normalizePhone(phone);
  if (!clean) return '';
  return `https://web.whatsapp.com/send?phone=549${clean}&text=${encodeURIComponent(text)}`;
};

const buildTurnoConfirmMessage = (appointment: AppointmentFormState) => {
  const [year, month, day] = appointment.date.split('-');
  const prettyDate = day && month && year ? `${day}/${month}/${year}` : appointment.date;

  return [
    'Hola!',
    '',
    'Tu turno fue confirmado exitosamente.',
    '',
    `Fecha: ${prettyDate}`,
    `Hora: ${appointment.time}`,
    '',
    'Direccion: Cerrito 2399, esquina Salta, Lomas del Mirador.',
    'Google Maps: https://maps.app.goo.gl/P8guR7SzPi2dVEs76',
    '',
    'Te esperamos.',
  ].join('\n');
};

const buildVehicleReadyMessage = (appointment: AppointmentItem) => {
  const lines = [
    'Hola!',
    '',
    'Tu vehiculo ya esta listo para ser retirado.',
    '',
  ];

  if (appointment.polarized === 'SI') lines.push('Recorda que tenes pendiente el pago del polarizado.');
  if (appointment.engraving === 'SI') lines.push('Recorda que tenes pendiente el pago del grabado.');

  lines.push('');
  lines.push('Horarios de atencion:');
  lines.push('- Lunes a Viernes: 8:30 a 12:30 y 14:00 a 18:00');
  lines.push('- Sabados: 8:30 a 13:00');
  lines.push('');
  lines.push('Direccion: Cerrito 2399, esquina Salta, Lomas del Mirador.');
  lines.push('Google Maps: https://maps.app.goo.gl/P8guR7SzPi2dVEs76');
  lines.push('');
  lines.push('Te esperamos.');

  return lines.join('\n');
};

const toFormFromAppointment = (appointment: AppointmentItem): AppointmentFormState => ({
  date: appointment.dateIso || format(new Date(), 'yyyy-MM-dd'),
  time: appointment.time || '',
  timeEnd: appointment.timeEnd || '',
  insurance: appointment.insurance || '',
  car: appointment.car || '',
  licensePlate: appointment.licensePlate || '',
  requiresPhoto: appointment.requiresPhoto === 'SI',
  client: appointment.client || '',
  phone: appointment.phone || '',
  polarized: appointment.polarized === 'SI',
  engraving: appointment.engraving === 'SI',
  description: appointment.description || '',
});

const extractInsuranceLabel = (item: any): string => {
  if (!item || typeof item !== 'object') return '';

  const candidates = [item.Seguro_AS, item.Nombre_AS, item.Descripcion_AS, item.Value, item.Title];
  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (text && text.toLowerCase() !== 'activo') return text;
  }

  const fallback = Object.values(item).find((value) => {
    const text = String(value || '').trim();
    return Boolean(text) && text.length <= 60 && text.toLowerCase() !== 'activo';
  });

  return String(fallback || '').trim();
};

export const Appointments: React.FC = () => {
  const { token } = useAuth();
  const { appData } = useAppData();

  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentItem | null>(null);
  const [formState, setFormState] = useState<AppointmentFormState>(EMPTY_FORM);
  const [sendWhatsAppOnSave, setSendWhatsAppOnSave] = useState(false);

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isStartTimePickerOpen, setIsStartTimePickerOpen] = useState(false);
  const [isEndTimePickerOpen, setIsEndTimePickerOpen] = useState(false);
  const [isInsurancePickerOpen, setIsInsurancePickerOpen] = useState(false);
  const [isFilterDateFromOpen, setIsFilterDateFromOpen] = useState(false);
  const [isFilterDateToOpen, setIsFilterDateToOpen] = useState(false);
  const [insuranceSearchTerm, setInsuranceSearchTerm] = useState('');

  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [selectedForFinish, setSelectedForFinish] = useState<AppointmentItem | null>(null);
  const [notifyOnFinish, setNotifyOnFinish] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<AppointmentItem | null>(null);

  const insuranceOptions = useMemo(() => {
    const fromMaster = (appData?.seguros || []).map(extractInsuranceLabel).filter(Boolean);
    const fromCurrentTurnos = appointments.map((item) => item.insurance).filter(Boolean);
    const unique = Array.from(new Set([...fromMaster, ...fromCurrentTurnos]));
    unique.sort((a, b) => a.localeCompare(b));
    return unique;
  }, [appData?.seguros, appointments]);

  const selectedDateForCalendar = useMemo(() => {
    if (!formState.date) return undefined;
    const parsed = new Date(`${formState.date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
  }, [formState.date]);

  const filteredInsuranceOptions = useMemo(() => {
    const query = insuranceSearchTerm.trim().toLowerCase();
    if (!query) return insuranceOptions;
    return insuranceOptions.filter((item) => item.toLowerCase().includes(query));
  }, [insuranceOptions, insuranceSearchTerm]);

  const draftDateFrom = useMemo(() => {
    if (!draftFilters.from) return undefined;
    const parsed = new Date(`${draftFilters.from}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
  }, [draftFilters.from]);

  const draftDateTo = useMemo(() => {
    if (!draftFilters.to) return undefined;
    const parsed = new Date(`${draftFilters.to}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
  }, [draftFilters.to]);

  const loadAppointments = async (filterToApply: FilterState) => {
    if (!token) return;

    try {
      setLoading(true);
      setErrorMessage('');

      const params = new URLSearchParams();
      if (filterToApply.from) params.set('from', filterToApply.from);
      if (filterToApply.to) params.set('to', filterToApply.to);

      if (filterToApply.statuses.length > 0) {
        const backendStatuses = STATUS_OPTIONS
          .filter((option) => filterToApply.statuses.includes(option.value))
          .map((option) => option.backend);
        params.set('status', backendStatuses.join(','));
      }

      if (filterToApply.insurances.length > 0) params.set('insurance', filterToApply.insurances.join(','));
      if (filterToApply.plate.trim()) params.set('plate', filterToApply.plate.trim());

      const response = await fetch(`/api/appointments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success || !Array.isArray(payload?.appointments)) {
        throw new Error(payload?.error || 'No se pudieron cargar los turnos');
      }

      setAppointments(
        payload.appointments.map((item: any) => ({
          ...item,
          status: mapStatusText(item.status),
        })),
      );
    } catch (error: any) {
      console.error('Load appointments error:', error);
      setErrorMessage(error?.message || 'No se pudieron cargar los turnos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAppointments(DEFAULT_FILTERS);
  }, [token]);

  const groupedAppointments = useMemo(() => {
    const groups = new Map<string, AppointmentItem[]>();

    appointments.forEach((appointment) => {
      const key = appointment.dateIso || appointment.dateText;
      const current = groups.get(key) || [];
      current.push(appointment);
      groups.set(key, current);
    });

    return Array.from(groups.entries())
      .sort((a, b) => {
        const dateA = parseTextDate(a[1][0]?.dateText || '');
        const dateB = parseTextDate(b[1][0]?.dateText || '');
        if (dateA && dateB) return dateA.getTime() - dateB.getTime();
        return String(a[0]).localeCompare(String(b[0]));
      })
      .map(([key, dayAppointments]) => ({
        key,
        title: dayAppointments[0]?.dateIso ? formatDateHeader(dayAppointments[0].dateIso) : key,
        appointments: [...dayAppointments].sort((a, b) => {
          const aIsTaller = a.insurance.trim().toUpperCase() === 'TALLER' ? 1 : 0;
          const bIsTaller = b.insurance.trim().toUpperCase() === 'TALLER' ? 1 : 0;
          if (aIsTaller !== bIsTaller) return bIsTaller - aIsTaller;

          const byTime = a.time.localeCompare(b.time);
          if (byTime !== 0) return byTime;

          return a.id.localeCompare(b.id);
        }),
      }));
  }, [appointments]);

  const openNewAppointmentModal = () => {
    setEditingAppointment(null);
    setFormState(EMPTY_FORM);
    setSendWhatsAppOnSave(false);
    setIsDatePickerOpen(false);
    setIsStartTimePickerOpen(false);
    setIsEndTimePickerOpen(false);
    setIsInsurancePickerOpen(false);
    setIsFormOpen(true);
  };

  const openEditAppointmentModal = (appointment: AppointmentItem) => {
    setEditingAppointment(appointment);
    setFormState(toFormFromAppointment(appointment));
    setSendWhatsAppOnSave(false);
    setIsDatePickerOpen(false);
    setIsStartTimePickerOpen(false);
    setIsEndTimePickerOpen(false);
    setIsInsurancePickerOpen(false);
    setIsFormOpen(true);
  };

  const runActionAndRefresh = async (action: () => Promise<void>) => {
    await action();
    await loadAppointments(filters);
  };

  const submitAppointment = async () => {
    if (!token) return;

    if (!formState.time.trim()) {
      alert('La hora de entrada es obligatoria.');
      return;
    }

    const selectedDate = parse(`${formState.date}T00:00:00`, "yyyy-MM-dd'T'HH:mm:ss", new Date());
    const today = startOfDay(new Date());
    if (!isValid(selectedDate) || startOfDay(selectedDate) < today) {
      alert('La fecha del turno no puede ser menor a hoy.');
      return;
    }

    const payload = {
      date: formState.date,
      time: formState.time,
      timeEnd: formState.timeEnd,
      insurance: formState.insurance,
      car: formState.car,
      licensePlate: formState.licensePlate,
      requiresPhoto: formState.requiresPhoto ? 'SI' : 'NO',
      client: formState.client,
      phone: formState.phone,
      polarized: formState.polarized ? 'SI' : 'NO',
      engraving: formState.engraving ? 'SI' : 'NO',
      description: formState.description,
      whatsapp: sendWhatsAppOnSave ? 'SI' : editingAppointment?.whatsapp || 'NO',
      status: editingAppointment?.status || 'Pendiente',
    };

    try {
      setProcessingMessage(editingAppointment ? 'Guardando cambios del turno...' : 'Creando turno...');

      const response = await fetch('/api/appointments', {
        method: editingAppointment ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: editingAppointment?.id,
          appointment: payload,
        }),
      });

      const responsePayload = await response.json().catch(() => null);
      if (!response.ok || !responsePayload?.success) {
        throw new Error(responsePayload?.error || 'No se pudo guardar el turno');
      }

      if (sendWhatsAppOnSave) {
        const url = toWhatsAppUrl(formState.phone, buildTurnoConfirmMessage(formState));
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      }

      setIsFormOpen(false);
      setEditingAppointment(null);
      await loadAppointments(filters);
    } catch (error: any) {
      console.error('Save appointment error:', error);
      alert(error?.message || 'No se pudo guardar el turno.');
    } finally {
      setProcessingMessage(null);
    }
  };

  const openFinishModal = (appointment: AppointmentItem) => {
    setSelectedForFinish(appointment);
    setNotifyOnFinish(Boolean(normalizePhone(appointment.phone)));
    setIsFinishModalOpen(true);
  };

  const finishAppointment = async () => {
    if (!token || !selectedForFinish) return;

    const hasPhone = Boolean(normalizePhone(selectedForFinish.phone));

    try {
      setProcessingMessage('Actualizando turno a Terminado...');

      const response = await fetch('/api/appointments', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: selectedForFinish.id,
          action: 'finish',
          markWhatsappSent: notifyOnFinish && hasPhone,
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo terminar el turno');
      }

      if (notifyOnFinish && hasPhone) {
        const url = toWhatsAppUrl(selectedForFinish.phone, buildVehicleReadyMessage(selectedForFinish));
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      }

      setSelectedForFinish(null);
      setIsFinishModalOpen(false);
      await loadAppointments(filters);
    } catch (error: any) {
      console.error('Finish appointment error:', error);
      alert(error?.message || 'No se pudo terminar el turno.');
    } finally {
      setProcessingMessage(null);
    }
  };

  const deleteAppointment = async (appointment: AppointmentItem) => {
    if (!token) return;

    try {
      setProcessingMessage('Eliminando turno...');
      await runActionAndRefresh(async () => {
        const response = await fetch('/api/appointments', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id: appointment.id, action: 'delete' }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'No se pudo eliminar el turno');
        }
      });
    } catch (error: any) {
      console.error('Delete appointment error:', error);
      alert(error?.message || 'No se pudo eliminar el turno.');
    } finally {
      setProcessingMessage(null);
    }
  };

  const openDeleteModal = (appointment: AppointmentItem) => {
    setSelectedForDelete(appointment);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteAppointment = async () => {
    if (!selectedForDelete) return;
    await deleteAppointment(selectedForDelete);
    setIsDeleteModalOpen(false);
    setSelectedForDelete(null);
  };

  const deliverAppointment = async (appointment: AppointmentItem) => {
    if (!token) return;

    try {
      setProcessingMessage('Registrando retiro del auto...');
      await runActionAndRefresh(async () => {
        const response = await fetch('/api/appointments', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ id: appointment.id, action: 'deliver' }),
        });

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || 'No se pudo registrar la entrega');
        }
      });
    } catch (error: any) {
      console.error('Deliver appointment error:', error);
      alert(error?.message || 'No se pudo registrar la entrega.');
    } finally {
      setProcessingMessage(null);
    }
  };

  const toggleDraftStatus = (value: FilterStatusOption) => {
    setDraftFilters((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(value)
        ? prev.statuses.filter((item) => item !== value)
        : [...prev.statuses, value],
    }));
  };

  const toggleDraftInsurance = (insurance: string) => {
    setDraftFilters((prev) => ({
      ...prev,
      insurances: prev.insurances.includes(insurance)
        ? prev.insurances.filter((item) => item !== insurance)
        : [...prev.insurances, insurance],
    }));
  };

  const applyFilters = async () => {
    const fromDate = draftFilters.from ? new Date(`${draftFilters.from}T00:00:00`) : null;
    const toDate = draftFilters.to ? new Date(`${draftFilters.to}T00:00:00`) : null;

    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      alert('La fecha desde no puede ser mayor a la fecha hasta.');
      return;
    }

    setFilters(draftFilters);
    setIsFilterOpen(false);
    await loadAppointments(draftFilters);
  };

  const clearFilters = async () => {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setInsuranceSearchTerm('');
    setIsFilterOpen(false);
    setIsFilterDateFromOpen(false);
    setIsFilterDateToOpen(false);
    await loadAppointments(DEFAULT_FILTERS);
  };

  const activeFiltersCount = [
    Boolean(filters.from),
    Boolean(filters.to),
    filters.statuses.length > 0,
    filters.insurances.length > 0,
    Boolean(filters.plate.trim()),
  ].filter(Boolean).length;

  const hasPhoneForFinish = Boolean(normalizePhone(selectedForFinish?.phone || ''));

  const inputBaseStyles =
    'flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 font-sans ring-offset-background placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm';
  const labelStyles = 'text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1 block';

  return (
    <div className="space-y-4">
      {loading && (
        <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all duration-300">
          <div className="bg-white/90 p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-[240px] w-full mx-4 border border-white/20">
            <Loader2 className="w-8 h-8 text-[#113123] animate-spin mb-3" />
            <h2 className="text-[#113123] text-lg font-bold mb-1 tracking-tight">Sincronizando...</h2>
            <p className="text-gray-600 text-[10px] text-center leading-relaxed">
              Actualizando turnos del tablero.
            </p>
          </div>
        </div>
      )}

      {processingMessage && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 px-5 py-4 w-[320px] max-w-[90vw]">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-[#114a28]" />
              <span className="text-sm font-semibold text-gray-700">{processingMessage}</span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="pl-1">
            <h2 className="text-[34px] leading-none font-extrabold tracking-tight text-slate-800">Turnos</h2>
            <p className="mt-1 text-sm font-medium text-slate-500">
              Vista de agenda · {appointments.length} turnos en {groupedAppointments.length} dias
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-10 text-slate-600 border-slate-200 hover:bg-slate-50 rounded-xl font-medium"
            onClick={() => loadAppointments(filters)}
            isLoading={loading}
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
          </Button>

          <Button className="h-10 rounded-xl bg-[#0f5a33] hover:bg-[#0c4a2a] text-white font-semibold shadow-sm" onClick={openNewAppointmentModal}>
            Turno Nuevo <Plus className="w-4 h-4 ml-1" />
          </Button>

          <Popover.Root
            open={isFilterOpen}
            onOpenChange={(open) => {
              if (open) {
                setDraftFilters(filters);
                setInsuranceSearchTerm('');
              } else {
                setDraftFilters(filters);
                setInsuranceSearchTerm('');
                setIsFilterDateFromOpen(false);
                setIsFilterDateToOpen(false);
              }
              setIsFilterOpen(open);
            }}
          >
            <Popover.Trigger asChild>
              <Button variant="outline" className="h-10 text-slate-600 border-slate-200 hover:bg-slate-50 rounded-xl font-medium">
                <Filter className="w-4 h-4 mr-2" />
                Filtrar
                {activeFiltersCount > 0 ? (
                  <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#114a28] px-1.5 text-[11px] font-bold text-white">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="end"
                sideOffset={-40}
                side="bottom"
                className="z-[9999] w-[360px] max-w-[92vw] rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
              >
                <div className="bg-slate-50/60 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-semibold text-slate-700">Filtros</span>
                  </div>
                  <button
                    className="p-1.5 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setIsFilterOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Filtros Activos</p>
                    <p className="mt-2 text-[12px] font-medium text-slate-500">
                      {activeFiltersCount > 0 ? `Hay ${activeFiltersCount} filtros aplicados.` : 'Sin filtros por estado o seguro.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">Desde</label>
                      <Popover.Root open={isFilterDateFromOpen} onOpenChange={setIsFilterDateFromOpen}>
                        <Popover.Trigger asChild>
                          <Button variant="outline" className="h-9 w-full justify-start text-left font-normal bg-white hover:bg-slate-50 border-slate-200/80 shadow-sm text-sm px-3">
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                            <span className={cn('truncate', !draftDateFrom && 'text-slate-400')}>
                              {draftDateFrom ? format(draftDateFrom, 'dd/MM/yyyy') : 'Fecha'}
                            </span>
                          </Button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content data-filter-submenu="true" className="w-auto p-0 bg-white rounded-xl border border-slate-200 shadow-xl z-[9999]" align="start">
                            <Calendar
                              mode="single"
                              selected={draftDateFrom}
                              onSelect={(date) => {
                                const newValue = date ? format(date, 'yyyy-MM-dd') : '';
                                setDraftFilters((prev) => ({ ...prev, from: newValue }));
                                setIsFilterDateFromOpen(false);
                              }}
                            />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-500">Hasta</label>
                      <Popover.Root open={isFilterDateToOpen} onOpenChange={setIsFilterDateToOpen}>
                        <Popover.Trigger asChild>
                          <Button variant="outline" className="h-9 w-full justify-start text-left font-normal bg-white hover:bg-slate-50 border-slate-200/80 shadow-sm text-sm px-3">
                            <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                            <span className={cn('truncate', !draftDateTo && 'text-slate-400')}>
                              {draftDateTo ? format(draftDateTo, 'dd/MM/yyyy') : 'Fecha'}
                            </span>
                          </Button>
                        </Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Content data-filter-submenu="true" className="w-auto p-0 bg-white rounded-xl border border-slate-200 shadow-xl z-[9999]" align="start">
                            <Calendar
                              mode="single"
                              selected={draftDateTo}
                              onSelect={(date) => {
                                const newValue = date ? format(date, 'yyyy-MM-dd') : '';
                                setDraftFilters((prev) => ({ ...prev, to: newValue }));
                                setIsFilterDateToOpen(false);
                              }}
                            />
                          </Popover.Content>
                        </Popover.Portal>
                      </Popover.Root>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-600">Buscar por patente</label>
                    <Input
                      value={draftFilters.plate}
                      onChange={(event) => setDraftFilters((prev) => ({ ...prev, plate: event.target.value.toUpperCase() }))}
                      placeholder="Ej: AA123BB"
                    />
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-gray-600 block mb-2">Estados</span>
                    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 max-h-44 overflow-y-auto">
                      {STATUS_OPTIONS.map((option) => (
                        <label key={option.value} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            checked={draftFilters.statuses.includes(option.value)}
                            onChange={() => toggleDraftStatus(option.value)}
                            className="h-4 w-4 rounded border-gray-300 text-[#114a28] focus:ring-[#114a28]"
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-gray-600 block mb-2">Seguros</span>
                    <div className="relative mb-2">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={insuranceSearchTerm}
                        onChange={(event) => setInsuranceSearchTerm(event.target.value)}
                        placeholder="Buscar seguro..."
                        className="h-9 rounded-lg border-slate-200 pl-8 text-sm"
                      />
                    </div>
                    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3 max-h-44 overflow-y-auto">
                      {filteredInsuranceOptions.length === 0 ? (
                        <p className="text-sm text-gray-500">No hay seguros disponibles.</p>
                      ) : (
                        filteredInsuranceOptions.map((insurance) => (
                          <label key={insurance} className="flex items-center gap-2 text-sm text-gray-700">
                            <input
                              type="checkbox"
                              checked={draftFilters.insurances.includes(insurance)}
                              onChange={() => toggleDraftInsurance(insurance)}
                              className="h-4 w-4 rounded border-gray-300 text-[#114a28] focus:ring-[#114a28]"
                            />
                            {insurance}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-4 pt-0 flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={clearFilters}>
                    Limpiar
                  </Button>
                  <Button className="bg-[#114a28] hover:bg-[#0e3b20]" onClick={applyFilters}>
                    Aplicar filtros
                  </Button>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div>
      ) : null}

      <div className="h-[calc(100vh-125px)] overflow-x-auto overflow-y-hidden pr-1">
        {groupedAppointments.length === 0 && !loading ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
            No hay turnos para los filtros actuales.
          </div>
        ) : null}

        <div className="flex min-w-max items-start gap-4 pb-2 h-full">
          {groupedAppointments.map((group) => (
            <div key={group.key} className="flex w-[336px] flex-shrink-0 flex-col gap-2 h-full">
              <div className="rounded-xl border border-slate-200/80 bg-white/90 px-3 py-2 text-[20px] font-extrabold text-slate-700 tracking-tight shadow-[0_8px_20px_-18px_rgba(15,23,42,0.7)] backdrop-blur-sm">
                {group.title}
                <div className="mt-1 h-[2px] w-12 rounded-full bg-gradient-to-r from-[#114a28] to-emerald-400/70" />
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2">
                {group.appointments.map((appointment) => {
                const isTaller = appointment.insurance.trim().toUpperCase() === 'TALLER';
                const appointmentDate = parseTextDate(appointment.dateText);
                const canFinish =
                  appointment.status === 'Pendiente' &&
                  Boolean(appointmentDate) &&
                  startOfDay(new Date()).getTime() >= startOfDay(appointmentDate as Date).getTime();
                const vehicleParts = [appointment.car?.trim(), appointment.licensePlate?.trim()].filter(Boolean);
                const vehicleSummary = vehicleParts.length > 0 ? vehicleParts.join(' - ') : 'Sin auto ni patente';

                return (
                  <div
                    key={appointment.id}
                    className={cn(
                      'relative group rounded-2xl p-3 text-[13px] border shadow-sm transition-all duration-200 hover:-translate-y-[1px] hover:shadow-lg hover:border-slate-300',
                      mapStatusCardTone[appointment.status],
                      isTaller
                        ? 'bg-gradient-to-br from-[#eef3fb] via-[#e8effa] to-[#dde7f7] border-[#9eb4d5] border-2 shadow-[0_12px_24px_-16px_rgba(27,54,96,0.55)]'
                        : 'border-[#d8dde7] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)]',
                    )}
                  >
                    <div className="pointer-events-none absolute left-0 top-4 h-10 w-[3px] rounded-r-full bg-gradient-to-b from-slate-300/70 to-slate-400/40 group-hover:from-[#114a28]/70 group-hover:to-emerald-400/60" />
                    <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.65),transparent_45%)]" />

                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <Badge className={cn('text-[10px] px-2.5 py-0.5 uppercase font-bold tracking-wide', mapStatusToClasses[appointment.status])}>
                        {appointment.status}
                      </Badge>

                      <div className="relative z-[1] flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        {canFinish ? (
                          <button
                            className="rounded-md p-1 text-emerald-700 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-colors"
                            title="Terminar turno"
                            onClick={() => openFinishModal(appointment)}
                          >
                            <span className="inline-flex items-center">
                              <Wrench className="w-3.5 h-3.5" />
                              <Hammer className="w-3.5 h-3.5 -ml-1" />
                            </span>
                          </button>
                        ) : null}

                        {appointment.status === 'Terminado' ? (
                          <button
                            className="rounded-md p-1 text-blue-700 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-colors"
                            title="Retirar auto"
                            onClick={() => deliverAppointment(appointment)}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        ) : null}

                        {appointment.status !== 'Eliminado' && appointment.status !== 'Terminado' ? (
                          <button
                            className="rounded-md p-1 text-gray-600 hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors"
                            title="Editar turno"
                            onClick={() => openEditAppointmentModal(appointment)}
                          >
                            <PenLine className="w-4 h-4" />
                          </button>
                        ) : null}

                        {appointment.status !== 'Eliminado' && appointment.status !== 'Terminado' ? (
                          <button
                            className="rounded-md p-1 text-red-500 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                            title="Eliminar turno"
                            onClick={() => openDeleteModal(appointment)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <p className="relative z-[1] mb-1.5 font-extrabold text-[13px] leading-tight tracking-tight text-slate-900">
                      {appointment.time}
                      {appointment.timeEnd ? ` / ${appointment.timeEnd}` : ''}
                      {' - '}
                      {vehicleSummary}
                    </p>

                    <p className="relative z-[1] mb-0.5 text-slate-500 leading-tight">
                      Cliente: <span className="font-semibold text-slate-900">{appointment.client || '-'}</span>
                    </p>
                    <p className="relative z-[1] mb-0.5 text-slate-500 leading-tight">
                      Telefono: <span className="font-semibold text-slate-900">{appointment.phone || '-'}</span>
                    </p>
                    <p className="relative z-[1] mb-0.5 text-slate-500 leading-tight">
                      Seguro: <span className="font-semibold text-slate-900">{appointment.insurance || '-'}</span>
                    </p>
                    <p className="relative z-[1] mb-1.5 text-slate-500 leading-tight">
                      Trabajo: <span className="font-semibold text-slate-900">{appointment.description || '-'}</span>
                    </p>

                    <div className="relative z-[1] mb-1 border-t border-dashed border-slate-300/90" />

                    <div className="relative z-[1] flex flex-wrap gap-x-2.5 gap-y-0.5 text-[12px] leading-tight text-slate-500">
                      <span className="rounded-md bg-slate-100/70 px-1.5 py-0.5">
                        Foto: <span className="font-bold text-slate-900">{appointment.requiresPhoto}</span>
                      </span>
                      <span className="rounded-md bg-slate-100/70 px-1.5 py-0.5">
                        Polarizado: <span className="font-bold text-slate-900">{appointment.polarized}</span>
                      </span>
                      <span className="rounded-md bg-slate-100/70 px-1.5 py-0.5">
                        Grabado: <span className="font-bold text-slate-900">{appointment.engraving}</span>
                      </span>
                      <span className="rounded-md bg-slate-100/70 px-1.5 py-0.5">
                        WhatsApp: <span className="font-bold text-slate-900">{appointment.whatsapp}</span>
                      </span>
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingAppointment(null);
            setFormState(EMPTY_FORM);
            setIsDatePickerOpen(false);
            setIsStartTimePickerOpen(false);
            setIsEndTimePickerOpen(false);
            setIsInsurancePickerOpen(false);
          }
          setIsFormOpen(open);
        }}
        title={editingAppointment ? 'Editar Turno' : 'Nuevo Turno'}
        className="max-w-3xl"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-12 rounded-lg border border-gray-100 bg-gray-50/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Datos del turno</p>
          </div>

          <div className="md:col-span-3">
            <label className={labelStyles}>Fecha *</label>
            <Popover.Root open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen} modal={true}>
              <Popover.Trigger asChild>
                <Button variant="outline" className={cn(inputBaseStyles, 'justify-start text-left font-normal hover:bg-white')}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                  {selectedDateForCalendar ? format(selectedDateForCalendar, 'dd/MM/yyyy') : 'Seleccionar fecha'}
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="w-auto p-0 bg-white rounded-lg border border-gray-200 shadow-2xl z-[9999]" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDateForCalendar}
                    onSelect={(date) => {
                      if (!date) return;
                      const today = startOfDay(new Date());
                      if (startOfDay(date) < today) return;
                      setFormState((prev) => ({ ...prev, date: format(date, 'yyyy-MM-dd') }));
                      setIsDatePickerOpen(false);
                    }}
                  />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          <div className="md:col-span-3">
            <label className={labelStyles}>Hora entrada *</label>
            <Popover.Root open={isStartTimePickerOpen} onOpenChange={setIsStartTimePickerOpen} modal={true}>
              <Popover.Trigger asChild>
                <Button variant="outline" role="combobox" className={cn(inputBaseStyles, 'justify-between font-normal hover:bg-white')}>
                  <span className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-gray-500" />
                    {formState.time || '--:--'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="w-[var(--radix-popover-trigger-width)] p-0 bg-white rounded-lg border border-gray-200 shadow-2xl z-[9999] overflow-hidden">
                  <Command className="overflow-hidden bg-white">
                    <Command.Input
                      placeholder="Buscar hora..."
                      className="flex h-10 w-full border-b border-gray-100 bg-transparent px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    />
                    <Command.List className="max-h-[240px] overflow-y-auto p-1">
                      <Command.Empty className="py-4 text-center text-sm text-gray-500">Sin horarios</Command.Empty>
                      {HOUR_OPTIONS.map((timeOption) => (
                        <Command.Item
                          key={timeOption}
                          value={timeOption}
                          onSelect={() => {
                            setFormState((prev) => ({ ...prev, time: timeOption }));
                            setIsStartTimePickerOpen(false);
                          }}
                          className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none text-gray-900 hover:bg-green-50"
                        >
                          <Check className={cn('mr-2 h-4 w-4', formState.time === timeOption ? 'opacity-100' : 'opacity-0')} />
                          {timeOption}
                        </Command.Item>
                      ))}
                    </Command.List>
                  </Command>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          <div className="md:col-span-3">
            <label className={labelStyles}>Hora salida aprox</label>
            <Popover.Root open={isEndTimePickerOpen} onOpenChange={setIsEndTimePickerOpen} modal={true}>
              <Popover.Trigger asChild>
                <Button variant="outline" role="combobox" className={cn(inputBaseStyles, 'justify-between font-normal hover:bg-white')}>
                  <span className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-gray-500" />
                    {formState.timeEnd || '--:--'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="w-[var(--radix-popover-trigger-width)] p-0 bg-white rounded-lg border border-gray-200 shadow-2xl z-[9999] overflow-hidden">
                  <Command className="overflow-hidden bg-white">
                    <Command.Input
                      placeholder="Buscar hora..."
                      className="flex h-10 w-full border-b border-gray-100 bg-transparent px-3 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                    />
                    <Command.List className="max-h-[240px] overflow-y-auto p-1">
                      <Command.Empty className="py-4 text-center text-sm text-gray-500">Sin horarios</Command.Empty>
                      {HOUR_OPTIONS.map((timeOption) => (
                        <Command.Item
                          key={`end-${timeOption}`}
                          value={timeOption}
                          onSelect={() => {
                            setFormState((prev) => ({ ...prev, timeEnd: timeOption }));
                            setIsEndTimePickerOpen(false);
                          }}
                          className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none text-gray-900 hover:bg-green-50"
                        >
                          <Check className={cn('mr-2 h-4 w-4', formState.timeEnd === timeOption ? 'opacity-100' : 'opacity-0')} />
                          {timeOption}
                        </Command.Item>
                      ))}
                    </Command.List>
                  </Command>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          <div className="md:col-span-3">
            <label className={labelStyles}>Seguro</label>
            <Popover.Root open={isInsurancePickerOpen} onOpenChange={setIsInsurancePickerOpen} modal={true}>
              <Popover.Trigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={isInsurancePickerOpen}
                  className={cn(inputBaseStyles, 'justify-between font-normal hover:bg-white')}
                >
                  <span className={cn('truncate', !formState.insurance && 'text-gray-400')}>
                    {formState.insurance || 'Seleccionar'}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="w-[var(--radix-popover-trigger-width)] p-0 bg-white rounded-lg border border-gray-200 shadow-2xl z-[9999] overflow-hidden">
                  <Command className="overflow-hidden bg-white">
                    <div className="flex items-center border-b border-gray-100 px-3">
                      <Search className="mr-2 h-4 w-4 text-gray-500" />
                      <Command.Input
                        placeholder="Buscar seguro..."
                        className="flex h-10 w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
                      />
                    </div>
                    <Command.List className="max-h-[240px] overflow-y-auto p-1">
                      <Command.Empty className="py-4 text-center text-sm text-gray-500">No encontrado</Command.Empty>
                      {insuranceOptions.map((insurance) => (
                        <Command.Item
                          key={insurance}
                          value={insurance}
                          onSelect={() => {
                            setFormState((prev) => ({ ...prev, insurance }));
                            setIsInsurancePickerOpen(false);
                          }}
                          className="relative flex cursor-pointer select-none items-center rounded-md px-2 py-2 text-sm outline-none text-gray-900 hover:bg-green-50"
                        >
                          <Check className={cn('mr-2 h-4 w-4', formState.insurance === insurance ? 'opacity-100' : 'opacity-0')} />
                          {insurance}
                        </Command.Item>
                      ))}
                    </Command.List>
                  </Command>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </div>

          <div className="md:col-span-12 h-px bg-gray-100" />

          <div className="md:col-span-3">
            <label className={labelStyles}>Auto</label>
            <Input
              value={formState.car}
              className={inputBaseStyles}
              onChange={(event) => setFormState((prev) => ({ ...prev, car: event.target.value }))}
            />
          </div>

          <div className="md:col-span-3">
            <label className={labelStyles}>Patente</label>
            <Input
              value={formState.licensePlate}
              className={cn(inputBaseStyles, 'font-mono uppercase tracking-wider')}
              onChange={(event) => setFormState((prev) => ({ ...prev, licensePlate: event.target.value.toUpperCase() }))}
            />
          </div>

          <div className="md:col-span-3">
            <label className={labelStyles}>Nombre cliente</label>
            <Input
              value={formState.client}
              className={inputBaseStyles}
              onChange={(event) => setFormState((prev) => ({ ...prev, client: event.target.value }))}
            />
          </div>

          <div className="md:col-span-3">
            <label className={labelStyles}>Celular</label>
            <Input
              value={formState.phone}
              className={inputBaseStyles}
              onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </div>

          <div className="md:col-span-12 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-center">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formState.requiresPhoto}
                  onChange={(event) => setFormState((prev) => ({ ...prev, requiresPhoto: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-[#114a28] focus:ring-[#114a28]"
                />
                Requiere foto
              </label>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-center">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formState.polarized}
                  onChange={(event) => setFormState((prev) => ({ ...prev, polarized: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-[#114a28] focus:ring-[#114a28]"
                />
                Polarizado
              </label>
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 flex items-center">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={formState.engraving}
                  onChange={(event) => setFormState((prev) => ({ ...prev, engraving: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-[#114a28] focus:ring-[#114a28]"
                />
                Grabado
              </label>
            </div>
          </div>

          <div className="md:col-span-12">
            <label className={labelStyles}>Observaciones</label>
            <textarea
              value={formState.description}
              onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
              className="min-h-[96px] w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
            />
          </div>

          <div className="md:col-span-12 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
            <label className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
              <input
                type="checkbox"
                checked={sendWhatsAppOnSave}
                onChange={(event) => setSendWhatsAppOnSave(event.target.checked)}
                className="h-4 w-4 rounded border-emerald-300 text-[#114a28] focus:ring-[#114a28]"
              />
              Enviar confirmacion por WhatsApp al guardar
            </label>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => setIsFormOpen(false)}>
            Cancelar
          </Button>
          <Button className="bg-[#114a28] hover:bg-[#0e3b20]" onClick={submitAppointment}>
            {editingAppointment ? 'Guardar cambios' : 'Agregar'}
          </Button>
        </div>
      </Dialog>

      <Dialog open={isFinishModalOpen} onOpenChange={setIsFinishModalOpen} title="Marcar trabajo terminado" className="max-w-xl">
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg leading-tight font-semibold text-slate-900">Confirmas que el trabajo ya fue realizado?</p>
                <p className="mt-1 text-sm text-slate-600">Se va a actualizar el estado del turno a <span className="font-semibold text-emerald-700">Terminado</span>.</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-emerald-100/80 bg-white/80 p-3 text-sm text-slate-700 sm:grid-cols-2">
              <p className="truncate">
                Auto: <span className="font-semibold text-slate-900">{selectedForFinish?.car || '-'}</span>
              </p>
              <p className="truncate">
                Patente: <span className="font-semibold text-slate-900">{selectedForFinish?.licensePlate || '-'}</span>
              </p>
              <p className="truncate sm:col-span-2">
                Cliente: <span className="font-semibold text-slate-900">{selectedForFinish?.client || '-'}</span>
              </p>
            </div>
          </div>

          <label
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 transition-colors',
              hasPhoneForFinish
                ? 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                : 'border-amber-200 bg-amber-50/70 opacity-80 cursor-not-allowed',
            )}
          >
            <input
              type="checkbox"
              checked={notifyOnFinish}
              onChange={(event) => setNotifyOnFinish(event.target.checked)}
              disabled={!hasPhoneForFinish}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#114a28] focus:ring-[#114a28]"
            />
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <MessageCircle className="h-4 w-4 text-emerald-700" />
                Avisar por WhatsApp
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {hasPhoneForFinish
                  ? 'Al confirmar, se abre WhatsApp Web con el mensaje listo para enviar.'
                  : 'Este turno no tiene celular cargado. Se va a marcar terminado sin WhatsApp.'}
              </p>
            </div>
          </label>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" className="border-slate-300" onClick={() => setIsFinishModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-[#114a28] hover:bg-[#0e3b20]" onClick={finishAppointment}>
              Marcar terminado
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={isDeleteModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedForDelete(null);
          }
          setIsDeleteModalOpen(open);
        }}
        title="Eliminar Turno"
        className="max-w-md"
      >
        <p className="text-base text-slate-700 mb-2">Se va a marcar este turno como eliminado.</p>
        <p className="text-sm text-slate-500 mb-5">Auto: <span className="font-semibold text-slate-700">{selectedForDelete?.car || '-'}</span> - Patente: <span className="font-semibold text-slate-700">{selectedForDelete?.licensePlate || '-'}</span></p>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>
            Cancelar
          </Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={confirmDeleteAppointment}>
            Confirmar eliminar
          </Button>
        </div>
      </Dialog>
    </div>
  );
};

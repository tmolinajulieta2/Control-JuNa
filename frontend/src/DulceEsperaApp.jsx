import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Stethoscope,
  BookOpen,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Baby,
  Heart,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  Edit3,
  X,
  Activity,
  Sparkles,
  CalendarPlus,
  Share2,
  MessageSquare,
  Send,
  Users,
  Check,
  Copy,
  Smartphone,
  ShieldCheck,
  LayoutDashboard,
  Cloud,
  CloudOff,
  RefreshCw,
  Link2
} from 'lucide-react';
import { fetchFamilySpace, syncFamilySpace } from './api/pregnancyApi';

// --- Utilidades de Fecha ---
const toLocalISODate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (dateStr, days) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toLocalISODate(date);
};

const formatReadableDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// --- Generador de Calendario para iPhone / Apple Calendar (.ics) ---
const downloadAppleCalendarICS = ({
  title,
  date,
  time = '09:00',
  durationMinutes = 60,
  location = '',
  description = ''
}) => {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = (time || '09:00').split(':').map(Number);

  const startDate = new Date(year, month - 1, day, hour, minute, 0);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60000);

  const formatICSDate = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  };

  const escapeICS = (str) =>
    (str || '')
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');

  const uid = `control-embarazo-${Date.now()}@control.app`;
  const nowStamp = formatICSDate(new Date());

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Control//Seguimiento Embarazo//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    `SUMMARY:${escapeICS(title)}`,
    location ? `LOCATION:${escapeICS(location)}` : '',
    description ? `DESCRIPTION:${escapeICS(description)}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:Recordatorio mañana: ${escapeICS(title)}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:En 2 horas: ${escapeICS(title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ]
    .filter(Boolean)
    .join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// --- Categorías de Estudios ---
const STUDY_CATEGORIES = [
  { id: 'ecografia', label: 'Ecografía', badge: 'bg-[#E6D5B8]/15 text-[#E6D5B8] border-[#E6D5B8]/30' },
  { id: 'laboratorio', label: 'Laboratorio', badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  { id: 'monitoreo', label: 'Monitoreo Fetal', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { id: 'cardiologico', label: 'Cardiológico / ECG', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  { id: 'vacuna', label: 'Vacunas', badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  { id: 'cultivo', label: 'Cultivos / Hisopados', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { id: 'otro', label: 'Otro Estudio', badge: 'bg-stone-500/20 text-stone-300 border-stone-500/30' }
];

const getCategoryMeta = (id) =>
  STUDY_CATEGORIES.find((c) => c.id === id) || STUDY_CATEGORIES[STUDY_CATEGORIES.length - 1];

// --- Datos Iniciales ---
const getInitialData = (initialCode) => {
  const today = new Date();
  const todayStr = toLocalISODate(today);
  const defaultFum = addDays(todayStr, -140);

  return {
    familyCode: initialCode || 'BEBE-' + Math.floor(1000 + Math.random() * 9000),
    pregnancy: {
      fum: defaultFum,
      babyName: 'Bebé'
    },
    appointments: [],
    studies: [],
    notes: [],
    reminders: []
  };
};

const STORAGE_KEY = 'control_embarazo_v1';

export default function App() {
  const [data, setData] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const urlCode = (params.get('codigo') || params.get('code') || '').toUpperCase().trim();

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (urlCode && urlCode !== parsed.familyCode) {
          return { ...parsed, familyCode: urlCode };
        }
        return parsed;
      }
    } catch (e) {
      console.error('Error al cargar datos:', e);
    }
    return getInitialData(urlCode);
  });

  // Estado de sincronización con NestJS
  const [syncStatus, setSyncStatus] = useState('local');
  const [hasLoadedRemote, setHasLoadedRemote] = useState(false);

  // Navegación: Calendario primero, Resumen al final
  const [activeTab, setActiveTab] = useState('calendar');
  const [activeParent, setActiveParent] = useState('Mamá');

  // Modales globales
  const [showSettings, setShowSettings] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Estados del Calendario
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => toLocalISODate(new Date()));
  const [newReminderTitle, setNewReminderTitle] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('09:00');
  const [newReminderDesc, setNewReminderDesc] = useState('');

  // Estados de Turnos
  const [showAppModal, setShowAppModal] = useState(false);
  const [appForm, setAppForm] = useState({
    title: '',
    doctor: '',
    location: '',
    date: toLocalISODate(new Date()),
    time: '10:00',
    description: ''
  });

  // Estados de Estudios
  const [studyFilter, setStudyFilter] = useState('todos');
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [studyForm, setStudyForm] = useState({
    category: 'ecografia',
    customType: '',
    title: '',
    date: toLocalISODate(new Date()),
    time: '09:30',
    week: '',
    clinic: '',
    status: 'pendiente',
    description: ''
  });
  const [commentDrafts, setCommentDrafts] = useState({});

  // Estados de Bitácora / Comentarios (sin emoción predefinida, solo descripción obligatoria)
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteSearch, setNoteSearch] = useState('');
  const [noteForm, setNoteForm] = useState({
    title: '',
    date: toLocalISODate(new Date()),
    mood: '',
    symptoms: [],
    description: ''
  });

  // Cargar datos remotos desde NestJS al cambiar familyCode
  useEffect(() => {
    let cancelled = false;
    setHasLoadedRemote(false);

    const loadRemote = async () => {
      if (!data.familyCode?.trim()) return;
      try {
        setSyncStatus('syncing');
        const remote = await fetchFamilySpace(data.familyCode);
        if (cancelled || !remote) return;

        setData((prev) => ({
          ...prev,
          familyCode: remote.familyCode || prev.familyCode,
          pregnancy: remote.pregnancy || prev.pregnancy,
          appointments: Array.isArray(remote.appointments)
            ? remote.appointments
            : prev.appointments,
          studies: Array.isArray(remote.studies) ? remote.studies : prev.studies,
          notes: Array.isArray(remote.notes) ? remote.notes : prev.notes,
          reminders: Array.isArray(remote.reminders)
            ? remote.reminders
            : prev.reminders
        }));
        setSyncStatus('synced');
      } catch {
        if (!cancelled) setSyncStatus('offline');
      } finally {
        if (!cancelled) setHasLoadedRemote(true);
      }
    };

    loadRemote();
    return () => {
      cancelled = true;
    };
  }, [data.familyCode]);

  // Guardar en localStorage y sincronizar con NestJS con debounce
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Error al guardar en localStorage:', e);
    }

    if (!hasLoadedRemote || !data.familyCode?.trim()) return;

    const timer = setTimeout(async () => {
      try {
        setSyncStatus('syncing');
        await syncFamilySpace(data.familyCode, {
          familyCode: data.familyCode,
          pregnancy: data.pregnancy,
          appointments: data.appointments,
          studies: data.studies,
          notes: data.notes,
          reminders: data.reminders
        });
        setSyncStatus('synced');
      } catch {
        setSyncStatus('offline');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [data, hasLoadedRemote]);

  // --- Cálculos de Embarazo ---
  const pregnancyStats = useMemo(() => {
    const fumStr = data.pregnancy.fum;
    const [y, m, d] = fumStr.split('-').map(Number);
    const fumDate = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - fumDate.getTime();
    const totalDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
    const weeks = Math.floor(totalDays / 7);
    const days = totalDays % 7;

    const fppStr = addDays(fumStr, 280);
    const [fy, fm, fd] = fppStr.split('-').map(Number);
    const fppDate = new Date(fy, fm - 1, fd);
    const daysRemaining = Math.max(
      0,
      Math.ceil((fppDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    );

    const progress = Math.min(100, Math.max(0, Math.round((totalDays / 280) * 100)));
    let trimester = 1;
    if (weeks >= 28) trimester = 3;
    else if (weeks >= 14) trimester = 2;

    return {
      weeks,
      days,
      totalDays,
      fppStr,
      daysRemaining,
      progress,
      trimester
    };
  }, [data.pregnancy.fum]);

  const handleFumChange = (newFum) => {
    if (!newFum) return;
    setData((prev) => ({
      ...prev,
      pregnancy: { ...prev.pregnancy, fum: newFum }
    }));
  };

  const handleFppChange = (newFpp) => {
    if (!newFpp) return;
    const calculatedFum = addDays(newFpp, -280);
    setData((prev) => ({
      ...prev,
      pregnancy: { ...prev.pregnancy, fum: calculatedFum }
    }));
  };

  // --- Eventos del Calendario ---
  const eventsByDate = useMemo(() => {
    const map = {};
    const ensureDay = (d) => {
      if (!map[d]) map[d] = [];
    };

    data.appointments.forEach((a) => {
      ensureDay(a.date);
      map[a.date].push({
        type: 'turno',
        id: a.id,
        title: a.title,
        time: a.time,
        location: a.location,
        description: a.description,
        completed: a.completed
      });
    });

    data.studies.forEach((s) => {
      ensureDay(s.date);
      const cat = getCategoryMeta(s.category);
      map[s.date].push({
        type: 'estudio',
        categoryLabel: s.category === 'otro' && s.customType ? s.customType : cat.label,
        id: s.id,
        title: s.title,
        time: s.time || '09:00',
        location: s.clinic,
        description: s.description,
        status: s.status
      });
    });

    data.notes.forEach((n) => {
      ensureDay(n.date);
      map[n.date].push({
        type: 'comentario',
        id: n.id,
        title: n.title || 'Comentario',
        description: n.description
      });
    });

    data.reminders.forEach((r) => {
      ensureDay(r.date);
      map[r.date].push({
        type: 'recordatorio',
        id: r.id,
        title: r.title,
        time: r.time || '09:00',
        description: r.description
      });
    });

    return map;
  }, [data]);

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(toLocalISODate(new Date(year, month, d)));
    }
    return cells;
  }, [currentMonth]);

  // --- Handlers ---
  const addAppointment = (e) => {
    e.preventDefault();
    if (!appForm.title.trim()) return;
    const newItem = {
      id: 'app-' + Date.now(),
      ...appForm,
      completed: false,
      createdBy: activeParent
    };
    setData((prev) => ({
      ...prev,
      appointments: [...prev.appointments, newItem].sort((a, b) => a.date.localeCompare(b.date))
    }));
    setAppForm({
      title: '',
      doctor: '',
      location: '',
      date: toLocalISODate(new Date()),
      time: '10:00',
      description: ''
    });
    setShowAppModal(false);
  };

  const toggleAppointment = (id) => {
    setData((prev) => ({
      ...prev,
      appointments: prev.appointments.map((a) =>
        a.id === id ? { ...a, completed: !a.completed } : a
      )
    }));
  };

  const deleteAppointment = (id) => {
    setData((prev) => ({
      ...prev,
      appointments: prev.appointments.filter((a) => a.id !== id)
    }));
  };

  const addStudy = (e) => {
    e.preventDefault();
    if (!studyForm.title.trim()) return;
    const newItem = {
      id: 'stu-' + Date.now(),
      ...studyForm,
      week: studyForm.week || String(pregnancyStats.weeks),
      comments: []
    };
    setData((prev) => ({
      ...prev,
      studies: [newItem, ...prev.studies]
    }));
    setStudyForm({
      category: 'ecografia',
      customType: '',
      title: '',
      date: toLocalISODate(new Date()),
      time: '09:30',
      week: '',
      clinic: '',
      status: 'pendiente',
      description: ''
    });
    setShowStudyModal(false);
  };

  const toggleStudyStatus = (id) => {
    setData((prev) => ({
      ...prev,
      studies: prev.studies.map((s) =>
        s.id === id ? { ...s, status: s.status === 'realizado' ? 'pendiente' : 'realizado' } : s
      )
    }));
  };

  const addStudyComment = (studyId, e) => {
    e.preventDefault();
    const text = (commentDrafts[studyId] || '').trim();
    if (!text) return;

    const newComment = {
      id: 'com-' + Date.now(),
      author: activeParent,
      text,
      date: toLocalISODate(new Date())
    };

    setData((prev) => ({
      ...prev,
      studies: prev.studies.map((s) =>
        s.id === studyId ? { ...s, comments: [...(s.comments || []), newComment] } : s
      )
    }));

    setCommentDrafts((prev) => ({ ...prev, [studyId]: '' }));
  };

  const deleteStudyComment = (studyId, commentId) => {
    setData((prev) => ({
      ...prev,
      studies: prev.studies.map((s) =>
        s.id === studyId
          ? { ...s, comments: (s.comments || []).filter((c) => c.id !== commentId) }
          : s
      )
    }));
  };

  const deleteStudy = (id) => {
    setData((prev) => ({
      ...prev,
      studies: prev.studies.filter((s) => s.id !== id)
    }));
  };

  // Guardar entrada en Bitácora / Comentarios (solo descripción obligatoria)
  const addNote = (e) => {
    e.preventDefault();
    if (!noteForm.description.trim()) return;
    const newItem = {
      id: 'note-' + Date.now(),
      title: noteForm.title.trim(),
      date: noteForm.date,
      mood: noteForm.mood || '',
      symptoms: noteForm.symptoms,
      description: noteForm.description.trim(),
      author: activeParent
    };
    setData((prev) => ({
      ...prev,
      notes: [newItem, ...prev.notes]
    }));
    setNoteForm({
      title: '',
      date: toLocalISODate(new Date()),
      mood: '',
      symptoms: [],
      description: ''
    });
    setShowNoteModal(false);
  };

  const toggleSymptom = (sym) => {
    setNoteForm((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(sym)
        ? prev.symptoms.filter((s) => s !== sym)
        : [...prev.symptoms, sym]
    }));
  };

  const deleteNote = (id) => {
    setData((prev) => ({
      ...prev,
      notes: prev.notes.filter((n) => n.id !== id)
    }));
  };

  const addReminder = (e) => {
    e.preventDefault();
    if (!newReminderTitle.trim()) return;
    setData((prev) => ({
      ...prev,
      reminders: [
        ...prev.reminders,
        {
          id: 'rem-' + Date.now(),
          date: selectedDate,
          time: newReminderTime || '09:00',
          title: newReminderTitle.trim(),
          description: newReminderDesc.trim()
        }
      ]
    }));
    setNewReminderTitle('');
    setNewReminderDesc('');
  };

  const deleteReminder = (id) => {
    setData((prev) => ({
      ...prev,
      reminders: prev.reminders.filter((r) => r.id !== id)
    }));
  };

  // --- Compartir Código, Link o Entradas ---
  const shareableUrl = useMemo(() => {
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?codigo=${encodeURIComponent(data.familyCode)}`;
  }, [data.familyCode]);

  const copyFamilyCode = () => {
    navigator.clipboard?.writeText(data.familyCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyShareLink = () => {
    navigator.clipboard?.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const shareViaWhatsApp = () => {
    const text = `Control de embarazo (${pregnancyStats.weeks} semanas).\nCódigo familiar: ${data.familyCode}\nEnlace directo: ${shareableUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareSingleNote = (note) => {
    const lines = [
      `Control (${formatReadableDate(note.date)}) - ${note.author || activeParent}`,
      note.title ? `*${note.title}*` : '',
      note.description,
      note.mood ? `Emoción: ${note.mood}` : '',
      note.symptoms.length > 0 ? `Síntomas: ${note.symptoms.join(', ')}` : ''
    ].filter(Boolean);

    const text = lines.join('\n');
    if (navigator.share) {
      navigator.share({ title: note.title || 'Control', text }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  // --- Listas Filtradas ---
  const todayStr = toLocalISODate(new Date());
  const upcomingAppointments = data.appointments
    .filter((a) => !a.completed && a.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const filteredStudies = data.studies.filter((s) => {
    if (studyFilter === 'todos') return true;
    return s.category === studyFilter;
  });

  const filteredNotes = data.notes.filter(
    (n) =>
      (n.title || '').toLowerCase().includes(noteSearch.toLowerCase()) ||
      (n.description || '').toLowerCase().includes(noteSearch.toLowerCase()) ||
      (n.mood || '').toLowerCase().includes(noteSearch.toLowerCase()) ||
      n.symptoms.some((s) => s.toLowerCase().includes(noteSearch.toLowerCase()))
  );

  const selectedDayEvents = eventsByDate[selectedDate] || [];

  const symptomOptions = [
    'Movimientos fetales',
    'Cansancio',
    'Náuseas',
    'Acidez',
    'Buena energía',
    'Dolor lumbar',
    'Antojos',
    'Insomnio'
  ];

  const navTabs = [
    { id: 'calendar', label: 'Calendario', icon: CalendarIcon },
    { id: 'appointments', label: 'Turnos', icon: Stethoscope },
    { id: 'studies', label: 'Estudios', icon: Activity },
    { id: 'notes', label: 'Bitácora / Comentarios', icon: BookOpen },
    { id: 'dashboard', label: 'Resumen', icon: LayoutDashboard }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5EFE6] font-sans pb-24 md:pb-12 selection:bg-[#E6D5B8] selection:text-[#0A0A0A]">
      {/* Header Superior Oscuro con Acentos Beige */}
      <header className="bg-[#121110]/95 backdrop-blur-md border-b border-[#292520] sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#E6D5B8] flex items-center justify-center text-[#121110] shadow-md shadow-black/40">
              <Baby className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold tracking-tight text-[#F5EFE6]">Control</h1>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E6D5B8]/15 text-[#E6D5B8] border border-[#E6D5B8]/30">
                  Sem. {pregnancyStats.weeks}+{pregnancyStats.days}
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                      : syncStatus === 'syncing'
                      ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                      : 'bg-stone-500/15 text-[#A89E90] border-[#332E28]'
                  }`}
                  title="Estado de conexión con el servidor NestJS"
                >
                  {syncStatus === 'synced' && <Cloud className="w-3 h-3" />}
                  {syncStatus === 'syncing' && <RefreshCw className="w-3 h-3 animate-spin" />}
                  {(syncStatus === 'offline' || syncStatus === 'local') && (
                    <CloudOff className="w-3 h-3" />
                  )}
                  {syncStatus === 'synced'
                    ? 'Sincronizado'
                    : syncStatus === 'syncing'
                    ? 'Sincronizando...'
                    : 'Local'}
                </span>
              </div>
              <p className="text-xs text-[#9C9183] flex items-center gap-1">
                <span>{data.pregnancy.babyName}</span>
                <span>•</span>
                <span className="text-[#C8B08E] font-medium">
                  Trimestre {pregnancyStats.trimester}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Selector de Quién Usa la App (Mamá / Papá) */}
            <div className="flex items-center bg-[#1C1A17] p-1 rounded-xl border border-[#2E2924] text-xs font-medium">
              <button
                onClick={() => setActiveParent('Mamá')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  activeParent === 'Mamá'
                    ? 'bg-[#E6D5B8] text-[#121110] font-semibold shadow-sm'
                    : 'text-[#9C9183] hover:text-[#F5EFE6]'
                }`}
              >
                Mamá
              </button>
              <button
                onClick={() => setActiveParent('Papá')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  activeParent === 'Papá'
                    ? 'bg-[#E6D5B8] text-[#121110] font-semibold shadow-sm'
                    : 'text-[#9C9183] hover:text-[#F5EFE6]'
                }`}
              >
                Papá
              </button>
            </div>

            {/* Botón Compartir con Papá */}
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#E6D5B8]/12 hover:bg-[#E6D5B8]/20 text-[#E6D5B8] border border-[#E6D5B8]/25 text-xs font-semibold transition-colors"
              title="Compartir acceso con Papá"
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Compartir</span>
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1C1A17] hover:bg-[#26231F] text-[#D8CBB8] border border-[#2E2924] text-xs font-medium transition-colors"
              title="Configurar FUM / FPP"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#E6D5B8]" />
              <span className="hidden sm:inline">FUM / FPP</span>
            </button>
          </div>
        </div>

        {/* Navegación Desktop */}
        <nav className="hidden md:block max-w-5xl mx-auto px-4 border-t border-[#221F1B]">
          <div className="flex gap-2 py-2">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#E6D5B8] text-[#121110] font-semibold shadow-sm'
                      : 'text-[#9C9183] hover:bg-[#1C1A17] hover:text-[#F5EFE6]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-5xl mx-auto px-4 pt-6">
        {/* ================= 1. CALENDARIO (PORTADA PRINCIPAL) ================= */}
        {activeTab === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Grilla del Mes */}
            <div className="lg:col-span-2 bg-[#141312] rounded-3xl p-5 md:p-6 border border-[#292520] shadow-xl shadow-black/40">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold capitalize text-[#F5EFE6]">
                    {currentMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
                  </h2>
                  <p className="text-xs text-[#9C9183]">
                    Tocá un día para ver eventos o exportar recordatorios al iPhone
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      setCurrentMonth(
                        new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
                      )
                    }
                    className="p-2 rounded-xl hover:bg-[#221F1B] text-[#C8B08E] border border-[#292520]"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      const now = new Date();
                      setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                      setSelectedDate(toLocalISODate(now));
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-[#E6D5B8]/15 text-[#E6D5B8] hover:bg-[#E6D5B8]/25 border border-[#E6D5B8]/30"
                  >
                    Hoy
                  </button>
                  <button
                    onClick={() =>
                      setCurrentMonth(
                        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
                      )
                    }
                    className="p-2 rounded-xl hover:bg-[#221F1B] text-[#C8B08E] border border-[#292520]"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                  <div key={d} className="text-xs font-semibold text-[#8A7F72] py-1">
                    {d}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((dateStr, idx) => {
                  if (!dateStr) return <div key={`empty-${idx}`} className="h-14 md:h-16" />;
                  const dayNum = Number(dateStr.split('-')[2]);
                  const isSelected = dateStr === selectedDate;
                  const isToday = dateStr === todayStr;
                  const isFpp = dateStr === pregnancyStats.fppStr;
                  const dayEvents = eventsByDate[dateStr] || [];

                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`h-14 md:h-16 rounded-2xl p-1.5 flex flex-col items-center justify-between border transition-all ${
                        isSelected
                          ? 'bg-[#E6D5B8] text-[#121110] border-[#E6D5B8] shadow-md shadow-black/40 font-bold'
                          : isToday
                          ? 'bg-[#24201B] text-[#E6D5B8] border-[#E6D5B8]/50 font-semibold'
                          : 'bg-[#191816] hover:bg-[#22201D] border-[#26231F] text-[#E5DDD0]'
                      }`}
                    >
                      <span className="text-xs">{dayNum}</span>
                      <div className="flex items-center gap-1 flex-wrap justify-center">
                        {isFpp && (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? 'bg-[#121110]' : 'bg-[#E6D5B8]'
                            }`}
                            title="Fecha Probable de Parto"
                          />
                        )}
                        {dayEvents.some((e) => e.type === 'turno') && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-[#121110]' : 'bg-[#D4B483]'
                            }`}
                          />
                        )}
                        {dayEvents.some((e) => e.type === 'estudio') && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-[#121110]' : 'bg-sky-400'
                            }`}
                          />
                        )}
                        {dayEvents.some((e) => e.type === 'comentario') && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-[#121110]' : 'bg-emerald-400'
                            }`}
                          />
                        )}
                        {dayEvents.some((e) => e.type === 'recordatorio') && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-[#121110]' : 'bg-amber-400'
                            }`}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-4 mt-5 pt-4 border-t border-[#26231F] text-xs text-[#9C9183]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#D4B483]" /> Turnos
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400" /> Estudios
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> Comentarios
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Recordatorios
                </span>
              </div>
            </div>

            {/* Panel Lateral del Día Seleccionado */}
            <div className="bg-[#141312] rounded-3xl p-5 border border-[#292520] shadow-xl shadow-black/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#26231F]">
                  <div>
                    <p className="text-xs font-medium text-[#C8B08E] uppercase">Agenda del día</p>
                    <h3 className="text-base font-bold text-[#F5EFE6] capitalize">
                      {formatReadableDate(selectedDate)}
                    </h3>
                  </div>
                  <CalendarIcon className="w-5 h-5 text-[#E6D5B8]" />
                </div>

                {selectedDate === pregnancyStats.fppStr && (
                  <div className="mt-3 p-3 rounded-2xl bg-[#E6D5B8]/15 border border-[#E6D5B8]/30 text-[#E6D5B8] text-xs font-semibold flex items-center gap-2">
                    <Baby className="w-4 h-4 shrink-0" />
                    ¡Fecha Probable de Parto (Semana 40)!
                  </div>
                )}

                <div className="mt-4 space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {selectedDayEvents.length === 0 ? (
                    <p className="text-xs text-[#7A7064] py-8 text-center">
                      No hay actividades ni recordatorios para este día.
                    </p>
                  ) : (
                    selectedDayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-2xl bg-[#1B1917] border border-[#2B2723] text-xs space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#C8B08E]">
                              {ev.categoryLabel || ev.type} {ev.time ? `• ${ev.time} hs` : ''}
                            </span>
                            <p className="font-semibold text-[#F5EFE6] mt-0.5">{ev.title}</p>
                          </div>
                          {ev.type === 'recordatorio' && (
                            <button
                              onClick={() => deleteReminder(ev.id)}
                              className="text-[#7A7064] hover:text-rose-400"
                              title="Eliminar recordatorio"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        {ev.description && (
                          <p className="text-[#A89E90] leading-relaxed">{ev.description}</p>
                        )}
                        {(ev.type === 'turno' ||
                          ev.type === 'estudio' ||
                          ev.type === 'recordatorio') && (
                          <button
                            onClick={() =>
                              downloadAppleCalendarICS({
                                title: ev.title,
                                date: selectedDate,
                                time: ev.time || '09:00',
                                location: ev.location || '',
                                description: ev.description || ''
                              })
                            }
                            className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-lg bg-[#25221E] border border-[#36312B] text-[#E6D5B8] hover:bg-[#2F2B26] font-medium text-[11px] transition-colors"
                          >
                            <Smartphone className="w-3 h-3 text-[#E6D5B8]" />
                            Guardar en iPhone (.ics)
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Formulario de Recordatorio */}
              <form onSubmit={addReminder} className="mt-4 pt-4 border-t border-[#26231F] space-y-2">
                <label className="text-xs font-semibold text-[#D8CBB8] flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-[#E6D5B8]" /> Nuevo recordatorio
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Título del recordatorio..."
                    value={newReminderTitle}
                    onChange={(e) => setNewReminderTitle(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-[#1B1917] border border-[#2E2924] text-[#F5EFE6] placeholder-[#6E655A] focus:outline-none focus:border-[#E6D5B8]"
                  />
                  <input
                    type="time"
                    value={newReminderTime}
                    onChange={(e) => setNewReminderTime(e.target.value)}
                    className="w-24 text-xs px-2 py-2 rounded-xl bg-[#1B1917] border border-[#2E2924] text-[#F5EFE6] focus:outline-none focus:border-[#E6D5B8]"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Descripción o indicaciones (opcional)..."
                    value={newReminderDesc}
                    onChange={(e) => setNewReminderDesc(e.target.value)}
                    className="flex-1 text-xs px-3 py-2 rounded-xl bg-[#1B1917] border border-[#2E2924] text-[#F5EFE6] placeholder-[#6E655A] focus:outline-none focus:border-[#E6D5B8]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-[#E6D5B8] hover:bg-[#D5C09D] text-[#121110] text-xs font-bold transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= 2. TURNOS MÉDICOS ================= */}
        {activeTab === 'appointments' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#F5EFE6]">Turnos Médicos</h2>
                <p className="text-xs text-[#9C9183]">
                  Agendá tus controles y exportalos directo al calendario del iPhone con alertas
                </p>
              </div>
              <button
                onClick={() => setShowAppModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#E6D5B8] hover:bg-[#D5C09D] text-[#121110] text-sm font-bold shadow-md shadow-black/30 transition-colors"
              >
                <Plus className="w-4 h-4" /> Nuevo Turno
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.appointments.map((app) => (
                <div
                  key={app.id}
                  className={`bg-[#141312] rounded-3xl p-5 border transition-all flex flex-col justify-between ${
                    app.completed
                      ? 'border-[#24211D] opacity-65'
                      : 'border-[#292520] shadow-lg shadow-black/30'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleAppointment(app.id)}
                          className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center border transition-colors shrink-0 ${
                            app.completed
                              ? 'bg-emerald-500 border-emerald-500 text-[#121110]'
                              : 'border-[#574F45] hover:border-[#E6D5B8]'
                          }`}
                        >
                          {app.completed && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              className={`font-bold text-base ${
                                app.completed ? 'line-through text-[#7A7064]' : 'text-[#F5EFE6]'
                              }`}
                            >
                              {app.title}
                            </h3>
                            {app.createdBy && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#221F1B] text-[#C8B08E] border border-[#332E28] font-medium">
                                Por {app.createdBy}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-[#C8B08E] font-medium mt-0.5">
                            {app.doctor || 'Profesional a confirmar'}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[#9C9183]">
                            <span className="flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5 text-[#E6D5B8]" />{' '}
                              {formatReadableDate(app.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-[#E6D5B8]" /> {app.time} hs
                            </span>
                          </div>
                          {app.location && (
                            <p className="text-xs text-[#7A7064] mt-1">📍 {app.location}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteAppointment(app.id)}
                        className="text-[#6E655A] hover:text-rose-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {app.description && (
                      <div className="mt-3 p-3 rounded-2xl bg-[#1B1917] border border-[#292520] text-xs text-[#C4B9AA] leading-relaxed">
                        <span className="font-semibold text-[#E6D5B8] block mb-0.5">
                          Descripción:
                        </span>
                        {app.description}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#24211D] flex items-center justify-between">
                    <span className="text-[11px] text-[#7A7064]">
                      {app.completed ? 'Turno completado' : 'Incluye alerta 1 día y 2 hs antes'}
                    </span>
                    <button
                      onClick={() =>
                        downloadAppleCalendarICS({
                          title: `${app.title}${app.doctor ? ` - ${app.doctor}` : ''}`,
                          date: app.date,
                          time: app.time,
                          location: app.location,
                          description: app.description
                        })
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E6D5B8]/12 hover:bg-[#E6D5B8]/20 text-[#E6D5B8] border border-[#E6D5B8]/25 text-xs font-semibold transition-colors"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      Calendario iPhone (.ics)
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= 3. ESTUDIOS Y COMENTARIOS ================= */}
        {activeTab === 'studies' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#F5EFE6]">Estudios Médicos</h2>
                <p className="text-xs text-[#9C9183]">
                  Ecografías, laboratorios, monitoreos, vacunas y comentarios compartidos entre Mamá y Papá
                </p>
              </div>
              <button
                onClick={() => setShowStudyModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#E6D5B8] hover:bg-[#D5C09D] text-[#121110] text-sm font-bold shadow-md shadow-black/30 transition-colors"
              >
                <Plus className="w-4 h-4" /> Agregar Estudio
              </button>
            </div>

            {/* Filtros por categoría */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => setStudyFilter('todos')}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  studyFilter === 'todos'
                    ? 'bg-[#E6D5B8] text-[#121110]'
                    : 'bg-[#141312] text-[#9C9183] border border-[#292520] hover:text-[#F5EFE6]'
                }`}
              >
                Todos ({data.studies.length})
              </button>
              {STUDY_CATEGORIES.map((cat) => {
                const count = data.studies.filter((s) => s.category === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setStudyFilter(cat.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      studyFilter === cat.id
                        ? 'bg-[#E6D5B8] text-[#121110]'
                        : 'bg-[#141312] text-[#9C9183] border border-[#292520] hover:text-[#F5EFE6]'
                    }`}
                  >
                    {cat.label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Lista de Estudios con Descripciones e Hilos de Comentarios */}
            <div className="grid grid-cols-1 gap-5">
              {filteredStudies.map((study) => {
                const catMeta = getCategoryMeta(study.category);
                const categoryDisplay =
                  study.category === 'otro' && study.customType ? study.customType : catMeta.label;
                const comments = study.comments || [];

                return (
                  <div
                    key={study.id}
                    className="bg-[#141312] rounded-3xl p-5 md:p-6 border border-[#292520] shadow-lg shadow-black/30 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${catMeta.badge}`}
                          >
                            {categoryDisplay}
                          </span>
                          <span className="text-xs font-semibold text-[#C8B08E]">
                            Semana {study.week}
                          </span>
                          <button
                            onClick={() => toggleStudyStatus(study.id)}
                            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition-colors ${
                              study.status === 'realizado'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {study.status === 'realizado' ? '✓ Realizado' : '⏳ Pendiente (marcar)'}
                          </button>
                        </div>
                        <h3 className="font-bold text-[#F5EFE6] text-lg pt-1">{study.title}</h3>
                        <p className="text-xs text-[#9C9183]">
                          {formatReadableDate(study.date)} {study.time ? `• ${study.time} hs` : ''}{' '}
                          {study.clinic ? `• ${study.clinic}` : ''}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {study.status === 'pendiente' && (
                          <button
                            onClick={() =>
                              downloadAppleCalendarICS({
                                title: `Estudio: ${study.title}`,
                                date: study.date,
                                time: study.time || '09:00',
                                location: study.clinic,
                                description: study.description
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E6D5B8]/12 hover:bg-[#E6D5B8]/20 text-[#E6D5B8] border border-[#E6D5B8]/25 text-xs font-semibold"
                            title="Agendar estudio en iPhone"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">iPhone (.ics)</span>
                          </button>
                        )}
                        <button
                          onClick={() => deleteStudy(study.id)}
                          className="text-[#6E655A] hover:text-rose-400 p-1.5"
                          title="Eliminar estudio"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {study.description && (
                      <div className="p-3.5 rounded-2xl bg-[#1B1917] border border-[#292520] text-xs text-[#D8CBB8] leading-relaxed">
                        <span className="font-bold text-[#E6D5B8] block mb-1">
                          Descripción / Informe del Estudio:
                        </span>
                        {study.description}
                      </div>
                    )}

                    {/* Sección de Comentarios Compartidos (Mamá & Papá) */}
                    <div className="pt-3 border-t border-[#24211D] space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[#C8B08E]">
                        <MessageSquare className="w-3.5 h-3.5 text-[#E6D5B8]" />
                        Comentarios sobre este estudio ({comments.length})
                      </div>

                      {comments.length > 0 && (
                        <div className="space-y-2">
                          {comments.map((c) => (
                            <div
                              key={c.id}
                              className="p-3 rounded-2xl bg-[#181614] border border-[#292520] flex items-start justify-between gap-2 text-xs"
                            >
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span
                                    className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                                      c.author === 'Papá'
                                        ? 'bg-sky-500/15 text-sky-300 border border-sky-500/25'
                                        : 'bg-[#E6D5B8]/15 text-[#E6D5B8] border border-[#E6D5B8]/25'
                                    }`}
                                  >
                                    {c.author}
                                  </span>
                                  <span className="text-[11px] text-[#7A7064]">
                                    {formatReadableDate(c.date)}
                                  </span>
                                </div>
                                <p className="text-[#E5DDD0] leading-relaxed">{c.text}</p>
                              </div>
                              <button
                                onClick={() => deleteStudyComment(study.id, c.id)}
                                className="text-[#6E655A] hover:text-rose-400 p-1"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <form
                        onSubmit={(e) => addStudyComment(study.id, e)}
                        className="flex items-center gap-2"
                      >
                        <span className="text-[11px] font-semibold px-2.5 py-2 rounded-xl bg-[#1F1D1A] border border-[#2E2924] text-[#C8B08E] shrink-0">
                          {activeParent}:
                        </span>
                        <input
                          type="text"
                          placeholder={`Escribí un comentario sobre este estudio como ${activeParent}...`}
                          value={commentDrafts[study.id] || ''}
                          onChange={(e) =>
                            setCommentDrafts((prev) => ({ ...prev, [study.id]: e.target.value }))
                          }
                          className="flex-1 text-xs px-3.5 py-2 rounded-xl bg-[#1B1917] border border-[#2E2924] text-[#F5EFE6] placeholder-[#6E655A] focus:outline-none focus:border-[#E6D5B8]"
                        />
                        <button
                          type="submit"
                          className="p-2 rounded-xl bg-[#E6D5B8] hover:bg-[#D5C09D] text-[#121110] transition-colors"
                          title="Enviar comentario"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 4. BITÁCORA / COMENTARIOS ================= */}
        {activeTab === 'notes' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-[#F5EFE6]">Bitácora / Comentarios</h2>
                <p className="text-xs text-[#9C9183]">
                  Descripciones, comentarios, síntomas y momentos compartidos entre Mamá y Papá
                </p>
              </div>
              <button
                onClick={() => setShowNoteModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#E6D5B8] hover:bg-[#D5C09D] text-[#121110] text-sm font-bold shadow-md shadow-black/30 transition-colors"
              >
                <Plus className="w-4 h-4" /> Nueva Entrada
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#7A7064] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por descripción, título o síntoma..."
                value={noteSearch}
                onChange={(e) => setNoteSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#141312] border border-[#292520] text-sm text-[#F5EFE6] placeholder-[#6E655A] focus:outline-none focus:border-[#E6D5B8]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className="bg-[#141312] rounded-3xl p-5 border border-[#292520] shadow-lg shadow-black/30 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-[#C8B08E]">
                            {formatReadableDate(note.date)}
                            {note.mood ? ` • ${note.mood}` : ''}
                          </span>
                          {note.author && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#221F1B] text-[#E6D5B8] border border-[#332E28] font-medium">
                              {note.author}
                            </span>
                          )}
                        </div>
                        {note.title && (
                          <h3 className="font-bold text-[#F5EFE6] text-base mt-1">{note.title}</h3>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => shareSingleNote(note)}
                          className="text-[#8A7F72] hover:text-[#E6D5B8] p-1"
                          title="Compartir entrada"
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="text-[#6E655A] hover:text-rose-400 p-1"
                          title="Eliminar entrada"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {note.description && (
                      <p className="text-sm text-[#E5DDD0] mt-2.5 leading-relaxed whitespace-pre-line">
                        {note.description}
                      </p>
                    )}
                  </div>
                  {note.symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-4 pt-3 border-t border-[#24211D]">
                      {note.symptoms.map((sym) => (
                        <span
                          key={sym}
                          className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-[#E6D5B8]/12 text-[#E6D5B8] border border-[#E6D5B8]/25"
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================= 5. RESUMEN (ÚLTIMA PESTAÑA) ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#1C1916] via-[#151311] to-[#0F0E0D] rounded-3xl p-6 md:p-8 text-[#F5EFE6] border border-[#2E2924] shadow-xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6D5B8]/15 border border-[#E6D5B8]/30 text-[#E6D5B8] text-xs font-semibold mb-3">
                    <Sparkles className="w-3.5 h-3.5" /> Trimestre {pregnancyStats.trimester} •{' '}
                    {pregnancyStats.progress}% completado
                  </span>
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#F5EFE6]">
                    {pregnancyStats.weeks} semanas{' '}
                    <span className="text-[#C8B08E] font-medium text-2xl">
                      y {pregnancyStats.days} días
                    </span>
                  </h2>
                  <p className="text-[#A89E90] text-sm mt-2">
                    Fecha Probable de Parto:{' '}
                    <strong className="text-[#E6D5B8]">
                      {formatReadableDate(pregnancyStats.fppStr)}
                    </strong>{' '}
                    ({pregnancyStats.daysRemaining} días restantes)
                  </p>
                </div>

                <div className="bg-[#0E0D0C]/80 border border-[#2B2621] rounded-2xl p-4 min-w-[210px]">
                  <p className="text-xs text-[#9C9183]">Código Familiar Compartido</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-base font-mono font-bold tracking-wider text-[#E6D5B8]">
                      {data.familyCode}
                    </span>
                    <button
                      onClick={copyFamilyCode}
                      className="p-1.5 rounded-lg bg-[#1F1D1A] hover:bg-[#2A2622] text-[#E6D5B8] transition-colors"
                      title="Copiar código"
                    >
                      {copiedCode ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#7A7064] mt-1">Mamá y Papá sincronizados</p>
                </div>
              </div>

              <div className="mt-6">
                <div className="flex justify-between text-xs text-[#8A7F72] mb-1.5">
                  <span>Semana 1</span>
                  <span>Semana 20</span>
                  <span>Semana 40</span>
                </div>
                <div className="w-full h-3 bg-[#24211D] rounded-full overflow-hidden border border-[#2F2B25]">
                  <div
                    className="h-full bg-gradient-to-r from-[#B89F7D] to-[#E6D5B8] rounded-full transition-all duration-500"
                    style={{ width: `${pregnancyStats.progress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#141312] rounded-2xl p-5 border border-[#292520] shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#9C9183]">
                    Próximo Turno
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-[#E6D5B8]/12 text-[#E6D5B8] flex items-center justify-center">
                    <Stethoscope className="w-4 h-4" />
                  </div>
                </div>
                {upcomingAppointments[0] ? (
                  <div className="mt-3">
                    <p className="font-bold text-[#F5EFE6] truncate">
                      {upcomingAppointments[0].title}
                    </p>
                    <p className="text-xs text-[#C8B08E] mt-1">
                      {formatReadableDate(upcomingAppointments[0].date)} •{' '}
                      {upcomingAppointments[0].time} hs
                    </p>
                    <button
                      onClick={() =>
                        downloadAppleCalendarICS({
                          title: upcomingAppointments[0].title,
                          date: upcomingAppointments[0].date,
                          time: upcomingAppointments[0].time,
                          location: upcomingAppointments[0].location,
                          description: upcomingAppointments[0].description
                        })
                      }
                      className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#E6D5B8] hover:underline"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" /> Agendar en iPhone (.ics)
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-[#6E655A] mt-3">Sin turnos pendientes</p>
                )}
              </div>

              <div className="bg-[#141312] rounded-2xl p-5 border border-[#292520] shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#9C9183]">
                    Estudios Registrados
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-sky-500/12 text-sky-300 flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-3">
                  <p className="text-2xl font-bold text-[#F5EFE6]">{data.studies.length}</p>
                  <p className="text-xs text-[#9C9183]">
                    ({data.studies.filter((s) => s.status === 'pendiente').length} pendientes)
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('studies')}
                  className="text-xs text-[#E6D5B8] font-medium mt-2 hover:underline"
                >
                  Ver estudios y comentarios →
                </button>
              </div>

              <div className="bg-[#141312] rounded-2xl p-5 border border-[#292520] shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#9C9183]">
                    Bitácora / Comentarios
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/12 text-emerald-300 flex items-center justify-center">
                    <Heart className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-3">
                  <p className="text-2xl font-bold text-[#F5EFE6]">{data.notes.length}</p>
                  <p className="text-xs text-[#9C9183]">entradas guardadas</p>
                </div>
                <button
                  onClick={() => setActiveTab('notes')}
                  className="text-xs text-[#E6D5B8] font-medium mt-2 hover:underline"
                >
                  Abrir bitácora / comentarios →
                </button>
              </div>
            </div>

            <div className="bg-[#141312] rounded-3xl p-6 border border-[#292520] shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-[#F5EFE6]">Próximos Turnos y Estudios</h3>
                <button
                  onClick={() => setActiveTab('calendar')}
                  className="text-xs font-semibold text-[#E6D5B8] hover:underline"
                >
                  Volver al calendario →
                </button>
              </div>
              <div className="space-y-3">
                {upcomingAppointments.length === 0 ? (
                  <p className="text-sm text-[#6E655A] py-4 text-center">
                    No tenés turnos próximos agendados.
                  </p>
                ) : (
                  upcomingAppointments.slice(0, 4).map((app) => (
                    <div
                      key={app.id}
                      className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#1B1917] border border-[#292520]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#24211D] border border-[#332E28] flex flex-col items-center justify-center text-[#E6D5B8] font-bold text-xs">
                          <span>{app.date.split('-')[2]}</span>
                          <span className="text-[10px] uppercase text-[#9C9183]">
                            {new Date(
                              Number(app.date.split('-')[0]),
                              Number(app.date.split('-')[1]) - 1,
                              1
                            ).toLocaleDateString('es-AR', { month: 'short' })}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-[#F5EFE6]">{app.title}</p>
                          <p className="text-xs text-[#9C9183]">
                            {app.doctor} • {app.time} hs
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            downloadAppleCalendarICS({
                              title: app.title,
                              date: app.date,
                              time: app.time,
                              location: app.location,
                              description: app.description
                            })
                          }
                          className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-[#25221E] border border-[#36312B] text-[#E6D5B8] hover:bg-[#2E2A25]"
                        >
                          iPhone (.ics)
                        </button>
                        <button
                          onClick={() => toggleAppointment(app.id)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25"
                        >
                          Completar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Navegación Inferior Móvil */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-[#121110]/95 backdrop-blur-md border-t border-[#292520] z-30 px-2 py-1.5">
        <div className="flex justify-around items-center">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl text-[10px] font-medium transition-colors ${
                  active ? 'text-[#E6D5B8] font-bold' : 'text-[#7A7064]'
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.id === 'notes' ? 'Bitácora' : tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ================= MODAL: COMPARTIR CON PAPÁ ================= */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161412] border border-[#2E2924] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#E6D5B8]" />
                <h3 className="text-lg font-bold text-[#F5EFE6]">Compartir Control</h3>
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-[#7A7064] hover:text-[#F5EFE6]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#A89E90] leading-relaxed">
              Compartí el enlace directo o el <strong className="text-[#E6D5B8]">Código Familiar</strong> para ver y editar juntos turnos, estudios y comentarios desde otro teléfono o computadora.
            </p>

            {/* Enlace directo con código incluido */}
            <div className="p-3.5 rounded-2xl bg-[#1E1C19] border border-[#332E28] space-y-2">
              <span className="text-[11px] font-semibold uppercase text-[#C8B08E] block">
                Enlace directo de acceso
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={shareableUrl}
                  className="flex-1 text-xs px-3 py-2 rounded-xl bg-[#141312] border border-[#2E2924] text-[#D8CBB8] font-mono truncate"
                />
                <button
                  onClick={copyShareLink}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#292622] border border-[#3B352E] text-xs font-semibold text-[#E6D5B8] hover:bg-[#332F2A] shrink-0"
                >
                  {copiedLink ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  {copiedLink ? 'Copiado' : 'Copiar link'}
                </button>
              </div>
            </div>

            {/* Código Familiar */}
            <div className="p-4 rounded-2xl bg-[#1E1C19] border border-[#332E28] flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase text-[#C8B08E] block">
                  Código Familiar Activo
                </span>
                <span className="text-xl font-mono font-extrabold text-[#F5EFE6] tracking-widest">
                  {data.familyCode}
                </span>
              </div>
              <button
                onClick={copyFamilyCode}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#292622] border border-[#3B352E] text-xs font-semibold text-[#E6D5B8] hover:bg-[#332F2A]"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedCode ? 'Copiado' : 'Copiar'}
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#C8B08E]">
                ¿Tenés un código existente? Ingresalo para vincular:
              </label>
              <input
                type="text"
                value={data.familyCode}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, familyCode: e.target.value.toUpperCase() }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm font-mono uppercase text-[#F5EFE6]"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={shareViaWhatsApp}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
              >
                <Share2 className="w-4 h-4" /> Compartir por WhatsApp
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[#E6D5B8] hover:bg-[#D5C09D] text-[#121110] text-xs font-bold"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CONFIGURACIÓN FUM / FPP ================= */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#161412] border border-[#2E2924] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#F5EFE6]">Configurar Control</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[#7A7064] hover:text-[#F5EFE6]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#C8B08E] mb-1">
                  Nombre o apodo del bebé
                </label>
                <input
                  type="text"
                  value={data.pregnancy.babyName}
                  onChange={(e) =>
                    setData((prev) => ({
                      ...prev,
                      pregnancy: { ...prev.pregnancy, babyName: e.target.value }
                    }))
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#C8B08E] mb-1">
                  Fecha de Última Menstruación (FUM)
                </label>
                <input
                  type="date"
                  value={data.pregnancy.fum}
                  onChange={(e) => handleFumChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#C8B08E] mb-1">
                  O ingresá Fecha Probable de Parto (FPP)
                </label>
                <input
                  type="date"
                  value={pregnancyStats.fppStr}
                  onChange={(e) => handleFppChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6]"
                />
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-2.5 rounded-xl bg-[#E6D5B8] hover:bg-[#D5C09D] text-[#121110] font-bold text-sm transition-colors"
            >
              Guardar Cambios
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL: NUEVO TURNO ================= */}
      {showAppModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={addAppointment}
            className="bg-[#161412] border border-[#2E2924] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#F5EFE6]">Agendar Turno Médico</h3>
              <button
                type="button"
                onClick={() => setShowAppModal(false)}
                className="text-[#7A7064] hover:text-[#F5EFE6]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                required
                placeholder="Motivo del turno (ej: Control Obstétrico)"
                value={appForm.title}
                onChange={(e) => setAppForm({ ...appForm, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6] placeholder-[#6E655A]"
              />
              <input
                type="text"
                placeholder="Profesional (ej: Dra. Gómez)"
                value={appForm.doctor}
                onChange={(e) => setAppForm({ ...appForm, doctor: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6] placeholder-[#6E655A]"
              />
              <input
                type="text"
                placeholder="Lugar / Dirección / Consultorio"
                value={appForm.location}
                onChange={(e) => setAppForm({ ...appForm, location: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6] placeholder-[#6E655A]"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  required
                  value={appForm.date}
                  onChange={(e) => setAppForm({ ...appForm, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6]"
                />
                <input
                  type="time"
                  required
                  value={appForm.time}
                  onChange={(e) => setAppForm({ ...appForm, time: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6]"
                />
              </div>
              <textarea
                rows="3"
                placeholder="Descripción detallada: estudios a llevar, preguntas para el médico, indicaciones..."
                value={appForm.description}
                onChange={(e) => setAppForm({ ...appForm, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6] placeholder-[#6E655A]"
              />
            </div>

            <div className="p-3 rounded-xl bg-[#1E1C19] border border-[#332E28] text-[11px] text-[#C8B08E] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#E6D5B8]" />
              Luego de guardar podrás descargar el evento al Calendario de iPhone con recordatorios
              automáticos.
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#E6D5B8] hover:bg-[#D5C09D] text-[#121110] font-bold text-sm"
            >
              Guardar Turno
            </button>
          </form>
        </div>
      )}

      {/* ================= MODAL: NUEVO ESTUDIO ================= */}
      {showStudyModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={addStudy}
            className="bg-[#161412] border border-[#2E2924] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#F5EFE6]">Registrar Estudio Médico</h3>
              <button
                type="button"
                onClick={() => setShowStudyModal(false)}
                className="text-[#7A7064] hover:text-[#F5EFE6]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#C8B08E] mb-1.5">
                  Tipo de estudio
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STUDY_CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => setStudyForm({ ...studyForm, category: cat.id })}
                      className={`py-2 px-2.5 rounded-xl text-xs font-semibold border text-left transition-all ${
                        studyForm.category === cat.id
                          ? 'bg-[#E6D5B8]/15 border-[#E6D5B8] text-[#E6D5B8]'
                          : 'bg-[#1B1917] border-[#2E2924] text-[#9C9183] hover:text-[#F5EFE6]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {studyForm.category === 'otro' && (
                <input
                  type="text"
                  required
                  placeholder="Especificá el tipo (ej: Odontológico, Genético, Doppler...)"
                  value={studyForm.customType}
                  onChange={(e) => setStudyForm({ ...studyForm, customType: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6] placeholder-[#6E655A]"
                />
              )}

              <input
                type="text"
                required
                placeholder="Nombre del estudio (ej: Monitoreo Fetal / Curva de Glucosa)"
                value={studyForm.title}
                onChange={(e) => setStudyForm({ ...studyForm, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6] placeholder-[#6E655A]"
              />

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="date"
                  required
                  value={studyForm.date}
                  onChange={(e) => setStudyForm({ ...studyForm, date: e.target.value })}
                  className="w-full px-2.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-xs text-[#F5EFE6]"
                />
                <input
                  type="time"
                  value={studyForm.time}
                  onChange={(e) => setStudyForm({ ...studyForm, time: e.target.value })}
                  className="w-full px-2.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-xs text-[#F5EFE6]"
                />
                <input
                  type="number"
                  placeholder={`Sem. (${pregnancyStats.weeks})`}
                  value={studyForm.week}
                  onChange={(e) => setStudyForm({ ...studyForm, week: e.target.value })}
                  className="w-full px-2.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-xs text-[#F5EFE6] placeholder-[#6E655A]"
                />
              </div>

              <input
                type="text"
                placeholder="Centro / Laboratorio / Clínica"
                value={studyForm.clinic}
                onChange={(e) => setStudyForm({ ...studyForm, clinic: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6] placeholder-[#6E655A]"
              />

              <select
                value={studyForm.status}
                onChange={(e) => setStudyForm({ ...studyForm, status: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6]"
              >
                <option value="pendiente">Estado: Pendiente de realizar</option>
                <option value="realizado">Estado: Ya realizado</option>
              </select>

              <textarea
                rows="3"
                placeholder="Descripción, preparación previa (ej: ayuno) o resultados principales..."
                value={studyForm.description}
                onChange={(e) => setStudyForm({ ...studyForm, description: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6] placeholder-[#6E655A]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#E6D5B8] hover:bg-[#D5C09D] text-[#121110] font-bold text-sm"
            >
              Guardar Estudio
            </button>
          </form>
        </div>
      )}

      {/* ================= MODAL: NUEVA ENTRADA BITÁCORA / COMENTARIOS ================= */}
      {showNoteModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={addNote}
            className="bg-[#161412] border border-[#2E2924] rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#F5EFE6]">Nueva Entrada ({activeParent})</h3>
              <button
                type="button"
                onClick={() => setShowNoteModal(false)}
                className="text-[#7A7064] hover:text-[#F5EFE6]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Descripción obligatoria primero */}
              <div>
                <label className="block text-xs font-semibold text-[#C8B08E] mb-1">
                  Descripción / Comentario *
                </label>
                <textarea
                  rows="4"
                  required
                  placeholder="Escribí acá tu comentario, sensación o lo que pasó hoy..."
                  value={noteForm.description}
                  onChange={(e) => setNoteForm({ ...noteForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6] placeholder-[#6E655A] focus:outline-none focus:border-[#E6D5B8]"
                />
              </div>

              {/* Título opcional */}
              <input
                type="text"
                placeholder="Título (opcional)"
                value={noteForm.title}
                onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6] placeholder-[#6E655A]"
              />

              {/* Fecha y Emoción opcional (sin predefinir) */}
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={noteForm.date}
                  onChange={(e) => setNoteForm({ ...noteForm, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6]"
                />
                <select
                  value={noteForm.mood}
                  onChange={(e) => setNoteForm({ ...noteForm, mood: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#1B1917] border border-[#2E2924] text-sm text-[#F5EFE6]"
                >
                  <option value="">Emoción (opcional)</option>
                  <option value="Feliz">Feliz</option>
                  <option value="Emocionada">Emocionada</option>
                  <option value="Tranquila">Tranquila</option>
                  <option value="Cansada">Cansada</option>
                  <option value="Sensible">Sensible</option>
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-[#C8B08E] mb-1.5">
                  Síntomas o sensaciones (opcional):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {symptomOptions.map((sym) => {
                    const active = noteForm.symptoms.includes(sym);
                    return (
                      <button
                        type="button"
                        key={sym}
                        onClick={() => toggleSymptom(sym)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          active
                            ? 'bg-[#E6D5B8] border-[#E6D5B8] text-[#121110] font-semibold'
                            : 'bg-[#1B1917] border-[#2E2924] text-[#9C9183] hover:text-[#F5EFE6]'
                        }`}
                      >
                        {sym}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-[#E6D5B8] hover:bg-[#D5C09D] text-[#121110] font-bold text-sm"
            >
              Guardar en Bitácora / Comentarios
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
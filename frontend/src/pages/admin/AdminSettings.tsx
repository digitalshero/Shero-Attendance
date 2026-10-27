import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import {
  Settings,
  Clock,
  ShieldCheck,
  HelpCircle,
  Save,
  RefreshCw,
  AlertCircle,
  MapPin,
  Navigation,
  Building2,
  Briefcase,
  Home,
  Compass,
  Calendar,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  X,
  ExternalLink,
  Globe,
  ChevronLeft,
  ChevronRight,
  Check,
  SlidersHorizontal,
  CheckCircle2,
  Download,
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle
} from 'lucide-react';

interface Holiday {
  _id?: string;
  name: string;
  date: string;
  type?: string;
  description?: string;
}

interface WfhDay {
  _id?: string;
  date: string;
  title: string;
  description?: string;
}

const DEFAULT_DEPARTMENTS = [
  'DST',
  'TECH',
  'HR',
  'OGB',
  'KOB',
  'Accounts',
  'Finance',
  'Compliance',
];

type SettingsTab = 'TIMINGS' | 'GEOFENCE' | 'WFH' | 'HOLIDAYS' | 'DEPARTMENTS';

const VALID_TABS: SettingsTab[] = ['TIMINGS', 'GEOFENCE', 'WFH', 'HOLIDAYS', 'DEPARTMENTS'];

const AdminSettings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab')?.toUpperCase();
  const [activeTab, setActiveTabState] = useState<SettingsTab>(
    VALID_TABS.includes(tabFromUrl as SettingsTab) ? (tabFromUrl as SettingsTab) : 'TIMINGS'
  );
  const setActiveTab = (tab: SettingsTab) => {
    setActiveTabState(tab);
    setSearchParams({ tab: tab.toLowerCase() }, { replace: true });
  };

  // Keep activeTab in sync when navigation (e.g. the sidebar's Settings dropdown) changes the URL externally
  useEffect(() => {
    if (VALID_TABS.includes(tabFromUrl as SettingsTab) && tabFromUrl !== activeTab) {
      setActiveTabState(tabFromUrl as SettingsTab);
    }
  }, [tabFromUrl]);

  const [settings, setSettings] = useState({
    pfEmployeeRate: 0.12,
    pfEmployerRate: 0.12,
    esiEmployeeRate: 0.0075,
    esiEmployerRate: 0.0325,
    officeStartTime: '09:00',
    officeEndTime: '18:00',
    graceMinutes: 15,
    workWeekPattern: '6_DAYS',
    departments: DEFAULT_DEPARTMENTS,
    officeLocation: {
      latitude: 13.0827,
      longitude: 80.2707,
      radiusMeters: 500,
      address: 'Shero Home Food Head Office',
    },
    geofenceEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [googleMapsInput, setGoogleMapsInput] = useState('');
  const [sampleSalary, setSampleSalary] = useState(25000);
  const [newDepartmentInput, setNewDepartmentInput] = useState('');

  const handleParseGoogleMaps = (input: string) => {
    setGoogleMapsInput(input);
    const trimmed = input.trim();
    if (!trimmed) return;

    // 1. Match Google Maps @lat,lng
    const urlMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (urlMatch) {
      const lat = parseFloat(urlMatch[1]);
      const lng = parseFloat(urlMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setSettings((prev) => ({
          ...prev,
          officeLocation: { ...prev.officeLocation, latitude: lat, longitude: lng },
        }));
        toast.success(`Google Maps coordinates loaded: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        return;
      }
    }

    // 2. Match Google Maps q=lat,lng or ll=lat,lng
    const queryMatch = trimmed.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (queryMatch) {
      const lat = parseFloat(queryMatch[1]);
      const lng = parseFloat(queryMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setSettings((prev) => ({
          ...prev,
          officeLocation: { ...prev.officeLocation, latitude: lat, longitude: lng },
        }));
        toast.success(`Google Maps coordinates loaded: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        return;
      }
    }

    // 3. Match plain lat, lng
    const plainMatch = trimmed.match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/);
    if (plainMatch) {
      const lat = parseFloat(plainMatch[1]);
      const lng = parseFloat(plainMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        setSettings((prev) => ({
          ...prev,
          officeLocation: { ...prev.officeLocation, latitude: lat, longitude: lng },
        }));
        toast.success(`Coordinates loaded: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        return;
      }
    }
  };

  // Holidays state
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [submittingHoliday, setSubmittingHoliday] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    type: 'FESTIVAL',
    description: ''
  });

  // Bulk Holiday Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkModalTab, setBulkModalTab] = useState<'RULE' | 'EXCEL'>('RULE');
  const [bulkYear, setBulkYear] = useState(new Date().getFullYear());
  const [bulkRule, setBulkRule] = useState<'SUNDAYS' | 'SATURDAYS_2_4'>('SUNDAYS');
  const [submittingBulk, setSubmittingBulk] = useState(false);

  // Holiday Excel Import State
  const [holidayExcelRows, setHolidayExcelRows] = useState<any[]>([]);
  const [holidayExcelFileName, setHolidayExcelFileName] = useState('');
  const [importingHolidayExcel, setImportingHolidayExcel] = useState(false);

  // Company WFH Schedule State
  const [wfhDaysList, setWfhDaysList] = useState<WfhDay[]>([]);
  const [loadingWfhDays, setLoadingWfhDays] = useState(false);
  const [submittingWfhDay, setSubmittingWfhDay] = useState(false);
  const [wfhDayForm, setWfhDayForm] = useState({
    date: '',
    title: 'Company-Wide Work From Home',
    description: '',
  });

  // Bulk WFH Modal State
  const [bulkWfhModalOpen, setBulkWfhModalOpen] = useState(false);
  const [bulkWfhTab, setBulkWfhTab] = useState<'CALENDAR' | 'RULES'>('CALENDAR');
  const [wfhCalendarMonth, setWfhCalendarMonth] = useState<Date>(new Date());
  const [selectedWfhDates, setSelectedWfhDates] = useState<string[]>([]);
  const [bulkCustomTitle, setBulkCustomTitle] = useState('Company-Wide Work From Home');
  const [bulkCustomDesc, setBulkCustomDesc] = useState('');
  const [bulkWfhYear, setBulkWfhYear] = useState(new Date().getFullYear());
  const [bulkWfhRule, setBulkWfhRule] = useState<'WEDNESDAYS_AND_SATURDAYS' | 'WEDNESDAYS' | 'SATURDAYS' | 'FRIDAYS'>('WEDNESDAYS_AND_SATURDAYS');
  const [submittingBulkWfh, setSubmittingBulkWfh] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchHolidays();
    fetchWfhDays();
  }, []);

  const fetchWfhDays = async () => {
    try {
      setLoadingWfhDays(true);
      const res = await api.get('/admin/wfh-days');
      if (Array.isArray(res.data)) {
        setWfhDaysList(res.data);
      } else if (res.data?.wfhDays && Array.isArray(res.data.wfhDays)) {
        setWfhDaysList(res.data.wfhDays);
      } else {
        setWfhDaysList([]);
      }
    } catch (error) {
      console.error('Failed to load company WFH days', error);
    } finally {
      setLoadingWfhDays(false);
    }
  };

  const handleAddWfhDay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wfhDayForm.date) {
      toast.error('Please select a date for WFH schedule');
      return;
    }
    setSubmittingWfhDay(true);
    try {
      const res = await api.post('/admin/wfh-days', wfhDayForm);
      toast.success('Company-wide WFH day added successfully!');
      if (Array.isArray(res.data.wfhDays)) {
        setWfhDaysList(res.data.wfhDays);
      } else {
        await fetchWfhDays();
      }
      setWfhDayForm({ date: '', title: 'Company-Wide Work From Home', description: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add company WFH day');
    } finally {
      setSubmittingWfhDay(false);
    }
  };

  const handleDeleteWfhDay = async (idOrDate?: string) => {
    if (!idOrDate) return;
    if (!window.confirm('Are you sure you want to remove this scheduled WFH day?')) return;
    try {
      const res = await api.delete(`/admin/wfh-days/${idOrDate}`);
      toast.success('Company WFH day removed successfully');
      if (Array.isArray(res.data.wfhDays)) {
        setWfhDaysList(res.data.wfhDays);
      } else {
        await fetchWfhDays();
      }
    } catch (err: any) {
      toast.error('Failed to delete WFH day');
    }
  };

  // Calendar helpers for Multi-Date Selection
  const handleToggleCalendarDate = (dateStr: string) => {
    setSelectedWfhDates(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort()
    );
  };

  const handlePrevWfhMonth = () => {
    setWfhCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextWfhMonth = () => {
    setWfhCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleQuickSelectDayOfWeek = (targetDay: number) => {
    const year = wfhCalendarMonth.getFullYear();
    const month = wfhCalendarMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const matchingDates: string[] = [];

    for (let day = 1; day <= lastDay; day++) {
      const d = new Date(year, month, day);
      if (d.getDay() === targetDay) {
        const yyyy = year;
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        matchingDates.push(`${yyyy}-${mm}-${dd}`);
      }
    }

    const allSelected = matchingDates.every(d => selectedWfhDates.includes(d));
    if (allSelected) {
      setSelectedWfhDates(prev => prev.filter(d => !matchingDates.includes(d)));
    } else {
      setSelectedWfhDates(prev => Array.from(new Set([...prev, ...matchingDates])).sort());
    }
  };

  const handleQuickSelectWedAndSat = () => {
    const year = wfhCalendarMonth.getFullYear();
    const month = wfhCalendarMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const matchingDates: string[] = [];

    for (let day = 1; day <= lastDay; day++) {
      const d = new Date(year, month, day);
      if (d.getDay() === 3 || d.getDay() === 6) { // Wednesday or Saturday
        const yyyy = year;
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        matchingDates.push(`${yyyy}-${mm}-${dd}`);
      }
    }

    const allSelected = matchingDates.every(d => selectedWfhDates.includes(d));
    if (allSelected) {
      setSelectedWfhDates(prev => prev.filter(d => !matchingDates.includes(d)));
    } else {
      setSelectedWfhDates(prev => Array.from(new Set([...prev, ...matchingDates])).sort());
    }
  };

  const handleBulkSubmitCalendarWfhDays = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedWfhDates.length === 0) {
      toast.error('Please select at least one date on the calendar');
      return;
    }
    setSubmittingBulkWfh(true);
    try {
      const items = selectedWfhDates.map(date => ({
        date,
        title: bulkCustomTitle || 'Company-Wide Work From Home',
        description: bulkCustomDesc || 'Scheduled company WFH day',
      }));
      const res = await api.post('/admin/wfh-days/bulk', { items });
      toast.success(res.data.message || `Successfully scheduled ${items.length} WFH days!`);
      if (Array.isArray(res.data.wfhDays)) {
        setWfhDaysList(res.data.wfhDays);
      } else {
        await fetchWfhDays();
      }
      setSelectedWfhDates([]);
      setBulkWfhModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add bulk WFH days');
    } finally {
      setSubmittingBulkWfh(false);
    }
  };

  const handleBulkAddWfhDays = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBulkWfh(true);
    try {
      const res = await api.post('/admin/wfh-days/bulk', {
        year: bulkWfhYear,
        rule: bulkWfhRule,
      });
      toast.success(res.data.message || 'Bulk WFH days added successfully!');
      if (Array.isArray(res.data.wfhDays)) {
        setWfhDaysList(res.data.wfhDays);
      } else {
        await fetchWfhDays();
      }
      setBulkWfhModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add bulk WFH days');
    } finally {
      setSubmittingBulkWfh(false);
    }
  };

  const handleBulkAddHolidays = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingBulk(true);
    try {
      const res = await api.post('/admin/holidays/bulk', {
        year: bulkYear,
        rule: bulkRule,
      });
      toast.success(res.data.message || 'Bulk holidays added successfully!');
      if (Array.isArray(res.data.holidays)) {
        setHolidays(res.data.holidays);
      } else {
        await fetchHolidays();
      }
      setBulkModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add bulk holidays');
    } finally {
      setSubmittingBulk(false);
    }
  };

  const handleDownloadHolidaySample = () => {
    const sampleData = [
      { 'Holiday Name': 'Republic Day', 'Date': '2026-01-26', 'Type': 'NATIONAL', 'Description': 'National Holiday' },
      { 'Holiday Name': 'Diwali', 'Date': '2026-11-08', 'Type': 'FESTIVAL', 'Description': 'Festival of Lights' },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Holidays');
    XLSX.writeFile(wb, 'Shero_Holiday_Import_Template.xlsx');
  };

  const handleHolidayExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          toast.error('The uploaded Excel file appears to be empty.');
          return;
        }

        const VALID_TYPES = ['NATIONAL', 'FESTIVAL', 'COMPANY', 'OPTIONAL'];
        const parsedRows = data.map((row, idx) => {
          const findField = (...names: string[]) => {
            for (const key of Object.keys(row)) {
              const cleanKey = key.trim().toLowerCase().replace(/[\s_\-.]+/g, '');
              for (const name of names) {
                const cleanName = name.toLowerCase().replace(/[\s_\-.]+/g, '');
                if (cleanKey === cleanName) return row[key];
              }
            }
            return undefined;
          };

          const name = String(findField('Holiday Name', 'Name', 'Holiday', 'Title') || '').trim();
          const rawDate = findField('Date', 'Holiday Date');
          let date = '';
          if (rawDate instanceof Date) {
            date = rawDate.toISOString().split('T')[0];
          } else if (typeof rawDate === 'number') {
            const parsed = XLSX.SSF.parse_date_code(rawDate);
            if (parsed) date = `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
          } else if (rawDate) {
            const parsedDate = new Date(String(rawDate).trim());
            date = !isNaN(parsedDate.getTime()) ? parsedDate.toISOString().split('T')[0] : String(rawDate).trim();
          }
          const typeRaw = String(findField('Type', 'Holiday Type') || 'COMPANY').trim().toUpperCase();
          const type = VALID_TYPES.includes(typeRaw) ? typeRaw : 'COMPANY';
          const description = String(findField('Description', 'Notes', 'Remarks') || '').trim();

          const errors: string[] = [];
          if (!name) errors.push('Holiday name missing');
          if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Invalid or missing date (expected YYYY-MM-DD)');

          return { id: idx + 1, name, date, type, description, isValid: errors.length === 0, errors };
        });

        setHolidayExcelRows(parsedRows);
        setHolidayExcelFileName(file.name);
        toast.success(`Successfully loaded ${parsedRows.length} rows from ${file.name}`);
      } catch (error) {
        console.error('Failed to parse holiday Excel file', error);
        toast.error('Failed to read Excel file. Please ensure it is a valid .xlsx or .csv file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleImportHolidayExcel = async () => {
    const validRows = holidayExcelRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      toast.error('No valid rows found to import.');
      return;
    }
    setImportingHolidayExcel(true);
    try {
      const res = await api.post('/admin/holidays/bulk', {
        items: validRows.map((r) => ({ name: r.name, date: r.date, type: r.type, description: r.description })),
      });
      toast.success(res.data.message || 'Holidays imported successfully!');
      if (Array.isArray(res.data.holidays)) {
        setHolidays(res.data.holidays);
      } else {
        await fetchHolidays();
      }
      setHolidayExcelRows([]);
      setHolidayExcelFileName('');
      setBulkModalOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to import holidays');
    } finally {
      setImportingHolidayExcel(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      setLoadingHolidays(true);
      const res = await api.get('/admin/holidays');
      if (Array.isArray(res.data)) {
        setHolidays(res.data);
      } else if (res.data && Array.isArray(res.data.holidays)) {
        setHolidays(res.data.holidays);
      } else {
        setHolidays([]);
      }
    } catch (error) {
      console.error('Failed to load holidays', error);
    } finally {
      setLoadingHolidays(false);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.name.trim() || !holidayForm.date) {
      toast.error('Holiday name and date are required');
      return;
    }
    setSubmittingHoliday(true);
    try {
      const res = await api.post('/admin/holidays', holidayForm);
      toast.success('Company holiday added successfully!');
      if (Array.isArray(res.data.holidays)) {
        setHolidays(res.data.holidays);
      } else {
        await fetchHolidays();
      }
      setHolidayForm({ name: '', date: '', type: 'FESTIVAL', description: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add holiday');
    } finally {
      setSubmittingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      const res = await api.delete(`/admin/holidays/${id}`);
      toast.success('Holiday deleted successfully');
      if (Array.isArray(res.data.holidays)) {
        setHolidays(res.data.holidays);
      } else {
        await fetchHolidays();
      }
    } catch (err: any) {
      toast.error('Failed to delete holiday');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get('/admin/settings');
      setSettings({
        ...res.data,
        officeStartTime: res.data.officeStartTime || '09:00',
        officeEndTime: res.data.officeEndTime || '18:00',
        graceMinutes: res.data.graceMinutes ?? 15,
        workWeekPattern: res.data.workWeekPattern || '6_DAYS',
        departments: Array.isArray(res.data.departments) && res.data.departments.length > 0 
          ? res.data.departments 
          : DEFAULT_DEPARTMENTS,
        officeLocation: {
          latitude: res.data.officeLocation?.latitude ?? 13.0827,
          longitude: res.data.officeLocation?.longitude ?? 80.2707,
          radiusMeters: res.data.officeLocation?.radiusMeters ?? 500,
          address: res.data.officeLocation?.address || 'Shero Home Food Head Office',
        },
        geofenceEnabled: res.data.geofenceEnabled !== false,
      });
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDepartment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newDepartmentInput.trim();
    if (!trimmed) {
      toast.error('Please enter department name');
      return;
    }
    const currentDepts = settings.departments || DEFAULT_DEPARTMENTS;
    const exists = currentDepts.some(d => d.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.error(`Department "${trimmed}" already exists`);
      return;
    }
    const updatedDepts = [...currentDepts, trimmed];
    setSettings((prev) => ({ ...prev, departments: updatedDepts }));
    setNewDepartmentInput('');
    toast.success(`Department "${trimmed}" added! Click Save to apply.`);
  };

  const handleDeleteDepartment = (deptToRemove: string) => {
    const currentDepts = settings.departments || DEFAULT_DEPARTMENTS;
    if (currentDepts.length <= 1) {
      toast.error('At least one department must remain configured');
      return;
    }
    const updatedDepts = currentDepts.filter(d => d !== deptToRemove);
    setSettings((prev) => ({ ...prev, departments: updatedDepts }));
    toast.success(`Department "${deptToRemove}" removed. Click Save to apply.`);
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setSettings((prev) => ({
          ...prev,
          officeLocation: {
            ...prev.officeLocation,
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
          },
        }));
        setDetectingLocation(false);
        toast.success(`Current GPS coordinates captured! (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
      },
      (err) => {
        setDetectingLocation(false);
        toast.error('Unable to retrieve location. Please allow browser location access.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await api.put('/admin/settings', settings);
      toast.success('System settings updated successfully!');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  // Quick live simulator calculations
  const sampleBasic = sampleSalary * 0.5; // typical 50% basic
  const simPfEmployee = sampleBasic * settings.pfEmployeeRate;
  const simPfEmployer = sampleBasic * settings.pfEmployerRate;
  const simEsiEmployee = sampleSalary <= 21000 ? sampleSalary * settings.esiEmployeeRate : 0;
  const simEsiEmployer = sampleSalary <= 21000 ? sampleSalary * settings.esiEmployerRate : 0;

  // Existing scheduled WFH dates set
  const scheduledWfhDatesSet = new Set(wfhDaysList.map((w) => w.date));

  // Display lists sorted newest to oldest (fetch order is unaffected)
  const sortedWfhDaysList = [...wfhDaysList].sort((a, b) => b.date.localeCompare(a.date));
  const sortedHolidaysList = [...holidays].sort((a, b) => b.date.localeCompare(a.date));

  // Calendar calculations for WFH bulk modal
  const wfhYear = wfhCalendarMonth.getFullYear();
  const wfhMonth = wfhCalendarMonth.getMonth();
  const wfhFirstDayOfMonth = new Date(wfhYear, wfhMonth, 1);
  const wfhLastDayOfMonth = new Date(wfhYear, wfhMonth + 1, 0);
  const wfhDaysInMonth = wfhLastDayOfMonth.getDate();
  const wfhStartingDay = (wfhFirstDayOfMonth.getDay() + 6) % 7; // 0=Mon, 6=Sun

  const calendarDays: Array<{
    dayNum: number;
    dateStr: string;
    dayOfWeek: number;
    isScheduled: boolean;
    isSelected: boolean;
  } | null> = [];

  for (let i = 0; i < wfhStartingDay; i++) {
    calendarDays.push(null);
  }

  for (let day = 1; day <= wfhDaysInMonth; day++) {
    const yyyy = wfhYear;
    const mm = String(wfhMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const d = new Date(wfhYear, wfhMonth, day);
    calendarDays.push({
      dayNum: day,
      dateStr,
      dayOfWeek: d.getDay(),
      isScheduled: scheduledWfhDatesSet.has(dateStr),
      isSelected: selectedWfhDates.includes(dateStr),
    });
  }

  // Tabs configuration with helpful badges
  const tabs = [
    {
      id: 'TIMINGS' as SettingsTab,
      label: 'Shift & Timings',
      icon: Clock,
      badge: `${settings.officeStartTime} - ${settings.officeEndTime}`,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
      autosave: false,
    },
    {
      id: 'GEOFENCE' as SettingsTab,
      label: 'Office Geofence',
      icon: MapPin,
      badge: `${settings.officeLocation.radiusMeters}m Radius`,
      badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
      autosave: false,
    },
    {
      id: 'WFH' as SettingsTab,
      label: 'Company WFH Days',
      icon: Home,
      badge: `${wfhDaysList.length} Scheduled`,
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      autosave: true,
    },
    {
      id: 'HOLIDAYS' as SettingsTab,
      label: 'Holidays Calendar',
      icon: Calendar,
      badge: `${holidays.length} Holidays`,
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      autosave: true,
    },
    {
      id: 'DEPARTMENTS' as SettingsTab,
      label: 'Departments',
      icon: Briefcase,
      badge: `${(settings.departments || DEFAULT_DEPARTMENTS).length} Units`,
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      autosave: false,
    },
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <div className="w-10 h-10 border-4 border-teal-500/20 border-t-teal-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Loading system configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-24 animate-fade-in">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-6 sm:p-7 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-2">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Admin Control Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-white">
            System & Organization Settings
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
            Quickly navigate and customize shifts, office geofence perimeter, company WFH dates, holidays, departments, and payroll rules.
          </p>
        </div>
        <div className="relative z-10 flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchSettings}
            className="px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5"
            title="Reload settings from server"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          {tabs.find((t) => t.id === activeTab)?.autosave ? (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Changes save instantly
            </span>
          ) : (
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: SHIFT TIMINGS & WORKING DAYS */}
      {activeTab === 'TIMINGS' && (
        <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
          {/* Shift Hours & Late Grace Period */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-xs">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Shift Timings & Grace Policy
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200/80">
                      Attendance Rules
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Defines the official office benchmark times and late arrival grace minutes applied during punch-in.
                  </p>
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto shrink-0"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Timings</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider">
                  Office Start Time
                </label>
                <input
                  type="time"
                  required
                  value={settings.officeStartTime}
                  onChange={(e) => setSettings({ ...settings, officeStartTime: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 font-mono font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">Official morning duty commencement (e.g. 09:00 AM).</p>
              </div>

              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider">
                  Office End Time
                </label>
                <input
                  type="time"
                  required
                  value={settings.officeEndTime}
                  onChange={(e) => setSettings({ ...settings, officeEndTime: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 font-mono font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">Official daily wrap-up time (e.g. 06:00 PM).</p>
              </div>

              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider">
                  Late Grace Threshold (Minutes)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="120"
                    required
                    value={settings.graceMinutes}
                    onChange={(e) => setSettings({ ...settings, graceMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 font-mono font-bold text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 pr-16"
                  />
                  <span className="absolute inset-y-0 right-3.5 flex items-center text-xs text-slate-400 font-medium">mins</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">Grace period after start time before check-in is logged as Late.</p>
              </div>
            </div>

            {/* Visual Shift Timeline Representation */}
            <div className="bg-gradient-to-r from-slate-50 via-amber-50/30 to-slate-50 rounded-2xl p-5 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  Live Daily Shift Timeline
                </span>
                <span className="text-amber-800 font-mono bg-amber-100/70 px-2.5 py-0.5 rounded-md text-[11px]">
                  Total Shift: {
                    (() => {
                      const [sH, sM] = settings.officeStartTime.split(':').map(Number);
                      const [eH, eM] = settings.officeEndTime.split(':').map(Number);
                      let diff = (eH * 60 + eM) - (sH * 60 + sM);
                      if (diff < 0) diff += 24 * 60;
                      return `${Math.floor(diff / 60)}h ${diff % 60}m`;
                    })()
                  }
                </span>
              </div>
              
              <div className="relative h-7 bg-slate-200 rounded-xl overflow-hidden flex items-center p-1 text-[11px] font-bold">
                <div className="h-full bg-emerald-600 text-white rounded-l-lg flex items-center justify-center px-2.5 shadow-xs" style={{ width: '28%' }}>
                  On Time ({settings.officeStartTime})
                </div>
                <div className="h-full bg-amber-400 text-slate-900 flex items-center justify-center px-2 shadow-xs" style={{ width: '22%' }}>
                  Grace (+{settings.graceMinutes}m)
                </div>
                <div className="h-full bg-rose-500 text-white flex items-center justify-center px-2 shadow-xs" style={{ width: '25%' }}>
                  Late Window
                </div>
                <div className="h-full bg-teal-700 text-white rounded-r-lg flex items-center justify-center px-2 flex-1 shadow-xs">
                  Checkout ({settings.officeEndTime})
                </div>
              </div>
            </div>
          </div>

          {/* Working Days & Weekly Off Policy */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 sm:p-8 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Working Days & Weekly Off Policy</h3>
                  <p className="text-xs text-slate-500">Defines standard weekly working days for monthly salary and attendance expectations</p>
                </div>
              </div>
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 self-start sm:self-auto">
                Payroll Standard
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => setSettings({ ...settings, workWeekPattern: '6_DAYS' })}
                className={`p-5 rounded-2xl border text-left transition-all ${
                  settings.workWeekPattern === '6_DAYS'
                    ? 'bg-teal-50/90 border-teal-600 ring-2 ring-teal-500/20 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-bold text-slate-900">6-Day Working Week</span>
                  {settings.workWeekPattern === '6_DAYS' && (
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  )}
                </div>
                <p className="text-xs text-slate-500">Monday to Saturday duty (Sundays are off). Standard company schedule.</p>
              </button>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, workWeekPattern: '5_DAYS' })}
                className={`p-5 rounded-2xl border text-left transition-all ${
                  settings.workWeekPattern === '5_DAYS'
                    ? 'bg-teal-50/90 border-teal-600 ring-2 ring-teal-500/20 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-bold text-slate-900">5-Day Working Week</span>
                  {settings.workWeekPattern === '5_DAYS' && (
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  )}
                </div>
                <p className="text-xs text-slate-500">Monday to Friday duty (Saturdays & Sundays are off).</p>
              </button>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, workWeekPattern: 'ALTERNATE_SATURDAYS' })}
                className={`p-5 rounded-2xl border text-left transition-all ${
                  settings.workWeekPattern === 'ALTERNATE_SATURDAYS'
                    ? 'bg-teal-50/90 border-teal-600 ring-2 ring-teal-500/20 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-bold text-slate-900">Alternate Saturdays</span>
                  {settings.workWeekPattern === 'ALTERNATE_SATURDAYS' && (
                    <CheckCircle2 className="w-4 h-4 text-teal-600" />
                  )}
                </div>
                <p className="text-xs text-slate-500">2nd & 4th Saturdays + All Sundays off. 1st, 3rd & 5th Saturdays working.</p>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Shift Settings'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: OFFICE LOCATION & GEOFENCE */}
      {activeTab === 'GEOFENCE' && (
        <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold shadow-xs">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Office Location & Geofence Coordinates
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-200/80">
                      Google Maps Enabled
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Set office coordinates via Google Maps or device GPS. WFO employees must be within this perimeter to check in.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${settings.officeLocation.latitude},${settings.officeLocation.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  title="View current office pin in Google Maps"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                  <span>Open Maps</span>
                </a>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  disabled={detectingLocation}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-xs active:scale-95 shrink-0"
                  title="Auto-detect coordinates using device GPS"
                >
                  <Navigation className={`w-3.5 h-3.5 text-teal-100 ${detectingLocation ? 'animate-spin' : ''}`} />
                  {detectingLocation ? 'Detecting GPS...' : 'Auto-Fill Current GPS'}
                </button>
              </div>
            </div>

            {/* Geofence Enforcement Toggle */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
              settings.geofenceEnabled ? 'bg-emerald-50/70 border-emerald-200/80' : 'bg-amber-50/70 border-amber-200/80'
            }`}>
              <div>
                <p className="text-sm font-bold text-slate-900">Enforce Geofence on Sign-In</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {settings.geofenceEnabled
                    ? 'WFO/SSC employees must be within the office radius below to sign in.'
                    : 'Geofence is OFF — employees can sign in from any location, regardless of distance from the office.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, geofenceEnabled: !prev.geofenceEnabled }))}
                className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${
                  settings.geofenceEnabled ? 'bg-teal-600' : 'bg-slate-300'
                }`}
                title={settings.geofenceEnabled ? 'Click to disable geofence enforcement' : 'Click to enable geofence enforcement'}
              >
                <span
                  className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    settings.geofenceEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Google Maps Quick Link / Coordinates Importer */}
            <div className="p-4 bg-teal-50/70 rounded-2xl border border-teal-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-teal-600" />
                  Paste Google Maps Link or Coordinates:
                </label>
                <span className="text-[10px] font-semibold text-teal-700 bg-white/80 px-2 py-0.5 rounded-full border border-teal-200">
                  Auto-extracts Latitude & Longitude
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={googleMapsInput}
                  onChange={(e) => handleParseGoogleMaps(e.target.value)}
                  placeholder="e.g. https://maps.google.com/?q=13.0456,80.2345 or 13.0456, 80.2345"
                  className="w-full px-3.5 py-2.5 text-xs bg-white rounded-xl border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-slate-800 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => handleParseGoogleMaps(googleMapsInput)}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl whitespace-nowrap transition-colors shadow-xs"
                >
                  Apply
                </button>
              </div>
              <p className="text-[11px] text-teal-800/80">
                💡 <strong>Tip:</strong> Open your office location in Google Maps, right-click on the building, copy the coordinates, and paste here!
              </p>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Office Name / Address Label</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={settings.officeLocation.address}
                    onChange={(e) => setSettings({
                      ...settings,
                      officeLocation: { ...settings.officeLocation, address: e.target.value }
                    })}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-medium text-slate-800"
                    placeholder="e.g. Shero HQ, Anna Nagar, Chennai"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Displayed to employees during geofence verification.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Latitude</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Compass className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={settings.officeLocation.latitude}
                    onChange={(e) => setSettings({
                      ...settings,
                      officeLocation: { ...settings.officeLocation, latitude: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono font-bold text-slate-800"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Center coordinate latitude.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Longitude</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Compass className="w-4 h-4" />
                  </div>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={settings.officeLocation.longitude}
                    onChange={(e) => setSettings({
                      ...settings,
                      officeLocation: { ...settings.officeLocation, longitude: parseFloat(e.target.value) || 0 }
                    })}
                    className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono font-bold text-slate-800"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Center coordinate longitude.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Perimeter Radius</label>
                <div className="relative">
                  <input
                    type="number"
                    min="50"
                    max="5000"
                    step="10"
                    required
                    value={settings.officeLocation.radiusMeters}
                    onChange={(e) => setSettings({
                      ...settings,
                      officeLocation: { ...settings.officeLocation, radiusMeters: parseInt(e.target.value) || 100 }
                    })}
                    className="w-full pl-3.5 pr-16 py-2.5 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 font-mono font-bold text-slate-800"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                    <span className="text-xs text-slate-400 font-medium">meters</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Distance allowance from center (e.g. 500m).</p>
              </div>

              <div className="sm:col-span-3 flex items-center">
                <div className="w-full bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-800">Policy Rules:</span>
                    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-500 text-[11px]">
                      <li><strong className="text-teal-700">WFO Employees:</strong> Blocked from punching in if outside the {settings.officeLocation.radiusMeters}m office radius.</li>
                      <li><strong className="text-indigo-700">WFH Employees:</strong> Can punch in from any location without geofencing restrictions.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Google Map Interactive View */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-teal-600" />
                  Live Google Maps Location Preview:
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {settings.officeLocation.latitude.toFixed(4)}, {settings.officeLocation.longitude.toFixed(4)}
                </span>
              </div>
              <div className="w-full h-80 rounded-2xl overflow-hidden border border-slate-200 shadow-xs bg-slate-100 relative">
                <iframe
                  title="Google Map Office Location"
                  width="100%"
                  height="100%"
                  className="w-full h-full border-0"
                  loading="lazy"
                  src={`https://maps.google.com/maps?q=${settings.officeLocation.latitude},${settings.officeLocation.longitude}&z=16&output=embed`}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Office Coordinates'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: COMPANY WFH SCHEDULE */}
      {activeTab === 'WFH' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold shadow-xs">
                  <Home className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Company-Wide Work From Home (WFH) Schedule
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200/80">
                      Remote Policy
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Declare specific dates when all employees work remotely (e.g. Wednesday & Saturday WFH). Office GPS geofencing is automatically waived on these dates.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setBulkWfhModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Bulk Add Recurring WFH</span>
                </button>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                  {wfhDaysList.length} Scheduled
                </span>
              </div>
            </div>

            {/* Add WFH Day Form */}
            <form onSubmit={handleAddWfhDay} className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                Add Specific Company WFH Date
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={wfhDayForm.date}
                    onChange={(e) => setWfhDayForm({ ...wfhDayForm, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-medium bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WFH Title / Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Wednesday Team WFH, Saturday Remote"
                    value={wfhDayForm.title}
                    onChange={(e) => setWfhDayForm({ ...wfhDayForm, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-medium bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Optional Notes / Remarks</label>
                  <input
                    type="text"
                    placeholder="e.g. Office maintenance / Routine remote day"
                    value={wfhDayForm.description}
                    onChange={(e) => setWfhDayForm({ ...wfhDayForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-medium bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submittingWfhDay}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-60"
                >
                  {submittingWfhDay ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Add WFH Day</span>
                </button>
              </div>
            </form>

            {/* WFH Days List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Scheduled Company WFH Dates ({wfhDaysList.length})
              </h3>

              {loadingWfhDays ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2" />
                  Loading scheduled WFH days...
                </div>
              ) : wfhDaysList.length === 0 ? (
                <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 px-4">
                  No company-wide WFH days added yet. Use the form above to declare remote days for specific dates or bulk generate weekly recurring WFH days (e.g. Wednesdays & Saturdays).
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200/80 rounded-2xl max-h-[460px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3">Scheduled Date</th>
                        <th className="px-4 py-3">Day of Week</th>
                        <th className="px-4 py-3">Title / Reason</th>
                        <th className="px-4 py-3">Notes</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {sortedWfhDaysList.map((w) => {
                        const dateObj = new Date(w.date + 'T00:00:00');
                        const formattedDate = dateObj.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });
                        const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                        return (
                          <tr key={w._id || w.date} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3.5 font-mono font-bold text-slate-900">{formattedDate}</td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                                dayName === 'Wednesday' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                dayName === 'Saturday' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                dayName === 'Friday' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                🏢+🏠 {dayName}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 font-bold text-slate-800">{w.title}</td>
                            <td className="px-4 py-3.5 text-slate-500">{w.description || 'Entire company works remotely'}</td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteWfhDay(w._id || w.date)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete WFH day"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: COMPANY HOLIDAYS CALENDAR */}
      {activeTab === 'HOLIDAYS' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Company Holidays Calendar</h2>
                  <p className="text-xs text-slate-500">Configure official declared holidays for all employees and monthly payroll rosters</p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Bulk Add Holidays</span>
                </button>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200">
                  {holidays.length} Holidays
                </span>
              </div>
            </div>

            {/* Add Holiday Form */}
            <form onSubmit={handleAddHoliday} className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-teal-600" />
                Add New Company Holiday
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Holiday Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Diwali, Republic Day"
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-medium bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-medium bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Holiday Type</label>
                  <select
                    value={holidayForm.type}
                    onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-medium bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  >
                    <option value="FESTIVAL">Festival Holiday</option>
                    <option value="NATIONAL">National Holiday</option>
                    <option value="COMPANY">Company Specific Holiday</option>
                    <option value="OPTIONAL">Optional / Restricted</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Remarks</label>
                  <input
                    type="text"
                    placeholder="Optional notes"
                    value={holidayForm.description}
                    onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-xs font-medium bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submittingHoliday}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-60"
                >
                  {submittingHoliday ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Add Holiday</span>
                </button>
              </div>
            </form>

            {/* Holidays List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Scheduled Holidays ({holidays.length})
              </h3>

              {loadingHolidays ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <div className="w-6 h-6 border-2 border-teal-500/20 border-t-teal-600 rounded-full animate-spin mx-auto mb-2" />
                  Loading holidays list...
                </div>
              ) : holidays.length === 0 ? (
                <div className="py-10 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 px-4">
                  No company holidays added yet. Use the form above to add holidays to the roster.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200/80 rounded-2xl max-h-[460px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3">Holiday Name</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Notes</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {sortedHolidaysList.map((h) => {
                        const formattedDate = new Date(h.date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        });
                        return (
                          <tr key={h._id || h.date} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3.5 font-bold text-slate-900">{h.name}</td>
                            <td className="px-4 py-3.5 font-mono text-slate-700">{formattedDate}</td>
                            <td className="px-4 py-3.5">
                              <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full border ${
                                h.type === 'NATIONAL' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                h.type === 'COMPANY' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                h.type === 'OPTIONAL' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                                {h.type || 'FESTIVAL'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500">{h.description || '-'}</td>
                            <td className="px-4 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteHoliday(h._id)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete holiday"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DEPARTMENTS */}
      {activeTab === 'DEPARTMENTS' && (
        <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold shadow-xs">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Department Management
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-200/80">
                      {(settings.departments || DEFAULT_DEPARTMENTS).length} Active
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Manage business units & departments available when registering and profiling employees.
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Add Department Input */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                <Plus className="w-4 h-4 text-teal-600" />
                Add New Department
              </label>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={newDepartmentInput}
                  onChange={(e) => setNewDepartmentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddDepartment();
                    }
                  }}
                  placeholder="e.g. DST, TECH, HR, OGB, KOB, Accounts, Finance, Compliance, Operations..."
                  className="flex-1 px-3.5 py-2.5 text-xs bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-800 font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleAddDepartment()}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Department</span>
                </button>
              </div>
            </div>

            {/* Department Chips Cloud */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Configured Departments List
              </label>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {(settings.departments || DEFAULT_DEPARTMENTS).map((dept) => (
                  <div
                    key={dept}
                    className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold hover:border-teal-300 hover:bg-teal-50/50 transition-all shadow-2xs"
                  >
                    <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                    <span>{dept}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteDepartment(dept)}
                      className="ml-1 p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      title={`Remove ${dept}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 pt-1">
                Click &quot;Save Departments&quot; below to permanently apply any additions or removals.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Changes...' : 'Save Departments'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Bulk Add WFH Modal with Interactive Calendar Selection */}
      {bulkWfhModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 sm:p-7 border border-slate-100 animate-slide-up space-y-5 my-8 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Home className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulk Generate WFH Days</h3>
                  <p className="text-xs text-slate-500">Select multiple days on the interactive calendar or auto-generate recurring rules</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkWfhModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex rounded-2xl bg-slate-100 p-1 shrink-0">
              <button
                type="button"
                onClick={() => setBulkWfhTab('CALENDAR')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                  bulkWfhTab === 'CALENDAR'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Select Days on Calendar</span>
                {selectedWfhDates.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold animate-pulse">
                    {selectedWfhDates.length} selected
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setBulkWfhTab('RULES')}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                  bulkWfhTab === 'RULES'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Auto-Generate Yearly Rules</span>
              </button>
            </div>

            {/* Tab 1: Interactive Multi-Date Calendar Selection */}
            {bulkWfhTab === 'CALENDAR' && (
              <form onSubmit={handleBulkSubmitCalendarWfhDays} className="space-y-4 overflow-y-auto pr-1 flex-1">
                {/* Calendar Month Navigation & Quick Filters */}
                <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/80 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrevWfhMonth}
                        className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-2xs"
                        title="Previous Month"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-bold text-slate-900 min-w-36 text-center">
                        {wfhCalendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextWfhMonth}
                        className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-2xs"
                        title="Next Month"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick day-of-week selection chips */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-slate-400 font-semibold mr-1">Quick Select:</span>
                      <button
                        type="button"
                        onClick={handleQuickSelectWedAndSat}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 transition-colors"
                      >
                        Wed & Sat
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickSelectDayOfWeek(3)}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-colors"
                      >
                        Wednesdays
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickSelectDayOfWeek(6)}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-colors"
                      >
                        Saturdays
                      </button>
                      <button
                        type="button"
                        onClick={() => handleQuickSelectDayOfWeek(5)}
                        className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 font-semibold border border-slate-200 transition-colors"
                      >
                        Fridays
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid View */}
                  <div>
                    {/* Day Headers (Mon - Sun) */}
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400 pb-1">
                      <span>Mon</span>
                      <span>Tue</span>
                      <span className="text-indigo-600">Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                      <span className="text-purple-600">Sat</span>
                      <span className="text-rose-500">Sun</span>
                    </div>

                    {/* Date Cells */}
                    <div className="grid grid-cols-7 gap-1 text-xs">
                      {calendarDays.map((cell, idx) => {
                        if (!cell) {
                          return <div key={`empty-${idx}`} className="h-10 rounded-xl bg-transparent" />;
                        }

                        const { dayNum, dateStr, dayOfWeek, isScheduled, isSelected } = cell;
                        const isWeekend = dayOfWeek === 0;

                        return (
                          <button
                            key={dateStr}
                            type="button"
                            onClick={() => handleToggleCalendarDate(dateStr)}
                            className={`h-10 rounded-xl text-xs font-bold transition-all relative flex flex-col items-center justify-center ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-400'
                                : isScheduled
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-100'
                                : isWeekend
                                ? 'bg-slate-100/60 text-slate-400 hover:bg-slate-200/60'
                                : 'bg-white text-slate-700 border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/40'
                            }`}
                          >
                            <span>{dayNum}</span>
                            {isScheduled && !isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-0.5" />
                            )}
                            {isSelected && (
                              <Check className="w-3 h-3 text-white absolute top-1 right-1" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Bulk Title & Notes Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      WFH Event Title
                    </label>
                    <input
                      type="text"
                      required
                      value={bulkCustomTitle}
                      onChange={(e) => setBulkCustomTitle(e.target.value)}
                      placeholder="e.g. Wednesday & Saturday WFH"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Notes / Description
                    </label>
                    <input
                      type="text"
                      value={bulkCustomDesc}
                      onChange={(e) => setBulkCustomDesc(e.target.value)}
                      placeholder="e.g. Scheduled team remote day"
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="bg-indigo-50/80 p-3 rounded-xl border border-indigo-200/70 flex items-center justify-between text-xs text-indigo-900">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>{selectedWfhDates.length} dates selected for addition</span>
                  </div>
                  {selectedWfhDates.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedWfhDates([])}
                      className="text-[11px] font-bold text-rose-600 hover:underline"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setBulkWfhModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBulkWfh || selectedWfhDates.length === 0}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {submittingBulkWfh ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Save {selectedWfhDates.length} WFH Days</span>
                  </button>
                </div>
              </form>
            )}

            {/* Tab 2: Auto-Generate Yearly Rules */}
            {bulkWfhTab === 'RULES' && (
              <form onSubmit={handleBulkAddWfhDays} className="space-y-4 overflow-y-auto pr-1 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Year</label>
                  <select
                    value={bulkWfhYear}
                    onChange={(e) => setBulkWfhYear(parseInt(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value={2025}>2025</option>
                    <option value={2026}>2026 (Current Year)</option>
                    <option value={2027}>2027</option>
                    <option value={2028}>2028</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Remote Policy Schedule</label>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      bulkWfhRule === 'WEDNESDAYS_AND_SATURDAYS' ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 font-semibold' : 'bg-slate-50/50 border-slate-200 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="bulkWfhRule"
                        value="WEDNESDAYS_AND_SATURDAYS"
                        checked={bulkWfhRule === 'WEDNESDAYS_AND_SATURDAYS'}
                        onChange={() => setBulkWfhRule('WEDNESDAYS_AND_SATURDAYS')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-xs">
                        <p className="font-bold">Every Wednesday & Saturday (104 Days)</p>
                        <p className="text-[11px] text-slate-500">Marks all Wednesdays and Saturdays of {bulkWfhYear} as Company Remote WFH</p>
                      </div>
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      bulkWfhRule === 'WEDNESDAYS' ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 font-semibold' : 'bg-slate-50/50 border-slate-200 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="bulkWfhRule"
                        value="WEDNESDAYS"
                        checked={bulkWfhRule === 'WEDNESDAYS'}
                        onChange={() => setBulkWfhRule('WEDNESDAYS')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-xs">
                        <p className="font-bold">Every Wednesday (52 Days)</p>
                        <p className="text-[11px] text-slate-500">Marks all Wednesdays of {bulkWfhYear} as Company Remote WFH</p>
                      </div>
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      bulkWfhRule === 'SATURDAYS' ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 font-semibold' : 'bg-slate-50/50 border-slate-200 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="bulkWfhRule"
                        value="SATURDAYS"
                        checked={bulkWfhRule === 'SATURDAYS'}
                        onChange={() => setBulkWfhRule('SATURDAYS')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-xs">
                        <p className="font-bold">Every Saturday (52 Days)</p>
                        <p className="text-[11px] text-slate-500">Marks all Saturdays of {bulkWfhYear} as Company Remote WFH</p>
                      </div>
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      bulkWfhRule === 'FRIDAYS' ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 font-semibold' : 'bg-slate-50/50 border-slate-200 text-slate-700'
                    }`}>
                      <input
                        type="radio"
                        name="bulkWfhRule"
                        value="FRIDAYS"
                        checked={bulkWfhRule === 'FRIDAYS'}
                        onChange={() => setBulkWfhRule('FRIDAYS')}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="text-xs">
                        <p className="font-bold">Every Friday (52 Days)</p>
                        <p className="text-[11px] text-slate-500">Marks all Fridays of {bulkWfhYear} as Friday Remote WFH</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-200/70 flex items-start gap-2 text-xs text-indigo-900">
                  <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <span>Existing scheduled dates will not be duplicated. Only new dates will be created.</span>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setBulkWfhModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingBulkWfh}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {submittingBulkWfh ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>Generate WFH Schedule</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Bulk Add Holidays Modal */}
      {bulkModalOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-100 animate-slide-up space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Bulk Add Holidays</h3>
                  <p className="text-xs text-slate-500">Generate recurring off days or import from Excel</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/70">
              <button
                type="button"
                onClick={() => setBulkModalTab('RULE')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  bulkModalTab === 'RULE' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Recurring Rule
              </button>
              <button
                type="button"
                onClick={() => setBulkModalTab('EXCEL')}
                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  bulkModalTab === 'EXCEL' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Upload Excel
              </button>
            </div>

            {bulkModalTab === 'EXCEL' ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={handleDownloadHolidaySample}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Sample Template
                </button>

                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-teal-400 rounded-2xl p-6 cursor-pointer transition-colors bg-slate-50/50">
                  <UploadCloud className="w-6 h-6 text-teal-600" />
                  <span className="text-xs font-semibold text-slate-700">
                    {holidayExcelFileName || 'Click to upload .xlsx, .xls or .csv'}
                  </span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    className="hidden"
                    onChange={handleHolidayExcelUpload}
                  />
                </label>

                {holidayExcelRows.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600" />
                        {holidayExcelRows.filter((r) => r.isValid).length} valid / {holidayExcelRows.length} rows
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                      {holidayExcelRows.map((r) => (
                        <div key={r.id} className="px-3 py-2 flex items-center justify-between text-[11px]">
                          <div>
                            <p className="font-bold text-slate-800">{r.name || '(no name)'}</p>
                            <p className="text-slate-400">{r.date || '(no date)'} • {r.type}</p>
                          </div>
                          {r.isValid ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <span className="flex items-center gap-1 text-rose-600 shrink-0" title={r.errors.join(', ')}>
                              <AlertTriangle className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setBulkModalOpen(false); setHolidayExcelRows([]); setHolidayExcelFileName(''); }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImportHolidayExcel}
                    disabled={importingHolidayExcel || holidayExcelRows.filter((r) => r.isValid).length === 0}
                    className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {importingHolidayExcel ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <UploadCloud className="w-3.5 h-3.5" />
                    )}
                    <span>Import Holidays</span>
                  </button>
                </div>
              </div>
            ) : (
            <form onSubmit={handleBulkAddHolidays} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Target Year</label>
                <select
                  value={bulkYear}
                  onChange={(e) => setBulkYear(parseInt(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-xs font-semibold bg-white rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026 (Current Year)</option>
                  <option value={2027}>2027</option>
                  <option value={2028}>2028</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Recurring Rule</label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    bulkRule === 'SUNDAYS' ? 'bg-teal-50/70 border-teal-300 text-teal-900 font-semibold' : 'bg-slate-50/50 border-slate-200 text-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="bulkRule"
                      value="SUNDAYS"
                      checked={bulkRule === 'SUNDAYS'}
                      onChange={() => setBulkRule('SUNDAYS')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <div className="text-xs">
                      <p className="font-bold">All Sundays (52 Sundays)</p>
                      <p className="text-[11px] text-slate-500">Marks all Sundays of {bulkYear} as Sunday Weekly Off</p>
                    </div>
                  </label>

                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    bulkRule === 'SATURDAYS_2_4' ? 'bg-teal-50/70 border-teal-300 text-teal-900 font-semibold' : 'bg-slate-50/50 border-slate-200 text-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="bulkRule"
                      value="SATURDAYS_2_4"
                      checked={bulkRule === 'SATURDAYS_2_4'}
                      onChange={() => setBulkRule('SATURDAYS_2_4')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <div className="text-xs">
                      <p className="font-bold">2nd & 4th Saturdays</p>
                      <p className="text-[11px] text-slate-500">Marks 2nd and 4th Saturday of each month as official off</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/70 flex items-start gap-2 text-xs text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>Existing holiday dates will not be duplicated. Only new dates will be created.</span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBulk}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {submittingBulk ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Generate Holidays</span>
                </button>
              </div>
            </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminSettings;

import React, { useState } from 'react';
import { Calendar, User, Phone, Laptop, AlertTriangle, MapPin, AlignLeft, Send, Sparkles, RefreshCw } from 'lucide-react';
import { ServiceJob, DeviceType, UrgencyLevel, LocationCoords } from '../types.ts';
import { MAP_CENTER_YANGON } from '../utils.ts';

const GeminiIcon = ({ className = "h-5 w-5", flat = false }: { className?: string; flat?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2C12 2 12.5 7.5 14 9C15.5 10.5 21 11 21 11C21 11 15.5 11.5 14 13C12.5 14.5 12 20 12 20C12 20 11.5 14.5 10 13C8.5 11.5 3 11 3 11C3 11 8.5 10.5 10 9C11.5 7.5 12 2 12 2Z" fill={flat ? "currentColor" : "url(#gemini-gradient-form)"} />
    <path d="M19 16C19 16 19.25 18.75 20 19.5C20.75 20.25 23.5 20.5 23.5 20.5C23.5 20.5 20.75 20.75 20 21.5C19.25 22.25 19 25 19 25C19 25 18.75 22.25 18 21.5C17.25 20.75 14.5 20.5 14.5 20.5C14.5 20.5 17.25 20.75 18 19.5C18.75 18.75 19 16 19 16Z" fill={flat ? "currentColor" : "url(#gemini-gradient-form)"} />
    {!flat && (
      <defs>
        <linearGradient id="gemini-gradient-form" x1="3" y1="2" x2="23.5" y2="25" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4e70e6" />
          <stop offset="0.5" stopColor="#9452e6" />
          <stop offset="1" stopColor="#e252a1" />
        </linearGradient>
      </defs>
    )}
  </svg>
);

interface JobFormProps {
  onSubmit: (job: Omit<ServiceJob, 'id' | 'status' | 'createdAt' | 'updatedAt'> & { editReason?: string; deviceModel?: string }) => void;
  onCancel?: () => void;
  initialData?: ServiceJob;
  isEditMode?: boolean;
}

const ISSUE_PRESETS = [
  {
    title: 'Battery / Power System',
    type: 'Laptop' as DeviceType,
    issue: 'Laptop battery draining within 5 minutes. Charging port is shaky (USB-C wiggle needed). Battery diagnostic check and likely power cord replacement.',
  },
  {
    title: 'Slow Desktop HDD Upgrade',
    type: 'Desktop' as DeviceType,
    issue: 'Computer takes over 3 minutes to boot up. Programs hang constantly. Customer wants to upgrade from old 1TB HDD to a fast 512GB NVMe M.2 SSD and clone the OS.',
  },
  {
    title: 'Printer Paper Jam / Smudge',
    type: 'Printer' as DeviceType,
    issue: 'Canon laser printer showing E03 paper jam error continuously, and ink is smudged on the left border of every printed document. Needs rollers cleaned/serviced.',
  },
];

export default function JobForm({ onSubmit, onCancel, initialData, isEditMode = false }: JobFormProps) {
  const [customerName, setCustomerName] = useState(initialData?.customerName || '');
  const [customerPhone, setCustomerPhone] = useState(initialData?.customerPhone || '');
  
  // Parse date and time from initialData if any
  const parsedDate = initialData?.dateTime ? initialData.dateTime.split('T')[0] : '';
  const parsedTime = initialData?.dateTime 
    ? (initialData.dateTime.includes('none') ? 'none' : initialData.dateTime.split('T')[1]?.substring(0, 5) || 'none')
    : 'none';

  // Modern segmented Date/Time states constrained between 10:00 AM & 4:00 PM
  const todayStr = (() => {
    try {
      return new Date().toISOString().split('T')[0];
    } catch {
      return '2026-06-08';
    }
  })();
  const [selectedDate, setSelectedDate] = useState(parsedDate || todayStr);
  const [selectedTime, setSelectedTime] = useState(parsedTime);

  const [locationText, setLocationText] = useState(initialData?.locationText || '');
  const [locationCoords, setLocationCoords] = useState<LocationCoords>(initialData?.locationCoords || MAP_CENTER_YANGON);
  const [deviceType, setDeviceType] = useState<DeviceType>(initialData?.deviceType || 'Laptop');
  const [deviceModel, setDeviceModel] = useState(initialData?.deviceModel || '');
  const [deviceIssue, setDeviceIssue] = useState(initialData?.deviceIssue || '');
  const [urgency, setUrgency] = useState<UrgencyLevel>(initialData?.urgency || 'Medium');

  const [editReason, setEditReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Autofill states
  const [rawText, setRawText] = useState('');
  const [isAiCollatorOpen, setIsAiCollatorOpen] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiError, setAiError] = useState('');

  // Auto-extract using Gemini
  const handleAiAutofill = async () => {
    if (!rawText.trim()) {
      setAiError('Please enter some text for AI to fill the fields...');
      return;
    }

    setIsAiParsing(true);
    setAiError('');

    try {
      const referenceDate = selectedDate || new Date().toISOString().split('T')[0];

      const res = await fetch('/api/parse-ticket', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rawText, referenceDate }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'AI Auto-extraction failed');
      }

      const data = await res.json();
      
      if (data.customerName) setCustomerName(data.customerName);
      if (data.customerPhone) setCustomerPhone(data.customerPhone);
      if (data.deviceType) setDeviceType(data.deviceType);
      if (data.deviceIssue) setDeviceIssue(data.deviceIssue);
      if (data.locationText) setLocationText(data.locationText);
      if (data.urgency) setUrgency(data.urgency);
      if (data.selectedDate) setSelectedDate(data.selectedDate);
      if (data.selectedTime) setSelectedTime(data.selectedTime);

      setIsAiCollatorOpen(false);
      setRawText('');
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'AI auto-fill failed. Please verify the prompt and try again.');
    } finally {
      setIsAiParsing(false);
    }
  };

  // Triggered when clicking a preset to auto-populate fields for speed-testing
  const handleApplyPreset = (preset: typeof ISSUE_PRESETS[0]) => {
    setDeviceType(preset.type);
    setDeviceIssue(preset.issue);
    setUrgency('High');
  };

  // Helper to get day name from selectedDate
  const getDayName = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      // Avoid time zone shifts by using the exact year, month, day components
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!year || !month || !day) return '';
      const dateObj = new Date(year, month - 1, day);
      if (isNaN(dateObj.getTime())) return '';
      return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(dateObj);
    } catch {
      return '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!customerName.trim() || !customerPhone.trim() || !selectedDate || !selectedTime || !locationText.trim() || !deviceIssue.trim()) {
      alert('Please fill out all the required fields and place of service!');
      return;
    }

    if (isEditMode && !editReason.trim()) {
      alert('Please specify/select a reason for editing.');
      return;
    }

    setIsSubmitting(true);
    const combinedDateTime = `${selectedDate}T${selectedTime}`;

    onSubmit({
      customerName,
      customerPhone,
      dateTime: combinedDateTime,
      locationText,
      locationCoords,
      deviceType,
      deviceModel,
      deviceIssue,
      urgency,
      ...(isEditMode && { editReason }),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" id="service-job-form">
      <div className="space-y-5 bg-white/5 p-5 rounded-xl border border-white/10 shadow-lg">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h3 className="font-semibold text-teal-300 text-sm">Service Ticket Details</h3>
            <p className="text-xs text-slate-400">Please provide precise customer & device details.</p>
          </div>
        </div>

        {/* AI Auto-fill Modal Trigger */}
        <button
          type="button"
          onClick={() => {
            setIsAiCollatorOpen(true);
            setAiError('');
          }}
          className="w-full bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-cyan-500/10 border border-teal-500/20 hover:border-teal-500/40 rounded-xl p-3.5 flex items-center justify-center gap-2 group cursor-pointer focus:outline-none transition-all shadow-xs"
        >
          <GeminiIcon className="h-5 w-5 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold text-teal-300 uppercase tracking-wide group-hover:text-teal-200 transition-colors">Auto Fill</span>
        </button>

        {/* Customer Name */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5" htmlFor="customer-name">
            <User className="h-3.5 w-3.5 text-slate-400" /> Customer Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="customer-name"
            placeholder=""
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-black/40 focus:ring-1 focus:ring-teal-500 transition-all font-sans"
            required
            title=""
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Item Type */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5" htmlFor="item-type">
            <Laptop className="h-3.5 w-3.5 text-slate-400" /> Item Type <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            id="item-type"
            placeholder="e.g. Laptop, Printer, CCTV, AC, Refrigerator, Mobile"
            value={deviceType}
            onChange={(e) => setDeviceType(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-black/40 focus:ring-1 focus:ring-teal-500 transition-all font-sans"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Phone */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5" htmlFor="customer-phone">
              <Phone className="h-3.5 w-3.5 text-slate-400" /> Phone Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="tel"
              id="customer-phone"
              placeholder="e.g. 09-xxxxxxxxx"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-black/40 focus:ring-1 focus:ring-teal-500 transition-all font-sans"
              required
            />
          </div>

          {/* Modern Date Picker */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between gap-1.5" htmlFor="appointment-date">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Appointment Date <span className="text-rose-500">*</span>
              </span>
              {selectedDate && (
                <span className="text-[10px] text-teal-300 font-bold bg-teal-500/15 px-2.5 py-0.5 rounded-full select-none" id="selected-date-day-name">
                  {getDayName(selectedDate)}
                </span>
              )}
            </label>
            <input
              type="date"
              id="appointment-date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-black/40 focus:ring-1 focus:ring-teal-500 transition-all font-semibold cursor-pointer"
              required
            />
          </div>
        </div>

        {/* Modern Time Selector (10am - 4pm restriction) */}
        <div className="space-y-2 text-left" id="modern-appointment-time-picker">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5" htmlFor="appointment-time-select">
              <Calendar className="h-3.5 w-3.5 text-slate-400" /> Time Slot <span className="text-slate-455 text-[10px] font-normal font-sans ml-1">(Optional)</span>
            </label>
          </div>
          
          <div className="relative">
            <select
              id="appointment-time-select"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-black/40 focus:ring-1 focus:ring-teal-500 transition-all font-semibold cursor-pointer block appearance-none pr-10"
            >
              <option value="none">None / Unspecified (Optional)</option>
              <option value="10:00">10:00 AM</option>
              <option value="11:00">11:00 AM</option>
              <option value="12:00">12:00 PM</option>
              <option value="13:00">1:00 PM</option>
              <option value="14:00">2:00 PM</option>
              <option value="15:00">3:00 PM</option>
              <option value="16:00">4:00 PM</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-400">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Urgency Level */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-slate-400" /> Job Urgency Range
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(['Low', 'Medium', 'High', 'Critical'] as UrgencyLevel[]).map((level) => {
              const activeClasses =
                urgency === level
                  ? level === 'Low'
                    ? 'border-slate-500 bg-white/15 text-slate-200 font-bold shadow-[0_0_10px_rgba(255,255,255,0.05)]'
                    : level === 'Medium'
                      ? 'border-teal-500 bg-teal-500/20 text-teal-300 font-bold shadow-[0_0_10px_rgba(20,184,166,0.1)]'
                      : level === 'High'
                        ? 'border-amber-500 bg-amber-500/20 text-amber-300 font-bold shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                        : 'border-rose-500 bg-rose-500/20 text-rose-300 font-bold shadow-[0_0_10px_rgba(239,68,68,0.1)]'
                  : 'border-white/5 bg-white/5 text-slate-400 hover:bg-white/10';

              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setUrgency(level)}
                  className={`py-2 px-1 text-xs rounded-xl border text-center transition-all duration-150 cursor-pointer ${activeClasses}`}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Description */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5" htmlFor="device-issue">
            <AlignLeft className="h-3.5 w-3.5 text-slate-400" /> Device Problem Description <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="device-issue"
            rows={3}
            placeholder="Provide a detailed log of the problems..."
            value={deviceIssue}
            onChange={(e) => setDeviceIssue(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-black/40 focus:ring-1 focus:ring-teal-500 transition-all leading-relaxed"
            required
          />
        </div>

        {/* Location Text (Physical Address) */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5" htmlFor="location-text">
            <MapPin className="h-3.5 w-3.5 text-slate-400" /> Physical Address <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="location-text"
            rows={2}
            placeholder="e.g. Hlaing Road, Kamayut, Yangon"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            className="w-full bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-black/40 focus:ring-1 focus:ring-teal-500 transition-all leading-relaxed"
            required
          />
        </div>

        {/* Reason for Edit (Only shown when editing) */}
        {isEditMode && (
          <div className="space-y-2 bg-amber-500/5 p-4 rounded-xl border border-amber-500/25 text-left animate-fade-in">
            <label htmlFor="edit-reason-input" className="text-xs font-bold text-amber-300 block">
              Reason for Editing <span className="text-rose-500">*</span>
            </label>
            
            <div className="flex flex-col gap-1.5">
              {[
                'Customer requested details update',
                'Correction of typo or spelling error',
                'Rescheduled appointment or assignment shift',
                'Updated diagnostic details or issue description'
              ].map((option) => {
                const isSelected = editReason === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setEditReason(option)}
                    className={`text-[11px] text-left px-3 py-1.5 rounded-lg border font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-semibold shadow-xs'
                        : 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              id="edit-reason-input"
              placeholder="Or type a custom edit reason..."
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 text-white placeholder-slate-500 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans mt-1"
              required
            />
          </div>
        )}
      </div>

      {/* Actions Frame */}
      <div className="border-t border-white/5 pt-5 flex items-center justify-end gap-3 shrink-0 select-none">
        {onCancel && (
          <button
            type="button"
            id="btn-cancel-job-creation"
            onClick={onCancel}
            className="py-2.5 px-4.5 border border-white/10 text-xs font-semibold rounded-xl text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition-all"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          id="btn-submit-service-job"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 py-2.5 px-5 bg-teal-600 hover:bg-teal-700 disabled:opacity-70 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl cursor-pointer transition-all border border-teal-500/20"
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> {isEditMode ? 'Updating...' : 'Dispatching...'}
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" /> {isEditMode ? 'Update Ticket' : 'Dispatch Job'}
            </>
          )}
        </button>
      </div>

      {/* Gemini AI Auto-fill Pop-up Modal */}
      {isAiCollatorOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          {/* Backdrop Click */}
          <div className="absolute inset-0" onClick={() => !isAiParsing && setIsAiCollatorOpen(false)} />
          
          <div className="relative bg-[#050e12]/95 backdrop-blur-xl w-full max-w-lg rounded-2xl shadow-2xl border border-white/10 overflow-hidden transform scale-100 transition-all max-h-[90vh] flex flex-col z-10 text-slate-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 bg-white/5">
              <div className="flex items-center gap-2">
                <GeminiIcon className="h-5 w-5" />
                <span className="text-xs font-bold text-teal-300 uppercase tracking-wide">AI auto fill</span>
              </div>
              <button
                type="button"
                onClick={() => !isAiParsing && setIsAiCollatorOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-all cursor-pointer"
                disabled={isAiParsing}
              >
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              <p className="text-xs text-slate-400 leading-relaxed">
                Paste unstructured customer message or ticket details here to auto-fill the form.
              </p>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste customer message or ticket details here..."
                rows={6}
                className="w-full bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-xs rounded-xl p-3.5 focus:outline-none focus:bg-black/40 focus:ring-1 focus:ring-teal-500 font-sans leading-relaxed text-slate-100"
                disabled={isAiParsing}
              />
              
              {aiError && (
                <p className="text-[10px] font-semibold text-rose-300 bg-rose-500/15 border border-rose-500/20 rounded-xl p-3 flex items-start gap-1.5 leading-relaxed">
                  <span className="text-xs">⚠️</span> {aiError}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-white/5 bg-white/5 flex items-center justify-end gap-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setRawText('');
                  setAiError('');
                  setIsAiCollatorOpen(false);
                }}
                className="text-xs font-semibold text-slate-400 hover:text-white px-4 py-2 hover:bg-white/5 rounded-xl cursor-pointer transition-colors"
                disabled={isAiParsing}
              >
                Cancel
              </button>
              {rawText && (
                <button
                  type="button"
                  onClick={() => {
                    setRawText('');
                    setAiError('');
                  }}
                  className="text-xs font-semibold text-rose-300 hover:text-rose-200 px-4 py-2 hover:bg-rose-500/15 rounded-xl cursor-pointer transition-colors"
                  disabled={isAiParsing}
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={handleAiAutofill}
                disabled={isAiParsing}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-xl cursor-pointer disabled:opacity-50 transition-all font-sans shadow-xs"
              >
                {isAiParsing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <GeminiIcon className="h-4 w-4 text-white" flat={true} />
                    Auto Fill Form
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

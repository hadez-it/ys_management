import React, { useState } from 'react';
import { Calendar, User, Phone, Laptop, AlertTriangle, MapPin, AlignLeft, Send, Sparkles, RefreshCw } from 'lucide-react';
import { ServiceJob, DeviceType, UrgencyLevel, LocationCoords } from '../types.ts';
import { MAP_CENTER_YANGON } from '../utils.ts';

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
  const parsedTime = initialData?.dateTime ? initialData.dateTime.split('T')[1]?.substring(0, 5) : '10:00';

  // Modern segmented Date/Time states constrained between 10:00 AM & 4:00 PM
  const todayStr = (() => {
    try {
      return new Date().toISOString().split('T')[0];
    } catch {
      return '2026-06-08';
    }
  })();
  const [selectedDate, setSelectedDate] = useState(parsedDate || todayStr);
  const [selectedTime, setSelectedTime] = useState(parsedTime || '10:00');

  const [locationText, setLocationText] = useState(initialData?.locationText || '');
  const [locationCoords, setLocationCoords] = useState<LocationCoords>(initialData?.locationCoords || MAP_CENTER_YANGON);
  const [deviceType, setDeviceType] = useState<DeviceType>(initialData?.deviceType || 'Laptop');
  const [deviceModel, setDeviceModel] = useState(initialData?.deviceModel || '');
  const [deviceIssue, setDeviceIssue] = useState(initialData?.deviceIssue || '');
  const [urgency, setUrgency] = useState<UrgencyLevel>(initialData?.urgency || 'Medium');

  const [editReason, setEditReason] = useState('');

  // Triggered when clicking a preset to auto-populate fields for speed-testing
  const handleApplyPreset = (preset: typeof ISSUE_PRESETS[0]) => {
    setDeviceType(preset.type);
    setDeviceIssue(preset.issue);
    setUrgency('High');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !selectedDate || !selectedTime || !locationText.trim() || !deviceIssue.trim()) {
      alert('Please fill out all the required fields and place of service!');
      return;
    }

    if (isEditMode && !editReason.trim()) {
      alert('Please specify/select a reason for editing.');
      return;
    }

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
      <div className="space-y-5 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-50 pb-4">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Service Ticket Details</h3>
            <p className="text-xs text-gray-400">Please provide precise customer & device details.</p>
          </div>
          
          {/* Quick Demo Assist Button */}
          <div className="dropdown relative group">
            <button
              type="button"
              id="btn-auto-presets"
              className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 font-semibold py-1.5 px-3 rounded-lg hover:bg-blue-100 transition-all cursor-pointer"
            >
              <Sparkles className="h-3 w-3" /> Auto Presets
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-gray-100 rounded-lg shadow-lg p-1.5 hidden group-hover:block z-15">
              <p className="text-[10px] text-gray-400 font-semibold px-2 pb-1 border-b border-gray-50 select-none">Quick Test Case:</p>
              {ISSUE_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="w-full text-left p-1.5 text-xs text-gray-600 hover:text-blue-700 hover:bg-blue-50/50 rounded transition-all"
                >
                  ⚡ {p.title}
                </button>
              ))}
            </div>
          </div>
        </div>

          {/* Customer Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5" htmlFor="customer-name">
              <User className="h-3.5 w-3.5 text-gray-400" /> Customer Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="customer-name"
              placeholder="e.g. Ko Phyo, Daw Su"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-sans"
              required
            />
          </div>

          {/* Device Selection */}
          <div className="space-y-1.5 bg-gray-50/40 p-3 rounded-xl border border-gray-100/50">
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Laptop className="h-3.5 w-3.5 text-gray-400" /> Device Specific Classification
            </label>
            <div className="grid grid-cols-5 gap-1 pt-1">
              {(['Laptop', 'Desktop', 'Printer', 'Networking', 'Other'] as DeviceType[]).map((type) => {
                const isActive = deviceType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDeviceType(type)}
                    className={`py-1.5 text-[10px] rounded-lg border text-center font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-100 bg-white text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
            
            <input
              type="text"
              placeholder="Model / Hardware Reference (e.g. MacBook Pro M3, Asus ROG, Epson L3210)"
              value={deviceModel}
              onChange={(e) => setDeviceModel(e.target.value)}
              className="w-full bg-white border border-gray-150 text-xs rounded-xl py-2 px-3 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans mt-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Phone */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5" htmlFor="customer-phone">
                <Phone className="h-3.5 w-3.5 text-gray-400" /> Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                id="customer-phone"
                placeholder="e.g. 09-xxxxxxxxx"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                required
              />
            </div>

            {/* Modern Date Picker */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5" htmlFor="appointment-date">
                <Calendar className="h-3.5 w-3.5 text-gray-400" /> Appointment Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                id="appointment-date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all text-gray-700 font-semibold cursor-pointer"
                required
              />
            </div>
          </div>

          {/* Modern Time Selector (10am - 4pm restriction) */}
          <div className="space-y-2 text-left" id="modern-appointment-time-picker">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-gray-400" /> Time Slot <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-100 font-mono">
                10:00 AM - 4:00 PM Only
              </span>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: '10:00', label: '10:00 AM' },
                { value: '11:00', label: '11:00 AM' },
                { value: '12:00', label: '12:00 PM' },
                { value: '13:00', label: '1:00 PM' },
                { value: '14:00', label: '2:00 PM' },
                { value: '15:00', label: '3:00 PM' },
                { value: '16:00', label: '4:00 PM' },
              ].map((slot) => {
                const isActive = selectedTime === slot.value;
                return (
                  <button
                    key={slot.value}
                    type="button"
                    onClick={() => setSelectedTime(slot.value)}
                    className={`py-2 px-1 text-[11px] rounded-xl border text-center transition-all duration-150 cursor-pointer font-medium font-sans ${
                      isActive
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold shadow-xs scale-102'
                        : 'border-gray-100 bg-gray-50/50 hover:bg-gray-100/70 text-gray-500'
                    }`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Urgency Level */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-gray-400" /> Job Urgency Range
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['Low', 'Medium', 'High', 'Critical'] as UrgencyLevel[]).map((level) => {
                const activeClasses =
                  urgency === level
                    ? level === 'Low'
                      ? 'border-gray-505 bg-gray-100 text-gray-750 font-bold'
                      : level === 'Medium'
                        ? 'border-blue-505 bg-blue-50 text-blue-700 font-bold'
                        : level === 'High'
                          ? 'border-amber-505 bg-amber-50 text-amber-700 font-bold'
                          : 'border-rose-505 bg-rose-50 text-rose-700 font-bold'
                    : 'border-gray-100 bg-gray-50/50 text-gray-400 hover:bg-gray-100/50';

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
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5" htmlFor="device-issue">
              <AlignLeft className="h-3.5 w-3.5 text-gray-400" /> Device Problem Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="device-issue"
              rows={3}
              placeholder="Provide a detailed log of the problems..."
              value={deviceIssue}
              onChange={(e) => setDeviceIssue(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all leading-relaxed"
              required
            />
          </div>

          {/* Location Text (Physical Address) */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5" htmlFor="location-text">
              <MapPin className="h-3.5 w-3.5 text-gray-400" /> Physical Address <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="location-text"
              rows={2}
              placeholder="e.g. Hlaing Road, Kamayut, Yangon"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all leading-relaxed"
              required
            />
          </div>

          {/* Reason for Edit (Only shown when editing) */}
          {isEditMode && (
            <div className="space-y-2 bg-amber-50/50 p-4 rounded-xl border border-amber-100/40 text-left animate-fade-in">
              <label htmlFor="edit-reason-input" className="text-xs font-bold text-amber-955 block">
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
                          ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold shadow-xs'
                          : 'bg-white border-gray-100 hover:bg-gray-50 text-gray-700'
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
                className="w-full bg-white border border-gray-150 rounded-xl py-2 px-3 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans mt-1"
                required
              />
            </div>
          )}
        </div>

        {/* Actions Frame */}
        <div className="border-t border-gray-100 pt-5 flex items-center justify-end gap-3 shrink-0 select-none">
          {onCancel && (
            <button
              type="button"
              id="btn-cancel-job-creation"
              onClick={onCancel}
              className="py-2.5 px-4.5 border border-gray-150 text-xs font-semibold rounded-xl text-gray-500 hover:text-gray-800 hover:bg-gray-50 cursor-pointer transition-all"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            id="btn-submit-service-job"
            className="inline-flex items-center gap-2 py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl cursor-pointer transition-all"
          >
            <Send className="h-3.5 w-3.5" /> {isEditMode ? 'Update Ticket' : 'Dispatch Job'}
          </button>
        </div>
    </form>
  );
}

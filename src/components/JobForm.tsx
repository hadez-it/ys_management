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

          {/* Item Type */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5" htmlFor="item-type">
              <Laptop className="h-3.5 w-3.5 text-gray-400" /> Item Type <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              id="item-type"
              placeholder="e.g. Laptop, Printer, CCTV, AC, Refrigerator, Mobile"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all font-sans"
              required
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
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5" htmlFor="appointment-time-select">
                <Calendar className="h-3.5 w-3.5 text-gray-400" /> Time Slot <span className="text-gray-400 text-[10px] font-normal font-sans ml-1">(Optional)</span>
              </label>
              <span className="text-[10px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-100 font-mono">
                10:00 AM - 4:00 PM Only
              </span>
            </div>
            
            <div className="relative">
              <select
                id="appointment-time-select"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-full bg-gray-50 border border-gray-100 text-sm rounded-xl py-2 px-3.5 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all text-gray-700 font-semibold cursor-pointer block appearance-none pr-10"
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
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-gray-500">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
              </div>
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

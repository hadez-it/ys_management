import React, { useState } from 'react';
import {
  Printer,
  Plus,
  Trash2,
  FileSpreadsheet,
  Coins,
  CheckCircle,
  FileCheck,
  ChevronLeft,
  X,
  CreditCard,
  Percent,
  Sparkles
} from 'lucide-react';
import { ServiceJob, InvoiceItem, Invoice, InvoiceItem as InvoiceItemType } from '../types.ts';
import { formatMMK, formatDateTime } from '../utils.ts';

interface InvoiceGeneratorProps {
  job: ServiceJob;
  onSaveInvoice: (invoice: Omit<Invoice, 'id' | 'createdTime'>) => void;
  onCancel: () => void;
}

const DEFAULT_LINE_RECOMMENDATIONS: Record<string, { desc: string; price: number }[]> = {
  Laptop: [
    { desc: 'SSD Upgrade & Data Transfer Service (512GB NVMe)', price: 95050 },
    { desc: 'Laptop Internal Thermal Clean & Thermal Paste Application', price: 20000 },
    { desc: 'Liquid Damage On-board Circuit Repair & IC Replacement', price: 150000 },
    { desc: 'On-site Diagnosis & Home Visit Fee', price: 15000 },
  ],
  Desktop: [
    { desc: 'Custom Desktop Assembly & Cable Management Service', price: 30000 },
    { desc: 'Power Supply Unit Replacement (650W Corsair 80+)', price: 75000 },
    { desc: 'Windows Operating System Optimization & Driver Setup', price: 15000 },
    { desc: 'On-site Network Adapter Setup', price: 25005 },
  ],
  Printer: [
    { desc: 'Laser Multi-function Printer Toner Cartridge Refill', price: 30000 },
    { desc: 'Primary Charge Roller / Pickup Roller Replacement', price: 25000 },
    { desc: 'Paper Jam Mechanism Align & Roller Cleaning', price: 20000 },
  ],
  Networking: [
    { desc: 'On-site Office Router Configurations & Firewall Setup', price: 40000 },
    { desc: 'Shielded Cat6 Ethernet Cable Crimping & Trunking (Per Run)', price: 12000 },
    { desc: 'Wi-Fi Mesh Repeater Expansion & Channel Tuning', price: 35000 },
  ],
  Other: [
    { desc: 'Diagnostic Bench Service Fee', price: 15000 },
    { desc: 'General Soldering and Connector Repairs', price: 20000 },
  ],
};

export default function InvoiceGenerator({ job, onSaveInvoice, onCancel }: InvoiceGeneratorProps) {
  const [items, setItems] = useState<InvoiceItem[]>(() => {
    // Propose an initial item based on the user's repair logs to save typing
    const recommendations = DEFAULT_LINE_RECOMMENDATIONS[job.deviceType] || DEFAULT_LINE_RECOMMENDATIONS.Other;
    const itemsList: InvoiceItem[] = [];
    
    // Auto-create diagnostic line
    itemsList.push({
      id: 'dt-1',
      description: job.diagnosedProblem ? `Repair Action: ${job.resolutionNotes || job.diagnosedProblem}` : recommendations[0].desc,
      quantity: 1,
      unitPrice: recommendations[0].price,
      amount: recommendations[0].price,
    });

    // Add home visit diagnostic charge as a 2nd recommendation
    const visitRecommendation = DEFAULT_LINE_RECOMMENDATIONS.Laptop.find(i => i.desc.includes('Home Visit'));
    if (visitRecommendation) {
      itemsList.push({
        id: 'dt-2',
        description: visitRecommendation.desc,
        quantity: 1,
        unitPrice: visitRecommendation.price,
        amount: visitRecommendation.price,
      });
    }

    return itemsList;
  });

  const [discount, setDiscount] = useState<number>(5000); // 5,000 Ks standard loyalty promo
  const [taxPercent, setTaxPercent] = useState<number>(5); // 5% commercial tax
  const [paymentStatus, setPaymentStatus] = useState<Invoice['paymentStatus']>('Paid');
  const [paymentMethod, setPaymentMethod] = useState<Invoice['paymentMethod']>('KBZPay');
  const [notes, setNotes] = useState<string>('Repairs completed. Standard 3 months warranty covers the replaced parts. Completed by ' + (job.technicianName || 'Our technician') + '.');
  const [activeMobileTab, setActiveMobileTab] = useState<'form' | 'preview'>('form');

  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemPrice, setNewItemPrice] = useState(0);

  // Math summaries
  const subtotal = items.reduce((acc, curr) => acc + curr.amount, 0);
  const taxAmount = Math.round((subtotal * taxPercent) / 100);
  const total = Math.max(0, subtotal + taxAmount - discount);

  const handleAddItem = () => {
    if (!newItemDesc.trim() || newItemQty <= 0 || newItemPrice < 0) {
      alert('Please fill out descriptions, valid units and price!');
      return;
    }
    const id = 'line-item-' + Date.now();
    const item: InvoiceItem = {
      id,
      description: newItemDesc,
      quantity: newItemQty,
      unitPrice: newItemPrice,
      amount: newItemQty * newItemPrice,
    };
    setItems([...items, item]);
    setNewItemDesc('');
    setNewItemQty(1);
    setNewItemPrice(0);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleApplyQuickRec = (rec: { desc: string; price: number }) => {
    const id = 'line-item-rec-' + Date.now();
    setItems([
      ...items,
      {
        id,
        description: rec.desc,
        quantity: 1,
        unitPrice: rec.price,
        amount: rec.price,
      },
    ]);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Please add at least one billed line item to issue this invoice!');
      return;
    }
    onSaveInvoice({
      jobId: job.id,
      customerName: job.customerName,
      customerPhone: job.customerPhone,
      dateTime: new Date().toISOString().substring(0, 16), // current timestamp
      items,
      subtotal,
      tax: taxAmount,
      discount,
      total,
      paymentStatus,
      paymentMethod,
      notes,
    });
  };

  return (
    <div className="space-y-4" id="invoice-creation-wizard">
      {/* Mobile-only layout toggle strip */}
      <div className="flex xl:hidden border border-white/10 p-1 bg-[#0b1c24] rounded-2xl text-xs font-bold leading-none select-none">
        <button
          type="button"
          onClick={() => setActiveMobileTab('form')}
          className={`flex-1 py-2.5 text-center rounded-xl transition-all ${
            activeMobileTab === 'form'
              ? 'bg-teal-600 text-white shadow-sm font-extrabold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          📝 Edit Billing Details
        </button>
        <button
          type="button"
          onClick={() => setActiveMobileTab('preview')}
          className={`flex-1 py-2.5 text-center rounded-xl transition-all ${
            activeMobileTab === 'preview'
              ? 'bg-teal-600 text-white shadow-sm font-extrabold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          🧾 Draft Receipt ({items.length})
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* LEFT: Configure items and parameters (7 Cols) */}
        <div className={`xl:col-span-7 bg-[#050e12] border border-white/10 rounded-3xl p-6 shadow-sm space-y-6 text-left text-slate-100 ${
          activeMobileTab === 'preview' ? 'hidden xl:block' : 'block'
        }`}>
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            <button
              type="button"
              id="back-btn-invoice-cancel"
              onClick={onCancel}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Billing & Invoice Creator</h3>
              <p className="text-xs text-slate-400">Generate invoice receipt for {job.customerName}</p>
            </div>
          </div>

          {/* Quick presets generator based on device type */}
          <div className="p-4 bg-teal-500/10 border border-teal-500/20 rounded-2xl relative overflow-hidden">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-400">
              <Sparkles className="h-4 w-4" /> Recommended Services based on {job.deviceType}
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {(DEFAULT_LINE_RECOMMENDATIONS[job.deviceType] || []).map((rec, id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleApplyQuickRec(rec)}
                  className="bg-[#0b1c24] border border-teal-500/20 hover:border-teal-400 py-1.5 px-3 rounded-lg text-xs font-medium cursor-pointer transition-all hover:bg-teal-500/15 shadow-sm flex items-center gap-1 text-slate-200"
                >
                  <Plus className="h-3 w-3 text-teal-400" /> {rec.desc.split(' & ')[0]} ({formatMMK(rec.price)})
                </button>
              ))}
            </div>
          </div>

          {/* Invoice Items Table Form */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Line Items Billed</h4>
            
            {/* Desktop View (Table) */}
            <div className="hidden sm:block border border-white/10 rounded-2xl overflow-hidden shadow-inner max-h-52 overflow-y-auto bg-[#0b1c24]/30" id="added-billing-table">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#0b1c24] text-slate-300 font-semibold border-b border-white/10">
                  <tr>
                    <th className="p-3">Service / Part Description</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Total</th>
                    <th className="p-3 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5">
                      <td className="p-3 font-medium text-slate-200 leading-relaxed max-w-xs">{item.description}</td>
                      <td className="p-3 text-center text-slate-300">{item.quantity}</td>
                      <td className="p-3 text-right text-slate-300">{formatMMK(item.unitPrice)}</td>
                      <td className="p-3 text-right font-bold text-slate-100">{formatMMK(item.amount)}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          id={`btn-remove-line-${item.id}`}
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-400 hover:text-rose-400 p-1 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                        No line items added yet. Please use the form below to add parts or services manually.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="block sm:hidden space-y-2.5 max-h-60 overflow-y-auto">
              {items.map((item) => (
                <div key={item.id} className="p-3.5 bg-[#0b1c24] border border-white/10 rounded-2xl flex items-start gap-3 relative">
                  <div className="flex-1 min-w-0 pr-8 text-left">
                    <p className="font-semibold text-slate-200 text-xs leading-snug break-words">{item.description}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                      Qty: {item.quantity} x {formatMMK(item.unitPrice)}
                    </p>
                    <p className="text-xs font-bold text-teal-400 mt-1 font-mono">
                      Amount: {formatMMK(item.amount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    id={`btn-remove-line-mob-${item.id}`}
                    onClick={() => handleRemoveItem(item.id)}
                    className="absolute top-2.5 right-2 text-slate-400 hover:text-rose-400 p-1.5 rounded-lg active:bg-rose-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <div className="py-8 text-center text-slate-400 italic text-xs">
                  No billed items added yet. Use form below to add.
                </div>
              )}
            </div>

            {/* Add Item form */}
            <div className="bg-[#0b1c24] p-4 rounded-2xl border border-white/10 flex flex-col gap-3">
              <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">Add Part or Service Manually</h5>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    id="add-item-description"
                    placeholder="e.g. Keyboard Replacement Unit, GPU stress tests..."
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    className="w-full bg-[#11252e] border border-white/10 py-2.5 px-3 text-xs rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-500 text-slate-100 placeholder-slate-500"
                  />
                </div>
                <div className="grid grid-cols-6 sm:col-span-6 gap-3">
                  <div className="col-span-2 sm:col-span-2">
                    <input
                      type="number"
                      id="add-item-qty"
                      min="1"
                      placeholder="Qty"
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-[#11252e] border border-white/10 py-2.5 px-3 text-xs rounded-xl text-center focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold text-slate-100"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-3">
                    <input
                      type="number"
                      id="add-item-price"
                      min="0"
                      placeholder="Price (Ks)"
                      value={newItemPrice === 0 ? '' : newItemPrice}
                      onChange={(e) => setNewItemPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full bg-[#11252e] border border-white/10 py-2.5 px-3 text-xs text-right focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono text-slate-100"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-1 flex items-center justify-center">
                    <button
                      type="button"
                      id="btn-add-item-to-list"
                      onClick={handleAddItem}
                      className="h-full min-h-[38px] max-h-[42px] bg-teal-600 hover:bg-teal-700 text-white rounded-xl cursor-pointer transition-colors w-full flex items-center justify-center"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice and Payment Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Discounts & Taxes</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Percent className="h-3 w-3 text-teal-400" /> Commercial Tax (%)
                  </label>
                  <input
                    type="number"
                    id="tax-percent-input"
                    min="0"
                    max="100"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-[#0b1c24] border border-white/10 py-2.5 px-3 rounded-xl text-xs focus:outline-none focus:bg-[#11252e] text-slate-100 font-semibold font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Coins className="h-3 w-3 text-teal-400" /> Discount (Ks)
                  </label>
                  <input
                    type="number"
                    id="discount-input"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-[#0b1c24] border border-white/10 py-2.5 px-3 rounded-xl text-xs focus:outline-none focus:bg-[#11252e] text-slate-100 font-semibold font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Settlement Ledger</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Payment Method</label>
                  <select
                    id="payment-method-select"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as Invoice['paymentMethod'])}
                    className="w-full bg-[#0b1c24] border border-white/10 py-2.5 px-3 rounded-xl text-xs focus:outline-none focus:bg-[#11252e] text-slate-100 font-semibold"
                  >
                    <option value="KBZPay" className="bg-[#050e12] text-slate-100">KBZPay / KPay</option>
                    <option value="WavePay" className="bg-[#050e12] text-slate-100">WavePay</option>
                    <option value="CBPay" className="bg-[#050e12] text-slate-100">CBPay</option>
                    <option value="Cash" className="bg-[#050e12] text-slate-100">Cash</option>
                    <option value="Bank Transfer" className="bg-[#050e12] text-slate-100">AYA / KBZ Bank</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Order Status</label>
                  <select
                    id="payment-status-select"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as Invoice['paymentStatus'])}
                    className="w-full bg-[#0b1c24] border border-white/10 py-2.5 px-3 rounded-xl text-xs focus:outline-none focus:bg-[#11252e] text-slate-100 font-semibold"
                  >
                    <option value="Paid" className="bg-[#050e12] text-emerald-400">🟢 Settled / Paid</option>
                    <option value="Unpaid" className="bg-[#050e12] text-rose-400">🔴 Unpaid Account</option>
                    <option value="Partially Paid" className="bg-[#050e12] text-amber-400">🟡 Partial Settled</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Description / Terms */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase">Settlement Notes & Warranty Statement</label>
            <textarea
              id="notes-billing"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#0b1c24] border border-white/10 text-xs rounded-xl py-2 px-3 focus:outline-none focus:bg-[#11252e] leading-relaxed text-slate-300"
            />
          </div>

          {/* Mobile action bar for the form tab */}
          <div className="xl:hidden flex items-center justify-between gap-3 pt-6 border-t border-white/10">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 px-4 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-xl text-xs font-semibold cursor-pointer text-center"
            >
              Cancel
            </button>
            
            <button
              type="button"
              onClick={() => setActiveMobileTab('preview')}
              className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer text-center active:scale-95 transition-all"
            >
              Preview Draft &rarr;
            </button>
          </div>
        </div>

        {/* RIGHT: Breathtaking visual receipt representation (5 Cols) */}
        <div className={`xl:col-span-5 space-y-6 ${
          activeMobileTab === 'form' ? 'hidden xl:block' : 'block'
        }`}>
          {/* Printable/Preview receipt container */}
          <div className="bg-[#0b1c24] border-2 border-dashed border-white/10 rounded-3xl p-6 text-left space-y-6 relative overflow-hidden shadow-lg select-none text-slate-100" id="invoice-receipt-piston">
            {/* Top company label */}
            <div className="text-center space-y-1 border-b border-white/10 pb-5">
              <div className="flex items-center justify-center gap-1.5 font-bold text-slate-100 font-sans tracking-tight text-base">
                <span className="bg-teal-600 text-white rounded p-1 w-6 h-6 flex items-center justify-center text-xs font-black">Y</span>
                YS Service Center
              </div>
              <p className="text-[9px] text-slate-400 font-medium">Computers, Network Diagnostics & Board Repairs</p>
              <p className="text-[8px] text-slate-500 leading-none">Pyay Road, Sanchaung, Yangon, Myanmar</p>
            </div>

            {/* Invoice identifiers */}
            <div className="flex justify-between items-start text-xs border-b border-white/10 pb-4">
              <div className="space-y-1">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Billed To</p>
                <p className="font-bold text-slate-200 leading-none">{job.customerName}</p>
                <p className="text-slate-400 font-mono text-[10px] mt-1">{job.customerPhone}</p>
              </div>
              
              <div className="text-right space-y-1">
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Receipt No.</p>
                <p className="font-bold text-teal-400 font-mono leading-none">INV-(DRAFT)</p>
                <p className="text-slate-400 text-[10px] pr-0.5 mt-1">{new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Yangon' })}</p>
              </div>
            </div>

            {/* Core Table */}
            <div className="space-y-3">
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Services List</p>
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-xs text-left gap-4">
                    <div className="flex-1">
                      <p className="font-medium text-slate-200 leading-snug">{item.description}</p>
                      <p className="text-[10px] text-slate-400">Qty: {item.quantity} × {formatMMK(item.unitPrice)}</p>
                    </div>
                    <span className="font-bold text-slate-100 shrink-0 font-mono">{formatMMK(item.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mathematics settlement */}
            <div className="border-t border-white/10 pt-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400 font-medium">
                <span>Subtotal:</span>
                <span className="font-mono">{formatMMK(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400 font-medium">
                <span>Commercial Tax ({taxPercent}%):</span>
                <span className="font-mono">{formatMMK(taxAmount)}</span>
              </div>
              <div className="flex justify-between text-slate-400 font-medium text-rose-400">
                <span>Discounted Loyalty:</span>
                <span className="font-mono">-{formatMMK(discount)}</span>
              </div>
              
              <div className="flex justify-between border-t border-white/10 pt-3 text-base font-extrabold text-slate-100 border-b pb-1">
                <span>Grand Total:</span>
                <span className="text-teal-400 text-lg font-mono">{formatMMK(total)}</span>
              </div>
            </div>

            {/* Payment indicator footer */}
            <div className="bg-[#11252e] rounded-2xl p-3 flex justify-between items-center text-xs">
              <div>
                <p className="text-[9px] text-slate-400 font-bold uppercase">Cashpoint / Wallet</p>
                <p className="font-bold text-slate-200 flex items-center gap-1 mt-0.5">
                  <CreditCard className="h-3.5 w-3.5 text-teal-400" /> {paymentMethod}
                </p>
              </div>

              <div className="text-right">
                <span className={`inline-flex items-center text-[11px] font-bold py-1 px-2.5 rounded-lg border ${
                  paymentStatus === 'Paid'
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                    : paymentStatus === 'Unpaid'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                }`}>
                  {paymentStatus === 'Paid' ? 'PAID / SETTLED' : paymentStatus === 'Unpaid' ? 'UNPAID ACCOUNT' : 'PART PAID'}
                </span>
              </div>
            </div>

            {/* Print receipt footer greeting */}
            <div className="text-center font-sans space-y-1">
              <p className="text-[10px] font-semibold text-slate-300">Thank you for your business!</p>
              <p className="text-[8px] text-slate-500 leading-none">YS Service Center</p>
            </div>
          </div>

          {/* Floating actions */}
          <div className="bg-[#050e12] border border-white/10 rounded-2xl p-5 flex items-center justify-between shadow-sm">
            <button
              type="button"
              id="btn-invoice-cancel"
              onClick={onCancel}
              className="py-2.5 px-4 text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 rounded-xl transition-all cursor-pointer"
            >
              Cancel Creation
            </button>
            
            <button
              type="button"
              id="btn-confirm-save-invoice"
              onClick={handleFormSubmit}
              className="inline-flex items-center gap-1.5 py-2.5 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-md text-xs active:scale-95"
            >
              <CheckCircle className="h-4 w-4" /> Save & Issue Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

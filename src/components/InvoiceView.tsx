import React from 'react';
import { Printer, Compass, FileCheck, CheckCircle2, X } from 'lucide-react';
import { Invoice } from '../types.ts';
import { formatMMK, formatDateTime } from '../utils.ts';

interface InvoiceViewProps {
  invoice: Invoice;
  onClose: () => void;
}

export default function InvoiceView({ invoice, onClose }: InvoiceViewProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md flex items-start justify-center p-4 pt-4 sm:pt-4 z-50 animate-fade-in sm:items-center overflow-y-auto" id="invoice-view-modal">
      <div className="bg-[#050e12] rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] border border-white/10 transform transition-all duration-300 text-slate-100">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#0b1c24]">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
              Settle Paid Invoice
            </span>
          </div>
          <button
            type="button"
            id="close-invoice-modal-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Section */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 text-left space-y-6" id="printable-invoice-content">
          <div className="flex justify-between items-start flex-col sm:flex-row gap-4 border-b border-white/10 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-100 text-lg">
                <span className="bg-teal-600 text-white rounded p-1 w-7 h-7 flex items-center justify-center text-xs font-black">Y</span>
                YS SERVICE CENTER
              </div>
              <p className="text-[11px] text-slate-400">On-site Computer Diagnostics & Micro-soldering</p>
              <p className="text-[10px] text-slate-500 leading-normal">
                No. (45), Pyay Road, Sanchaung, Yangon<br />
                Call Center Support: 09-791234567, 09-451122334
              </p>
            </div>

            <div className="text-left sm:text-right space-y-1 w-full sm:w-auto">
              <h2 className="text-xl font-bold font-sans text-slate-100 tracking-tight">Receipt / Invoice</h2>
              <p className="text-xs text-slate-500">Invoice Ref Key:</p>
              <p className="text-xs font-bold font-mono text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md inline-block">
                {invoice.id}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">{formatDateTime(invoice.createdTime)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-b border-white/10 pb-5">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CLIENT INFO</p>
              <p className="font-bold text-slate-200 text-sm leading-tight">{invoice.customerName}</p>
              <p className="text-slate-400 font-medium font-mono">{invoice.customerPhone}</p>
            </div>
            
            <div className="text-left sm:text-right space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PAYMENT DETAILS</p>
              <p className="font-bold text-slate-200">
                Settled through: <strong className="text-teal-400 font-sans">{invoice.paymentMethod}</strong>
              </p>
              <p className="text-slate-400">Transaction Ref: Authorized Instant</p>
            </div>
          </div>

          {/* Responsive list of items */}
          <div className="space-y-2 text-xs">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">BILLED SERVICE LINE ITEMS</p>
            
            {/* Desktop View (Table) */}
            <div className="hidden sm:block border border-white/10 rounded-2xl overflow-x-auto shadow-inner bg-[#0b1c24]/50">
              <table className="w-full text-left">
                <thead className="bg-[#0b1c24] text-slate-300 font-semibold border-b border-white/10">
                  <tr>
                    <th className="p-3">Work Done / Diagnostics Description</th>
                    <th className="p-3 text-center w-12">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/5">
                      <td className="p-3 font-medium text-slate-200 leading-relaxed">{item.description}</td>
                      <td className="p-3 text-center text-slate-300">{item.quantity}</td>
                      <td className="p-3 text-right text-slate-300">{formatMMK(item.unitPrice)}</td>
                      <td className="p-3 text-right font-bold text-slate-100">{formatMMK(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View (Cards) */}
            <div className="block sm:hidden space-y-3">
              {invoice.items.map((item, idx) => (
                <div key={idx} className="p-4 bg-[#0b1c24] border border-white/10 rounded-2xl space-y-2 text-left">
                  <div className="font-semibold text-slate-200 leading-snug">{item.description}</div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5 text-slate-400">
                    <div>
                      <span>{item.quantity} x {formatMMK(item.unitPrice)}</span>
                    </div>
                    <div className="font-bold text-slate-200">
                      {formatMMK(item.amount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Math calculation totals */}
          <div className="border-t border-white/10 pt-4 space-y-2 text-xs text-right max-w-sm ml-auto">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span className="text-slate-250 font-mono">{formatMMK(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Commercial Tax (5% included):</span>
              <span className="text-slate-250 font-mono">{formatMMK(invoice.tax)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-rose-400 font-medium">
                <span>Loyalty Discount:</span>
                <span className="font-mono">-{formatMMK(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-white/10 pt-3 text-sm font-extrabold text-slate-100 leading-none">
              <span>Grand Settled Total:</span>
              <span className="text-xl text-teal-400 font-mono">{formatMMK(invoice.total)}</span>
            </div>
          </div>

          {/* Settle Note */}
          {invoice.notes && (
            <div className="p-4 bg-[#0b1c24] rounded-2xl text-xs text-slate-300 border border-white/10 whitespace-pre-wrap text-left">
              <strong className="text-slate-200">Service Notes / Warranty Terms:</strong><br />
              {invoice.notes}
            </div>
          )}

          {/* Stamp visual and signature section */}
          <div className="border-t border-white/10 pt-6 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              <div>
                <p className="font-bold text-slate-200">Payment Status: settling fully</p>
                <p className="text-[10px] text-slate-400">Paid and closed successfully in local register.</p>
              </div>
            </div>

            <div className="text-center font-sans space-y-1">
              <p className="text-[10px] font-bold text-slate-300 select-none">We appreciate your business!</p>
              <p className="text-[8px] text-slate-500">Thanks for choosing YS Service!</p>
            </div>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="p-5 border-t border-white/10 bg-[#0b1c24] flex justify-between gap-3 shrink-0">
          <button
            type="button"
            id="print-invoice-sys-btn"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-500/10 cursor-pointer active:scale-95 transition-all"
          >
            <Printer className="h-4 w-4" /> Print Receipt (PDF)
          </button>
          
          <button
            type="button"
            id="close-invoice-modal-btn"
            onClick={onClose}
            className="py-2 px-4 border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Close Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

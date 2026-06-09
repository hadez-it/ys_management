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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="invoice-view-modal">
      <div className="bg-white rounded-3xl overflow-hidden shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] border border-gray-150 transform transition-all duration-300">
        {/* Modal Header */}
        <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-md">
              Settle Paid Invoice (ပြည်တွင်းဘေလ်ရရှိပြီး)
            </span>
          </div>
          <button
            type="button"
            id="close-invoice-modal-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Section */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 text-left space-y-6" id="printable-invoice-content">
          <div className="flex justify-between items-start flex-wrap gap-4 border-b border-gray-100 pb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-gray-900 text-lg">
                <span className="bg-blue-600 text-white rounded p-1 w-7 h-7 flex items-center justify-center text-xs font-black">A</span>
                ANTIGRAVITY COMPUTER SERVICE
              </div>
              <p className="text-[11px] text-gray-400">On-site Computer Diagnostics & Micro-soldering</p>
              <p className="text-[10px] text-gray-500 leading-normal">
                No. (45), Pyay Road, Sanchaung, Yangon<br />
                Call Center Support: 09-791234567, 09-451122334
              </p>
            </div>

            <div className="text-right space-y-1">
              <h2 className="text-xl font-bold font-sans text-gray-800 tracking-tight">Receipt / Invoice</h2>
              <p className="text-xs text-gray-400">Invoice Ref Key:</p>
              <p className="text-xs font-bold font-mono text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-md inline-block">
                {invoice.id}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">{formatDateTime(invoice.createdTime)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-b border-gray-100 pb-5">
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">CLIENT INFO (လက်ခံသူ)</p>
              <p className="font-bold text-gray-800 text-sm leading-tight">{invoice.customerName}</p>
              <p className="text-gray-500 font-medium font-mono">{invoice.customerPhone}</p>
            </div>
            
            <div className="text-right space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PAYMENT DETAILS</p>
              <p className="font-bold text-gray-800">
                Settled through: <strong className="text-blue-600 font-sans">{invoice.paymentMethod}</strong>
              </p>
              <p className="text-gray-500">Transaction Ref: Authorized Instant</p>
            </div>
          </div>

          {/* Table list */}
          <div className="space-y-2 text-xs">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">BILLED SERVICE LINE ITEMS</p>
            <div className="border border-gray-100 rounded-2xl overflow-x-auto shadow-inner">
              <table className="w-full min-w-[460px] sm:min-w-0 text-left">
                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-100">
                  <tr>
                    <th className="p-3">Work Done / Diagnostics Description</th>
                    <th className="p-3 text-center w-12">Qty</th>
                    <th className="p-3 text-right">Unit Price</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/20">
                      <td className="p-3 font-medium text-gray-800 leading-relaxed">{item.description}</td>
                      <td className="p-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="p-3 text-right text-gray-600">{formatMMK(item.unitPrice)}</td>
                      <td className="p-3 text-right font-bold text-gray-800">{formatMMK(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Math calculation totals */}
          <div className="border-t border-gray-100 pt-4 space-y-2 text-xs text-right max-w-sm ml-auto">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal:</span>
              <span>{formatMMK(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Commercial Tax (5% included):</span>
              <span>{formatMMK(invoice.tax)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between text-rose-600 font-medium">
                <span>Loyalty Discount:</span>
                <span>-{formatMMK(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-100 pt-3 text-sm font-extrabold text-slate-900 leading-none">
              <span>Grand Settled Total:</span>
              <span className="text-xl text-blue-600">{formatMMK(invoice.total)}</span>
            </div>
          </div>

          {/* Settle Note */}
          {invoice.notes && (
            <div className="p-4 bg-gray-50 rounded-2xl text-xs text-gray-600 border border-gray-100 whitespace-pre-wrap text-left">
              <strong className="text-gray-700">Service Notes / Warranty Terms:</strong><br />
              {invoice.notes}
            </div>
          )}

          {/* Stamp visual and signature section */}
          <div className="border-t border-gray-100 pt-6 flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              <div>
                <p className="font-bold text-gray-800">Payment Status: settling fully</p>
                <p className="text-[10px] text-gray-400">Paid and closed successfully in local register.</p>
              </div>
            </div>

            <div className="text-center font-sans space-y-1">
              <p className="text-[10px] font-bold text-gray-700 select-none">လူကြီးမင်းအား အထူးကျေးဇူးတင်ရှိပါသည်၊၊</p>
              <p className="text-[8px] text-gray-400">Thanks for choosing Antigravity Service!</p>
            </div>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="p-5 border-t border-gray-150 bg-gray-50 flex justify-between gap-3 shrink-0">
          <button
            type="button"
            id="print-invoice-sys-btn"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/10 cursor-pointer active:scale-95 transition-all"
          >
            <Printer className="h-4 w-4" /> Print Receipt (PDF)
          </button>
          
          <button
            type="button"
            id="close-invoice-modal-btn"
            onClick={onClose}
            className="py-2 px-4 border border-gray-200 text-gray-500 hover:text-gray-800 hover:bg-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            Close Receipt
          </button>
        </div>
      </div>
    </div>
  );
}

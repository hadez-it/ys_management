import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  History, 
  PlusCircle, 
  Search, 
  Filter, 
  Calendar,
  Layers,
  ArrowRightLeft,
  X,
  Loader2,
  ChevronDown
} from 'lucide-react';
import { InventoryItem, InventoryLog, User } from '../types';

interface InventoryProps {
  currentUser: User;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  inventoryItems: InventoryItem[];
  inventoryLogs: InventoryLog[];
  inventoryCategories: string[];
  inventorySubTab: 'stock' | 'logs';
  setInventorySubTab: (tab: 'stock' | 'logs') => void;
  fetchInventoryData: () => void;
  inventoryLoading: boolean;
}

export default function Inventory({
  currentUser,
  authFetch,
  inventoryItems,
  inventoryLogs,
  inventoryCategories,
  inventorySubTab,
  setInventorySubTab,
  fetchInventoryData,
  inventoryLoading
}: InventoryProps) {
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [categoryInput, setCategoryInput] = useState('');
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState<number>(1);
  const [dateInput, setDateInput] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

  // Sync category input if a category is selected
  const handleSelectCategory = (cat: string) => {
    setCategoryInput(cat);
    setShowCategoryDropdown(false);
  };

  // Handle Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryInput.trim() || !itemName.trim() || qty <= 0) {
      setErrorMsg('All fields are required and quantity must be greater than 0.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    authFetch('/api/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        category: categoryInput.trim(),
        name: itemName.trim(),
        qty,
        date: dateInput
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to add item to inventory');
        }
        return data;
      })
      .then(() => {
        setSuccessMsg('Inventory item updated successfully!');
        setCategoryInput('');
        setItemName('');
        setQty(1);
        setDateInput(new Date().toISOString().split('T')[0]);
        fetchInventoryData();
        
        // Auto close modal after a brief success message
        setTimeout(() => {
          setIsModalOpen(false);
          setSuccessMsg('');
        }, 1500);
      })
      .catch((err) => {
        setErrorMsg(err.message || 'An error occurred while saving the inventory item.');
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  // Filtered items
  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategoryFilter === 'All' || item.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtered logs
  const filteredLogs = inventoryLogs.filter(log => {
    return log.itemName.toLowerCase().includes(searchQuery.toLowerCase()) || 
           log.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
           log.actionType.toLowerCase().includes(searchQuery.toLowerCase()) ||
           log.username.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Format date helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6 text-left" id="inventory-component-root">
      {/* Header section with Sub-tabs and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="bg-teal-500/10 border border-teal-500/20 p-2.5 rounded-2xl text-teal-400">
            <Package className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white font-display tracking-tight">Inventory Ledger</h2>
            <p className="text-xs text-slate-400 font-sans mt-0.5">Track and maintain shop parts, retail components, and repair stock levels.</p>
          </div>
        </div>

        {/* Desktop-visible sub-tab selection and Add item button */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="bg-slate-950/60 p-1.5 rounded-2xl border border-white/5 flex items-center">
            <button
              onClick={() => {
                setInventorySubTab('stock');
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                inventorySubTab === 'stock'
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Stock</span>
            </button>
            <button
              onClick={() => {
                setInventorySubTab('logs');
                setSearchQuery('');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                inventorySubTab === 'logs'
                  ? 'bg-teal-500/15 text-teal-300 border border-teal-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Logs</span>
            </button>
          </div>

          {inventorySubTab === 'stock' && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-gradient-to-tr from-teal-500 to-emerald-600 hover:from-teal-450 hover:to-emerald-550 text-white text-xs font-bold px-4 py-3.5 rounded-2xl flex items-center gap-2 shadow-md active:scale-97 transition-all shrink-0 cursor-pointer"
            >
              <PlusCircle className="h-4.5 w-4.5" />
              <span>Add Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Main filter, search and list block */}
      <div className="bg-slate-900/20 backdrop-blur-md border border-white/10 rounded-3xl p-6 shadow-xl">
        {/* Search & Filter Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder={inventorySubTab === 'stock' ? "Search stock items by name, category..." : "Search transaction logs by item, category, operator..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500/40 transition-colors"
            />
          </div>

          {inventorySubTab === 'stock' && (
            <div className="flex items-center gap-3">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <div className="relative inline-block w-full md:w-48">
                <select
                  value={selectedCategoryFilter}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-4 py-3 pr-8 text-xs text-slate-200 font-semibold focus:outline-none focus:border-teal-500/40 appearance-none cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {inventoryCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* LOADING INDICATOR */}
        {inventoryLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
            <p className="text-xs">Loading inventory registry details...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {/* STOCK VIEW */}
            {inventorySubTab === 'stock' && (
              <motion.div
                key="stock-tab-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="overflow-x-auto"
              >
                {filteredItems.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="mx-auto w-12 h-12 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-slate-500">
                      <Package className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-300">No items found</p>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">There are no inventory parts matched. Click on "Add Item" to add new parts to the ledger.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* DESKTOP TABLE VIEW */}
                    <table className="w-full text-slate-200 hidden md:table">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-left">
                          <th className="pb-3 pl-4">Item Name</th>
                          <th className="pb-3">Category</th>
                          <th className="pb-3">Quantity</th>
                          <th className="pb-3">Date Registered</th>
                          <th className="pb-3 pr-4 text-right">Last Updated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {filteredItems.map((item, index) => (
                          <motion.tr
                            key={item.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="hover:bg-white/2 transition-colors group"
                          >
                            <td className="py-4 pl-4 font-bold text-white pr-2">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-400/80" />
                                <span className="truncate max-w-[200px] sm:max-w-xs">{item.name}</span>
                              </div>
                            </td>
                            <td className="py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/15">
                                <Layers className="h-2.5 w-2.5" />
                                {item.category}
                              </span>
                            </td>
                            <td className="py-4 font-mono font-bold">
                              <span className={`px-2 py-0.5 rounded-md ${
                                item.qty < 5 
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' 
                                  : 'bg-slate-950/60 text-slate-300 border border-white/5'
                              }`}>
                                {item.qty} pcs
                              </span>
                            </td>
                            <td className="py-4 text-slate-400 font-sans">
                              {formatDate(item.date)}
                            </td>
                            <td className="py-4 pr-4 text-right text-slate-400 font-sans">
                              {formatDate(item.updatedAt)}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>

                    {/* MOBILE CARD GRID VIEW */}
                    <div className="grid grid-cols-1 gap-4 md:hidden pb-12">
                      {filteredItems.map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="bg-slate-950/40 border border-white/10 rounded-2xl p-4 space-y-3 shadow-lg"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1.5">
                              <h4 className="font-bold text-white text-sm leading-snug flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                                {item.name}
                              </h4>
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/15">
                                <Layers className="h-2.5 w-2.5" />
                                {item.category}
                              </span>
                            </div>
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold shrink-0 ${
                              item.qty < 5 
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' 
                                : 'bg-slate-950/60 text-slate-300 border border-white/5'
                            }`}>
                              {item.qty} pcs
                            </span>
                          </div>
                          
                          <div className="border-t border-white/5 pt-3 flex flex-col gap-1.5 text-[10px] text-slate-400 font-sans">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Registered Date:</span>
                              <span className="font-medium text-slate-300">{formatDate(item.date)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Last Updated:</span>
                              <span className="font-medium text-slate-300">{formatDate(item.updatedAt)}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {/* LOGS VIEW */}
            {inventorySubTab === 'logs' && (
              <motion.div
                key="logs-tab-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
                className="overflow-x-auto"
              >
                {filteredLogs.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="mx-auto w-12 h-12 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-center text-slate-500">
                      <History className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-300">No logs found</p>
                      <p className="text-xs text-slate-500 max-w-xs mx-auto">No inventory transactional logs found in database matching search criteria.</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* DESKTOP TABLE VIEW */}
                    <table className="w-full text-slate-200 hidden md:table">
                      <thead>
                        <tr className="border-b border-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-400 text-left">
                          <th className="pb-3 pl-4">Item Details</th>
                          <th className="pb-3">Action Type</th>
                          <th className="pb-3">Qty Impact</th>
                          <th className="pb-3">Operator</th>
                          <th className="pb-3">Log Date</th>
                          <th className="pb-3 pr-4 text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-xs">
                        {filteredLogs.map((log, index) => (
                          <motion.tr
                            key={log.id}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className="hover:bg-white/2 transition-colors"
                          >
                            <td className="py-4 pl-4 pr-2">
                              <div>
                                <p className="font-bold text-slate-100">{log.itemName}</p>
                                <span className="text-[10px] text-teal-400/80 font-semibold">{log.category}</span>
                              </div>
                            </td>
                            <td className="py-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                log.actionType === 'Add Item'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-teal-500/10 text-teal-350 border-teal-500/15'
                              }`}>
                                {log.actionType}
                              </span>
                            </td>
                            <td className="py-4 font-mono font-bold">
                              <span className={log.qty > 0 ? 'text-emerald-400' : 'text-slate-300'}>
                                +{log.qty} pcs
                              </span>
                            </td>
                            <td className="py-4 text-slate-300 font-sans font-medium">
                              @{log.username}
                            </td>
                            <td className="py-4 text-slate-400 font-sans">
                              {formatDate(log.date)}
                            </td>
                            <td className="py-4 pr-4 text-right text-slate-400 font-sans">
                              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>

                    {/* MOBILE CARD VIEW FOR LOGS */}
                    <div className="grid grid-cols-1 gap-4 md:hidden pb-12">
                      {filteredLogs.map((log, index) => (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.02 }}
                          className="bg-slate-950/40 border border-white/10 rounded-2xl p-4 space-y-3 shadow-lg text-xs"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <h4 className="font-bold text-white text-sm">{log.itemName}</h4>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-teal-400 font-semibold">{log.category}</span>
                                <span className="text-slate-600">•</span>
                                <span className="text-[10px] text-slate-400">@{log.username}</span>
                              </div>
                            </div>
                            <div className="text-right space-y-1.5 shrink-0">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                log.actionType === 'Add Item'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : 'bg-teal-500/10 text-teal-350 border-teal-500/15'
                              }`}>
                                {log.actionType}
                              </span>
                              <p className={`text-xs font-mono font-extrabold ${log.qty > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
                                +{log.qty} pcs
                              </p>
                            </div>
                          </div>
                          
                          <div className="border-t border-white/5 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-sans">
                            <span>Date: {formatDate(log.date)}</span>
                            <span>Time: {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* ADD INVENTORY ITEM MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 sm:pt-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in sm:items-center overflow-y-auto"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#050e12]/95 backdrop-blur-xl w-full max-w-md rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-visible text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex items-center justify-between shrink-0 text-left select-none rounded-t-3xl">
                <div className="flex items-center gap-2">
                  <PlusCircle className="h-5 w-5 text-teal-400" />
                  <h3 className="font-extrabold text-white text-sm font-display tracking-wide uppercase">Add Item To Stock</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5 text-xl font-bold cursor-pointer transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
                {errorMsg && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-3 rounded-2xl">
                    {errorMsg}
                  </div>
                )}
                {successMsg && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-2xl">
                    {successMsg}
                  </div>
                )}

                {/* CATEGORY (combo box text box + dropdown) */}
                <div className="space-y-1.5 relative">
                  <label className="text-[11px] font-extrabold text-slate-350 uppercase tracking-wider block">Category</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Type a new category or select existing..."
                      value={categoryInput}
                      onChange={(e) => {
                        setCategoryInput(e.target.value);
                        setShowCategoryDropdown(true);
                      }}
                      onFocus={() => setShowCategoryDropdown(true)}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-teal-500/40 transition-colors pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-200 transition-colors p-1"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Dropdown menu for categories */}
                  <AnimatePresence>
                    {showCategoryDropdown && inventoryCategories.length > 0 && (
                      <>
                        {/* Invisible backdrop to dismiss dropdown */}
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setShowCategoryDropdown(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute left-0 right-0 mt-1 bg-slate-950 border border-white/10 rounded-2xl shadow-xl max-h-36 overflow-y-auto z-20"
                        >
                          <div className="p-1 divide-y divide-white/5">
                            {inventoryCategories
                              .filter(cat => cat.toLowerCase().includes(categoryInput.toLowerCase()))
                              .map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => handleSelectCategory(cat)}
                                  className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition-all font-semibold"
                                >
                                  {cat}
                                </button>
                              ))}
                            {inventoryCategories.filter(cat => cat.toLowerCase().includes(categoryInput.toLowerCase())).length === 0 && (
                              <div className="px-4 py-3 text-xs text-slate-500 font-sans italic">
                                Create new category "{categoryInput}"
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* ITEM NAME */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-350 uppercase tracking-wider block">Item Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Samsung S23 LCD Assembly, Kingston 8GB RAM"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-teal-500/40 transition-colors"
                  />
                </div>

                {/* QTY & DATE ROW */}
                <div className="grid grid-cols-2 gap-4">
                  {/* QUANTITY */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-350 uppercase tracking-wider block">Quantity</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={qty}
                      onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500/40 transition-colors font-mono font-semibold"
                    />
                  </div>

                  {/* DATE */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-extrabold text-slate-350 uppercase tracking-wider block">Date Registered</label>
                    <div className="relative">
                      <input
                        type="date"
                        required
                        value={dateInput}
                        onChange={(e) => setDateInput(e.target.value)}
                        className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500/40 transition-colors font-sans pr-10"
                      />
                      <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-450 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-tr from-teal-500 to-emerald-600 hover:from-teal-450 hover:to-emerald-550 text-white text-xs font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-97 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Updating Database Stock...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="h-4.5 w-4.5" />
                        <span>Confirm and Register Stock</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

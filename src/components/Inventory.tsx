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
  ChevronDown,
  Plus,
  ShoppingBag,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Edit
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
  isAddInventoryOpen: boolean;
  setIsAddInventoryOpen: (val: boolean) => void;
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
  inventoryLoading,
  isAddInventoryOpen,
  setIsAddInventoryOpen
}: InventoryProps) {
  // Modal states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Transaction states for Fill & Sell functions
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [isFillModalOpen, setIsFillModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [transactionQty, setTransactionQty] = useState<number>(1);
  const [customerName, setCustomerName] = useState('');
  const [transactionSubmitting, setTransactionSubmitting] = useState(false);
  const [transactionError, setTransactionError] = useState('');
  const [transactionSuccess, setTransactionSuccess] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [editCategoryName, setEditCategoryName] = useState('');
  const [showEditCategoryDropdown, setShowEditCategoryDropdown] = useState(false);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    if (!editItemName.trim() || !editCategoryName.trim()) {
      setTransactionError('Item Name and Category are required.');
      return;
    }

    setTransactionSubmitting(true);
    setTransactionError('');
    setTransactionSuccess('');

    authFetch(`/api/inventory/${selectedItem.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: editItemName.trim(),
        category: editCategoryName.trim()
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update item');
        }
        return data;
      })
      .then(() => {
        setTransactionSuccess('Successfully updated item details!');
        fetchInventoryData();
        setTimeout(() => {
          setIsEditModalOpen(false);
          setSelectedItem(null);
          setTransactionSuccess('');
          setEditItemName('');
          setEditCategoryName('');
        }, 1500);
      })
      .catch((err) => {
        setTransactionError(err.message || 'An error occurred during the update.');
      })
      .finally(() => {
        setTransactionSubmitting(false);
      });
  };

  const handleTransactionSubmit = (e: React.FormEvent, type: 'fill' | 'sell') => {
    e.preventDefault();
    if (!selectedItem) return;
    if (transactionQty <= 0) {
      setTransactionError('Quantity must be greater than 0.');
      return;
    }
    if (type === 'sell' && !customerName.trim()) {
      setTransactionError('Customer name is required.');
      return;
    }
    if (type === 'sell' && selectedItem.qty < transactionQty) {
      setTransactionError(`Only ${selectedItem.qty} items are currently in stock.`);
      return;
    }

    setTransactionSubmitting(true);
    setTransactionError('');
    setTransactionSuccess('');

    authFetch('/api/inventory/transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        itemId: selectedItem.id,
        type,
        qty: transactionQty,
        customerName: type === 'sell' ? customerName.trim() : undefined
      })
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || `Failed to process ${type} transaction`);
        }
        return data;
      })
      .then(() => {
        setTransactionSuccess(`Successfully updated inventory!`);
        fetchInventoryData();
        setTimeout(() => {
          setIsFillModalOpen(false);
          setIsSellModalOpen(false);
          setSelectedItem(null);
          setTransactionQty(1);
          setCustomerName('');
          setTransactionSuccess('');
        }, 1500);
      })
      .catch((err) => {
        setTransactionError(err.message || 'An error occurred during the transaction.');
      })
      .finally(() => {
        setTransactionSubmitting(false);
      });
  };

  // Form states
  const [categoryInput, setCategoryInput] = useState('');
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState<number>(1);
  const [dateInput, setDateInput] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showItemNameDropdown, setShowItemNameDropdown] = useState(false);

  const uniqueItemNames = React.useMemo(() => {
    if (!categoryInput.trim()) return [];
    const names = inventoryItems
      .filter(item => item.category.toLowerCase() === categoryInput.trim().toLowerCase())
      .map(item => item.name);
    return Array.from(new Set(names));
  }, [inventoryItems, categoryInput]);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

  // Sync category input if a category is selected
  const handleSelectCategory = (cat: string) => {
    setCategoryInput(cat);
    setShowCategoryDropdown(false);
  };

  const handleSelectItemName = (name: string) => {
    setItemName(name);
    setShowItemNameDropdown(false);
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
          setIsAddInventoryOpen(false);
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
    const queryTokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    const matchesSearch = queryTokens.length === 0 || queryTokens.every(token => {
      return item.name.toLowerCase().includes(token) || item.category.toLowerCase().includes(token);
    });
    const matchesCategory = selectedCategoryFilter === 'All' || item.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filtered logs
  const filteredLogs = inventoryLogs.filter(log => {
    const queryTokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return queryTokens.length === 0 || queryTokens.every(token => {
      return (log.itemName || '').toLowerCase().includes(token) || 
             (log.category || '').toLowerCase().includes(token) ||
             (log.actionType || '').toLowerCase().includes(token) ||
             (log.username || '').toLowerCase().includes(token);
    });
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
                          <th className="pb-3">Last Updated</th>
                          <th className="pb-3 pr-4 text-right">Actions</th>
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
                            <td className="py-4 text-slate-400 font-sans">
                              {formatDate(item.updatedAt)}
                            </td>
                            <td className="py-4 pr-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem(item);
                                    setEditItemName(item.name);
                                    setEditCategoryName(item.category);
                                    setIsEditModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-blue-500/10 text-blue-300 border border-blue-500/20 hover:bg-blue-500/20 transition-all font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                  title="Edit Item"
                                >
                                  <Edit className="h-3 w-3" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem(item);
                                    setTransactionQty(1);
                                    setIsFillModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                  title="Fill Stock"
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>Fill</span>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem(item);
                                    setTransactionQty(1);
                                    setCustomerName('');
                                    setIsSellModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-all font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                                  title="Sell Item"
                                >
                                  <ShoppingBag className="h-3 w-3" />
                                  <span>Sell</span>
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        ))}
                      </tbody>
                    </table>

                    {/* MOBILE CARD GRID VIEW */}
                    <div className="grid grid-cols-1 gap-4 md:hidden pb-12">
                      {filteredItems.map((item, index) => {
                        const isExpanded = activeCardId === item.id;
                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            onClick={() => setActiveCardId(isExpanded ? null : item.id)}
                            className={`bg-slate-950/45 border rounded-3xl p-4.5 space-y-3.5 shadow-lg transition-all duration-250 cursor-pointer ${
                              isExpanded 
                                ? 'border-teal-500/30 bg-slate-900/30 ring-1 ring-teal-500/10' 
                                : 'border-white/10 hover:border-white/15'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1.5">
                                <h4 className="font-extrabold text-white text-sm leading-snug flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
                                  {item.name}
                                </h4>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/10 text-teal-300 border border-teal-500/15">
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
                            
                            <div className="border-t border-white/5 pt-3.5 flex flex-col gap-2 text-[10px] text-slate-400 font-sans">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Registered Date:</span>
                                <span className="font-medium text-slate-300">{formatDate(item.date)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-500">Last Updated:</span>
                                <span className="font-medium text-slate-300">{formatDate(item.updatedAt)}</span>
                              </div>
                            </div>

                            {/* Actions overlay / panel inside card when clicked */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden border-t border-white/5 pt-3.5 mt-3.5"
                                  onClick={(e) => e.stopPropagation()} // Prevent collapse when interacting with the actions panel
                                >
                                  <p className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider mb-2.5">Stock Management Operations</p>
                                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedItem(item);
                                        setEditItemName(item.name);
                                        setEditCategoryName(item.category);
                                        setIsEditModalOpen(true);
                                      }}
                                      className="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-2 sm:px-3 rounded-2xl bg-blue-500/10 hover:bg-blue-500/15 text-blue-300 border border-blue-500/20 hover:border-blue-500/30 transition-all font-bold text-[10px] sm:text-xs cursor-pointer active:scale-97"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedItem(item);
                                        setTransactionQty(1);
                                        setIsFillModalOpen(true);
                                      }}
                                      className="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-2 sm:px-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/30 transition-all font-bold text-[10px] sm:text-xs cursor-pointer active:scale-97"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      <span>Fill</span>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedItem(item);
                                        setTransactionQty(1);
                                        setCustomerName('');
                                        setIsSellModalOpen(true);
                                      }}
                                      className="flex items-center justify-center gap-1.5 py-2.5 sm:py-3 px-2 sm:px-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 text-amber-300 border border-amber-500/20 hover:border-amber-500/30 transition-all font-bold text-[10px] sm:text-xs cursor-pointer active:scale-97"
                                    >
                                      <ShoppingBag className="h-3.5 w-3.5" />
                                      <span>Sell</span>
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        );
                      })}
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
        {isAddInventoryOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 sm:pt-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in sm:items-center overflow-y-auto"
            onClick={() => setIsAddInventoryOpen(false)}
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
                  onClick={() => setIsAddInventoryOpen(false)}
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
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setCategoryInput(e.target.value);
                        setShowCategoryDropdown(true);
                      }}
                      onFocus={() => setShowCategoryDropdown(true)}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-teal-500/40 transition-colors pr-10 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-200 transition-colors p-1 disabled:opacity-50"
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
                <div className="space-y-1.5 relative">
                  <label className="text-[11px] font-extrabold text-slate-350 uppercase tracking-wider block">Item Name</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="e.g. Samsung S23 LCD Assembly, Kingston 8GB RAM"
                      value={itemName}
                      disabled={isSubmitting}
                      onChange={(e) => {
                        setItemName(e.target.value);
                        setShowItemNameDropdown(true);
                      }}
                      onFocus={() => setShowItemNameDropdown(true)}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-teal-500/40 transition-colors pr-10 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setShowItemNameDropdown(!showItemNameDropdown)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-200 transition-colors p-1 disabled:opacity-50"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Dropdown menu for item names */}
                  <AnimatePresence>
                    {showItemNameDropdown && uniqueItemNames.length > 0 && (
                      <>
                        {/* Invisible backdrop to dismiss dropdown */}
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setShowItemNameDropdown(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute left-0 right-0 mt-1 bg-slate-950 border border-white/10 rounded-2xl shadow-xl max-h-36 overflow-y-auto z-20"
                        >
                          <div className="p-1 divide-y divide-white/5">
                            {uniqueItemNames
                              .filter(name => name.toLowerCase().includes(itemName.toLowerCase()))
                              .map((name) => (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => handleSelectItemName(name)}
                                  className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-colors"
                                >
                                  {name}
                                </button>
                              ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
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
                      disabled={isSubmitting}
                      onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500/40 transition-colors font-mono font-semibold disabled:opacity-50"
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
                        disabled={isSubmitting}
                        onChange={(e) => setDateInput(e.target.value)}
                        className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-slate-100 focus:outline-none focus:border-teal-500/40 transition-colors font-sans pr-10 disabled:opacity-50"
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

      {/* FILL STOCK MODAL */}
      <AnimatePresence>
        {isFillModalOpen && selectedItem && (
          <div 
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 sm:pt-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in sm:items-center overflow-y-auto"
            onClick={() => {
              setIsFillModalOpen(false);
              setSelectedItem(null);
            }}
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
                  <PlusCircle className="h-5 w-5 text-emerald-400" />
                  <h3 className="font-extrabold text-white text-sm font-display tracking-wide uppercase">Fill Item Stock</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsFillModalOpen(false);
                    setSelectedItem(null);
                  }}
                  className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5 text-xl font-bold cursor-pointer transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={(e) => handleTransactionSubmit(e, 'fill')} className="p-6 space-y-4 text-left">
                <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-4.5">
                  <span className="text-[10px] text-teal-400/80 font-semibold uppercase block mb-1">{selectedItem.category}</span>
                  <h4 className="font-bold text-white text-sm">{selectedItem.name}</h4>
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-2">
                    <span>Current Stock:</span>
                    <span className="font-mono font-bold text-slate-200 bg-slate-900 px-2 py-0.5 rounded-md border border-white/5">
                      {selectedItem.qty} pcs
                    </span>
                  </p>
                </div>

                {transactionError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-3 rounded-2xl">
                    {transactionError}
                  </div>
                )}
                {transactionSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-2xl">
                    {transactionSuccess}
                  </div>
                )}

                {/* QUANTITY TO FILL */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-350 uppercase tracking-wider block">Quantity to Fill</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={transactionSubmitting}
                      onClick={() => setTransactionQty(prev => Math.max(1, prev - 1))}
                      className="w-12 h-12 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer text-lg font-bold transition-all shrink-0 select-none active:scale-95 disabled:opacity-50"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      required
                      min={1}
                      value={transactionQty}
                      disabled={transactionSubmitting}
                      onChange={(e) => setTransactionQty(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-center text-sm font-mono font-bold text-slate-100 focus:outline-none focus:border-teal-500/40 transition-colors disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={transactionSubmitting}
                      onClick={() => setTransactionQty(prev => prev + 1)}
                      className="w-12 h-12 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer text-lg font-bold transition-all shrink-0 select-none active:scale-95 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={transactionSubmitting}
                    className="w-full bg-gradient-to-tr from-emerald-500 to-teal-600 hover:from-emerald-450 hover:to-teal-550 text-white text-xs font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-97 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {transactionSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Updating Database Stock...</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-4.5 w-4.5" />
                        <span>Confirm and Fill Stock</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SELL INVENTORY ITEM MODAL */}
      <AnimatePresence>
        {isSellModalOpen && selectedItem && (
          <div 
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 sm:pt-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in sm:items-center overflow-y-auto"
            onClick={() => {
              setIsSellModalOpen(false);
              setSelectedItem(null);
            }}
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
                  <ShoppingBag className="h-5 w-5 text-amber-400" />
                  <h3 className="font-extrabold text-white text-sm font-display tracking-wide uppercase">Sell Stock Item</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSellModalOpen(false);
                    setSelectedItem(null);
                  }}
                  className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5 text-xl font-bold cursor-pointer transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={(e) => handleTransactionSubmit(e, 'sell')} className="p-6 space-y-4 text-left">
                <div className="bg-slate-950/50 border border-white/5 rounded-2xl p-4.5">
                  <span className="text-[10px] text-teal-400/80 font-semibold uppercase block mb-1">{selectedItem.category}</span>
                  <h4 className="font-bold text-white text-sm">{selectedItem.name}</h4>
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-2">
                    <span>Available Stock:</span>
                    <span className="font-mono font-bold text-slate-200 bg-slate-900 px-2 py-0.5 rounded-md border border-white/5">
                      {selectedItem.qty} pcs
                    </span>
                  </p>
                </div>

                {transactionError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-3 rounded-2xl">
                    {transactionError}
                  </div>
                )}
                {transactionSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-2xl">
                    {transactionSuccess}
                  </div>
                )}

                {/* CUSTOMER NAME */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-350 uppercase tracking-wider block">Customer Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ko Phyo, Ma Thiri, Walk-in Client"
                    value={customerName}
                    disabled={transactionSubmitting}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-teal-500/40 transition-colors font-medium disabled:opacity-50"
                  />
                </div>

                {/* QUANTITY TO SELL */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-extrabold text-slate-350 uppercase tracking-wider block">Quantity to Remove / Sell</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={transactionSubmitting}
                      onClick={() => setTransactionQty(prev => Math.max(1, prev - 1))}
                      className="w-12 h-12 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer text-lg font-bold transition-all shrink-0 select-none active:scale-95 disabled:opacity-50"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      required
                      min={1}
                      max={selectedItem.qty}
                      value={transactionQty}
                      disabled={transactionSubmitting}
                      onChange={(e) => setTransactionQty(Math.min(selectedItem.qty, Math.max(1, parseInt(e.target.value) || 0)))}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-center text-sm font-mono font-bold text-slate-100 focus:outline-none focus:border-teal-500/40 transition-colors disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={transactionSubmitting}
                      onClick={() => setTransactionQty(prev => Math.min(selectedItem.qty, prev + 1))}
                      className="w-12 h-12 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer text-lg font-bold transition-all shrink-0 select-none active:scale-95 disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={transactionSubmitting}
                    className="w-full bg-gradient-to-tr from-amber-500 to-orange-600 hover:from-amber-450 hover:to-orange-550 text-white text-xs font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-97 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {transactionSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing Sale...</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="h-4.5 w-4.5" />
                        <span>Confirm and Register Sale</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT ITEM MODAL */}
      <AnimatePresence>
        {isEditModalOpen && selectedItem && (
          <div 
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 sm:pt-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in sm:items-center overflow-y-auto"
            onClick={() => {
              setIsEditModalOpen(false);
              setSelectedItem(null);
            }}
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
                  <Edit className="h-5 w-5 text-blue-400" />
                  <h3 className="font-extrabold text-white text-sm font-display tracking-wide uppercase">Edit Item Details</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedItem(null);
                  }}
                  className="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/5 text-xl font-bold cursor-pointer transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleEditSubmit} className="p-6 space-y-4 text-left">
                {transactionError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-4 py-3 rounded-2xl">
                    {transactionError}
                  </div>
                )}
                {transactionSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-2xl">
                    {transactionSuccess}
                  </div>
                )}

                {/* CATEGORY */}
                <div className="space-y-1.5 relative z-20">
                  <label className="text-[11px] font-extrabold text-slate-350 uppercase tracking-wider block">Category</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Type a category..."
                      value={editCategoryName}
                      disabled={transactionSubmitting}
                      onChange={(e) => {
                        setEditCategoryName(e.target.value);
                        setShowEditCategoryDropdown(true);
                      }}
                      onFocus={() => setShowEditCategoryDropdown(true)}
                      className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-blue-500/40 transition-colors pr-10 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={transactionSubmitting}
                      onClick={() => setShowEditCategoryDropdown(!showEditCategoryDropdown)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-200 transition-colors p-1 disabled:opacity-50"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Dropdown menu for categories */}
                  <AnimatePresence>
                    {showEditCategoryDropdown && inventoryCategories.length > 0 && (
                      <>
                        <div 
                          className="fixed inset-0 z-10" 
                          onClick={() => setShowEditCategoryDropdown(false)}
                        />
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute left-0 right-0 mt-1 bg-slate-950 border border-white/10 rounded-2xl shadow-xl max-h-36 overflow-y-auto z-20"
                        >
                          <div className="p-1 divide-y divide-white/5">
                            {inventoryCategories
                              .filter(cat => cat.toLowerCase().includes(editCategoryName.toLowerCase()))
                              .map((cat) => (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => {
                                    setEditCategoryName(cat);
                                    setShowEditCategoryDropdown(false);
                                  }}
                                  className="w-full text-left px-3 py-2.5 text-xs text-slate-300 hover:text-white hover:bg-white/5 font-medium transition-colors"
                                >
                                  {cat}
                                </button>
                              ))}
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                {/* ITEM NAME */}
                <div className="space-y-1.5 relative">
                  <label className="text-[11px] font-extrabold text-slate-350 uppercase tracking-wider block">Item Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Samsung S23 LCD Assembly"
                    value={editItemName}
                    disabled={transactionSubmitting}
                    onChange={(e) => setEditItemName(e.target.value)}
                    className="w-full bg-slate-950/60 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-slate-100 placeholder-slate-550 focus:outline-none focus:border-blue-500/40 transition-colors disabled:opacity-50"
                  />
                </div>

                {/* SUBMIT BUTTON */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={transactionSubmitting}
                    className="w-full bg-gradient-to-tr from-blue-500 to-indigo-600 hover:from-blue-450 hover:to-indigo-550 text-white text-xs font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-md active:scale-97 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {transactionSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Updating Item...</span>
                      </>
                    ) : (
                      <>
                        <Edit className="h-4.5 w-4.5" />
                        <span>Save Changes</span>
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

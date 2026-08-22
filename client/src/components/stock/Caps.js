import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, X, AlertTriangle, History, ArrowUpRight, ArrowDownRight, RefreshCw, CheckCircle2, Layers } from 'lucide-react';
import { addCap, getCaps, updateCapStock, deleteCap, getCapHistory } from '../../services/api/stock';

const ROWS_OPTIONS = [5, 10, 20, 50];

function statusBadge(status) {
  if (status === 'OUT_OF_STOCK') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">Out of Stock</span>;
  if (status === 'LOW_STOCK') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">Low Stock</span>;
  if (status === 'NORMAL') return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200 whitespace-nowrap">Normal</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 whitespace-nowrap">Unknown</span>;
}

const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors";
const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

const neckTypes = ['Narrow Neck', 'Short Neck', 'Alaska 60'];
const colors = ['White', 'Blue', 'Red', 'Green', 'Yellow', 'Black', 'Transparent', 'Other'];

export default function CapManagement() {
  const [caps, setCaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentCapId, setCurrentCapId] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [capToDelete, setCapToDelete] = useState(null);

  // Cap History Modal state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyCap, setHistoryCap] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [neckTypeFilter, setNeckTypeFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');

  const [formData, setFormData] = useState({
    neckType: '',
    customNeckType: '',
    color: '',
    inputUnit: 'bags', // 'bags' | 'nos'
    quantityBags: '',
    customPcsPerBag: '',
    quantityAvailable: 0,
    remarks: ''
  });
  const [stockAdjustmentData, setStockAdjustmentData] = useState({
    changeType: 'addition',
    adjustmentUnit: 'bags', // 'bags' | 'nos'
    quantityChangeBags: '',
    quantityChange: '',
    stockRemarks: ''
  });
  const [hasStockAdjustment, setHasStockAdjustment] = useState(false);

  // Helper to get standard Pieces per Bag based on Neck Type
  const getPcsPerBag = (neckType, customPcs = 0) => {
    if (!neckType) return 0;
    const lower = neckType.toLowerCase();
    if (lower.includes('alaska 60') || lower.includes('alaska60')) return 7000;
    if (lower.includes('short neck') || lower.includes('shortneck')) return 10500;
    if (lower.includes('narrow neck') || lower.includes('narrowneck')) return 15000;
    return Number(customPcs) || 0;
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => { fetchCaps(); }, [debouncedSearch, neckTypeFilter, colorFilter]);

  const fetchCaps = async () => {
    setLoading(true); setError('');
    try {
      const params = {};
      if (neckTypeFilter) params.neckType = neckTypeFilter;
      if (colorFilter) params.color = colorFilter;
      const response = await getCaps(params);
      if (response.success) {
        let data = response.data || [];
        if (debouncedSearch) {
          data = data.filter(cap =>
            cap.displayName?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            cap.neckType.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            cap.color.toLowerCase().includes(debouncedSearch.toLowerCase())
          );
        }
        setCaps(data.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', undefined, { sensitivity: 'base' })));
      } else { setError('Failed to fetch caps'); }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to fetch caps');
    } finally { setLoading(false); }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };

      // Auto calculate Nos when Bags or customPcsPerBag change
      if (name === 'quantityBags' || name === 'neckType' || name === 'customPcsPerBag') {
        const nType = name === 'neckType' ? value : updated.neckType;
        const customP = name === 'customPcsPerBag' ? value : updated.customPcsPerBag;
        const bags = name === 'quantityBags' ? value : updated.quantityBags;
        const pcs = getPcsPerBag(nType, customP);
        if (updated.inputUnit === 'bags' && pcs > 0) {
          updated.quantityAvailable = bags !== '' ? Math.round(Number(bags) * pcs) : 0;
        }
      } else if (name === 'quantityAvailable') {
        updated.quantityAvailable = value === '' ? '' : Number(value);
        const pcs = getPcsPerBag(updated.neckType, updated.customPcsPerBag);
        if (pcs > 0 && value !== '') {
          updated.quantityBags = (Number(value) / pcs).toFixed(2);
        }
      }

      return updated;
    });
  };

  const handleStockAdjustmentChange = (e) => {
    const { name, value } = e.target;
    setStockAdjustmentData(prev => {
      const updated = { ...prev, [name]: value };
      const currentCap = caps.find(c => c._id === currentCapId);
      const pcs = currentCap ? getPcsPerBag(currentCap.neckType) : 0;

      if (name === 'quantityChangeBags') {
        if (pcs > 0) {
          updated.quantityChange = value !== '' ? Math.round(Number(value) * pcs) : '';
        }
      } else if (name === 'quantityChange') {
        if (pcs > 0 && value !== '') {
          updated.quantityChangeBags = (Number(value) / pcs).toFixed(2);
        }
      }

      return updated;
    });
    setHasStockAdjustment(true);
  };

  const resetModal = () => {
    setFormData({
      neckType: '',
      customNeckType: '',
      color: '',
      inputUnit: 'bags',
      quantityBags: '',
      customPcsPerBag: '',
      quantityAvailable: 0,
      remarks: ''
    });
    setStockAdjustmentData({
      changeType: 'addition',
      adjustmentUnit: 'bags',
      quantityChangeBags: '',
      quantityChange: '',
      stockRemarks: ''
    });
    setHasStockAdjustment(false);
  };

  const handleOpenModal = (cap = null) => {
    if (cap) {
      setIsEditMode(true); setCurrentCapId(cap._id);

      let isCustom = !neckTypes.includes(cap.neckType);
      const pcs = getPcsPerBag(cap.neckType);

      setFormData({
        neckType: isCustom ? 'Other' : cap.neckType,
        customNeckType: isCustom ? cap.neckType : '',
        color: cap.color,
        inputUnit: 'bags',
        quantityBags: pcs > 0 ? ((cap.quantityAvailable || 0) / pcs).toFixed(2) : '',
        customPcsPerBag: '',
        quantityAvailable: cap.quantityAvailable || 0,
        remarks: cap.remarks || ''
      });
      setStockAdjustmentData({
        changeType: 'addition',
        adjustmentUnit: 'bags',
        quantityChangeBags: '',
        quantityChange: '',
        stockRemarks: ''
      });
      setHasStockAdjustment(false);
    } else { setIsEditMode(false); setCurrentCapId(null); resetModal(); }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => { setIsModalOpen(false); setIsEditMode(false); setCurrentCapId(null); resetModal(); setError(''); };

  const handleSubmit = async () => {
    if (!formData.neckType || !formData.color) { setError('Neck Type and Color are required'); return; }
    if (formData.neckType === 'Other' && !formData.customNeckType) { setError('Please enter a custom Neck Type'); return; }

    let totalQty = Number(formData.quantityAvailable) || 0;
    if (!isEditMode && formData.inputUnit === 'bags') {
      const pcs = getPcsPerBag(formData.neckType, formData.customPcsPerBag);
      if (pcs > 0 && formData.quantityBags !== '') {
        totalQty = Math.round(Number(formData.quantityBags) * pcs);
      }
    }

    if (!isEditMode && totalQty < 0) { setError('Initial quantity cannot be negative'); return; }

    try {
      setLoading(true); setError('');
      let capUpdateSuccess = false, stockAdjustmentSuccess = false;

      const payload = {
        neckType: formData.neckType === 'Other' ? formData.customNeckType : formData.neckType,
        color: formData.color,
        quantityAvailable: totalQty,
        remarks: formData.remarks
      };

      if (!isEditMode) {
        const response = await addCap(payload);
        if (response.success) { capUpdateSuccess = true; setSuccess(response.message || 'Cap added successfully!'); }
      }
      if (isEditMode && hasStockAdjustment) {
        let finalChangeQty = parseFloat(stockAdjustmentData.quantityChange);
        if (stockAdjustmentData.adjustmentUnit === 'bags' && stockAdjustmentData.quantityChangeBags !== '') {
          const currentCap = caps.find(c => c._id === currentCapId);
          const pcs = currentCap ? getPcsPerBag(currentCap.neckType) : 0;
          if (pcs > 0) {
            finalChangeQty = Math.round(Number(stockAdjustmentData.quantityChangeBags) * pcs);
          }
        }

        if (!isNaN(finalChangeQty) && finalChangeQty >= 0) {
          const stockResponse = await updateCapStock(currentCapId, {
            changeType: stockAdjustmentData.changeType,
            quantityChange: finalChangeQty,
            remarks: stockAdjustmentData.stockRemarks || `Manual adjustment (${stockAdjustmentData.quantityChangeBags ? stockAdjustmentData.quantityChangeBags + ' Bags' : finalChangeQty + ' Nos'})`,
          });
          if (stockResponse.success) stockAdjustmentSuccess = true;
        }
      }
      if (isEditMode) {
        if (stockAdjustmentSuccess) setSuccess('Cap stock updated successfully!');
        else setSuccess('No changes made');
      } else { if (capUpdateSuccess) setSuccess('Cap added successfully!'); }
      handleCloseModal(); await fetchCaps(); setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || `Failed to ${isEditMode ? 'update' : 'add'} cap`);
    } finally { setLoading(false); }
  };

  const handleDeleteClick = (cap) => { setCapToDelete(cap); setDeleteDialogOpen(true); };
  const handleDeleteCancel = () => { setDeleteDialogOpen(false); setCapToDelete(null); };
  const handleDeleteConfirm = async () => {
    if (!capToDelete) return;
    try {
      setLoading(true); setError('');
      await deleteCap(capToDelete._id);
      setSuccess('Cap deleted successfully!');
      await fetchCaps(); setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete cap');
    } finally { setLoading(false); setDeleteDialogOpen(false); setCapToDelete(null); }
  };

  // Open Cap History Modal
  const openHistoryModal = async (cap) => {
    setHistoryCap(cap);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError('');
    setHistoryData([]);

    try {
      const res = await getCapHistory(cap._id);
      if (res?.success) {
        setHistoryData(res.data?.history || []);
      } else {
        setHistoryError(res?.message || 'No history found');
      }
    } catch (err) {
      setHistoryError(err.response?.data?.message || err.message || 'Failed to fetch cap history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const getActionBadge = (changeType) => {
    switch (changeType) {
      case 'addition':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><ArrowUpRight className="w-3 h-3" /> Addition</span>;
      case 'reduction':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"><ArrowDownRight className="w-3 h-3" /> Reduction</span>;
      case 'set':
      case 'set_value':
      case 'adjustment':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200"><RefreshCw className="w-3 h-3" /> Set Value</span>;
      case 'deduction':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200"><Layers className="w-3 h-3" /> Bottle Production</span>;
      case 'production':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><ArrowUpRight className="w-3 h-3" /> Cap Production</span>;
      case 'initial':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200"><CheckCircle2 className="w-3 h-3" /> Initial Stock</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 capitalize">{changeType}</span>;
    }
  };

  const paginatedCaps = caps.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
  const totalPages = Math.ceil(caps.length / rowsPerPage);

  const Pagination = () => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/50 text-sm text-gray-600">
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          className="px-2 py-1 border border-gray-300 rounded-lg text-sm bg-white outline-none">
          {ROWS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <span className="text-gray-400">|</span>
        <span>Showing {caps.length === 0 ? 0 : page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, caps.length)} of {caps.length}</span>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-white transition-colors">Prev</button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          const p = totalPages > 5 && page > 2 ? page - 2 + i : i;
          if (p >= totalPages) return null;
          return (
            <button key={p} onClick={() => setPage(p)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === p ? 'bg-amber-500 text-white' : 'border border-gray-200 hover:bg-white text-gray-700'}`}>
              {p + 1}
            </button>
          );
        })}
        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
          className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-white transition-colors">Next</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl">
              <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth="2" /><circle cx="12" cy="12" r="3" strokeWidth="2" /></svg>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Cap Management</h1>
              <p className="text-sm text-slate-500 mt-0.5">{caps.length} caps</p>
            </div>
          </div>
          <button onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Add Cap
          </button>
        </div>

        {/* Alerts */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm flex items-center justify-between shadow-sm">
            <span>{success}</span><button onClick={() => setSuccess('')}><X className="h-4 w-4" /></button>
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center justify-between shadow-sm">
            <span>{error}</span><button onClick={() => setError('')}><X className="h-4 w-4" /></button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search caps..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
            </div>
            <select value={neckTypeFilter} onChange={e => setNeckTypeFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none">
              <option value="">All Neck Types</option>
              {neckTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={colorFilter} onChange={e => setColorFilter(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none">
              <option value="">All Colors</option>
              {colors.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && caps.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-amber-200 border-t-amber-500 rounded-full" />
          </div>
        )}

        {/* Table */}
        {!loading && caps.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-500 text-white">
                    {['Display Name', 'Neck Type', 'Color', 'Available Qty (Nos)', 'Available (Bags)', 'Status', 'Remarks', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedCaps.map((cap, idx) => {
                    const pcs = getPcsPerBag(cap.neckType);
                    const bags = pcs > 0 ? (cap.quantityAvailable / pcs) : null;
                    return (
                      <tr key={cap._id} className={`hover:bg-amber-50/40 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3 font-medium text-gray-800">{cap.displayName}</td>
                        <td className="px-4 py-3"><span className="px-2.5 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-100 capitalize">{cap.neckType}</span></td>
                        <td className="px-4 py-3"><span className="px-2.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">{cap.color}</span></td>
                        <td className="px-4 py-3 font-semibold text-gray-800">
                          {cap.quantityAvailable || 0} <span className="text-gray-400 font-normal text-xs">Nos</span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-amber-700">
                          {bags !== null ? (
                            <span>{bags.toFixed(2)} <span className="text-gray-400 font-normal text-xs">Bags</span></span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{statusBadge(cap.stockStatus)}</td>
                        <td className="px-4 py-3 text-gray-500 max-w-[120px] truncate">{cap.remarks || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openHistoryModal(cap)} title="View History"
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors">
                              <History className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleOpenModal(cap)} title="Edit & Adjust"
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeleteClick(cap)} title="Delete"
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination />
          </div>
        )}

        {!loading && caps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg className="h-14 w-14 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="9" strokeWidth="1.5" /><circle cx="12" cy="12" r="3" strokeWidth="1.5" /></svg>
            <p className="font-medium">No caps found. Add one to get started!</p>
          </div>
        )}
      </div>

      {/* ── Add/Edit Modal ───────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4"
          onClick={handleCloseModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{isEditMode ? 'Edit Cap & Adjust Stock' : 'Add New Cap'}</h3>
                {isEditMode && currentCapId && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Current Stock: <span className="font-semibold text-emerald-600">{formData.quantityAvailable || 0} Nos</span>
                    {getPcsPerBag(formData.neckType) > 0 && (
                      <span className="text-amber-600 ml-1">
                        (≈ {((formData.quantityAvailable || 0) / getPcsPerBag(formData.neckType)).toFixed(2)} Bags)
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button onClick={handleCloseModal} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Cap Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Neck Type <span className="text-red-500">*</span></label>
                  <select name="neckType" value={formData.neckType} onChange={handleInputChange} disabled={isEditMode}
                    className={`${inputCls} ${isEditMode ? 'bg-gray-50 text-gray-400' : ''}`}>
                    <option value="">Select Neck Type</option>
                    {neckTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    <option value="Other">Other (Type Manually)</option>
                  </select>

                  {formData.neckType === 'Other' && (
                    <div className="mt-2 space-y-2">
                      <input type="text" name="customNeckType" value={formData.customNeckType} onChange={handleInputChange} disabled={isEditMode} placeholder="Enter Custom Neck Type"
                        className={`${inputCls} ${isEditMode ? 'bg-gray-50 text-gray-400' : ''}`} />
                      {!isEditMode && (
                        <input type="number" name="customPcsPerBag" value={formData.customPcsPerBag} onChange={handleInputChange} placeholder="Nos per 1 Bag (Formula)"
                          className={inputCls} />
                      )}
                    </div>
                  )}
                  {isEditMode && <p className="text-xs text-gray-400 mt-1">Cannot be changed</p>}
                </div>
                <div>
                  <label className={labelCls}>Color <span className="text-red-500">*</span></label>
                  <select name="color" value={formData.color} onChange={handleInputChange} disabled={isEditMode}
                    className={`${inputCls} ${isEditMode ? 'bg-gray-50 text-gray-400' : ''}`}>
                    <option value="">Select Color</option>
                    {colors.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {isEditMode && <p className="text-xs text-gray-400 mt-1">Cannot be changed</p>}
                </div>
              </div>

              {!isEditMode && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-800 uppercase tracking-wide">Initial Quantity</label>
                    <div className="flex bg-white rounded-lg p-0.5 border border-amber-200 text-xs">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, inputUnit: 'bags' }))}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${formData.inputUnit === 'bags' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        In Bags
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, inputUnit: 'nos' }))}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${formData.inputUnit === 'nos' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        In Nos (Pieces)
                      </button>
                    </div>
                  </div>

                  {formData.inputUnit === 'bags' ? (
                    <div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          name="quantityBags"
                          value={formData.quantityBags}
                          onChange={handleInputChange}
                          placeholder="e.g. 2 Bags"
                          className={inputCls}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 pointer-events-none">
                          Bags
                        </span>
                      </div>
                      <div className="mt-2 p-2.5 bg-white rounded-xl border border-amber-100 flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          Formula ({formData.neckType || 'Select Neck'}):
                        </span>
                        <span className="font-bold text-emerald-700">
                          = {Number(formData.quantityAvailable || 0).toLocaleString()} Nos
                          {getPcsPerBag(formData.neckType, formData.customPcsPerBag) > 0 && (
                            <span className="text-gray-400 font-normal ml-1">
                              (@ {getPcsPerBag(formData.neckType, formData.customPcsPerBag).toLocaleString()} Nos/Bag)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          name="quantityAvailable"
                          value={formData.quantityAvailable}
                          onChange={handleInputChange}
                          placeholder="e.g. 14000"
                          className={inputCls}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 pointer-events-none">
                          Nos
                        </span>
                      </div>
                      {getPcsPerBag(formData.neckType, formData.customPcsPerBag) > 0 && (
                        <p className="text-xs text-amber-700 mt-1 font-medium">
                          ≈ {((Number(formData.quantityAvailable) || 0) / getPcsPerBag(formData.neckType, formData.customPcsPerBag)).toFixed(2)} Bags
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className={labelCls}>Remarks</label>
                <textarea name="remarks" value={formData.remarks} onChange={handleInputChange} rows={2} className={`${inputCls} resize-none`} placeholder="Optional notes" />
              </div>

              {isEditMode && (
                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Stock Adjustment</p>
                    <div className="flex bg-gray-100 rounded-lg p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setStockAdjustmentData(prev => ({ ...prev, adjustmentUnit: 'bags' }))}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${stockAdjustmentData.adjustmentUnit === 'bags' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        In Bags
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockAdjustmentData(prev => ({ ...prev, adjustmentUnit: 'nos' }))}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${stockAdjustmentData.adjustmentUnit === 'nos' ? 'bg-amber-500 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        In Nos
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Change Action</label>
                      <select name="changeType" value={stockAdjustmentData.changeType} onChange={handleStockAdjustmentChange} className={inputCls}>
                        <option value="addition">Addition (+)</option>
                        <option value="reduction">Reduction (-)</option>
                        <option value="set">Set to Exact Value (=)</option>
                      </select>
                    </div>

                    <div>
                      <label className={labelCls}>
                        {stockAdjustmentData.adjustmentUnit === 'bags' ? 'Amount (Bags) *' : 'Amount (Nos) *'}
                      </label>
                      {stockAdjustmentData.adjustmentUnit === 'bags' ? (
                        <div>
                          <input
                            type="number"
                            step="0.01"
                            name="quantityChangeBags"
                            value={stockAdjustmentData.quantityChangeBags}
                            onChange={handleStockAdjustmentChange}
                            min="0"
                            placeholder="e.g. 2"
                            className={inputCls}
                          />
                          <p className="text-[11px] text-emerald-600 mt-1 font-semibold">
                            = {stockAdjustmentData.quantityChange !== '' ? Number(stockAdjustmentData.quantityChange).toLocaleString() : 0} Nos
                          </p>
                        </div>
                      ) : (
                        <div>
                          <input
                            type="number"
                            name="quantityChange"
                            value={stockAdjustmentData.quantityChange}
                            onChange={handleStockAdjustmentChange}
                            min="0"
                            placeholder="e.g. 14000"
                            className={inputCls}
                          />
                          {getPcsPerBag(formData.neckType) > 0 && stockAdjustmentData.quantityChange !== '' && (
                            <p className="text-[11px] text-amber-600 mt-1">
                              ≈ {(Number(stockAdjustmentData.quantityChange) / getPcsPerBag(formData.neckType)).toFixed(2)} Bags
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>Adjustment Remarks</label>
                    <textarea name="stockRemarks" value={stockAdjustmentData.stockRemarks} onChange={handleStockAdjustmentChange} rows={2} className={`${inputCls} resize-none`} placeholder="Reason for adjustment" />
                  </div>
                </div>
              )}
              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button onClick={handleCloseModal} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-white transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={loading || !formData.neckType || !formData.color}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60 shadow-sm">
                {loading ? 'Saving...' : isEditMode ? 'Update & Adjust' : 'Add Cap'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cap History Modal ────────────────────────────────────────────── */}
      {isHistoryOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4"
          onClick={() => setIsHistoryOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <History className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    History: {historyCap?.displayName || `${historyCap?.neckType} - ${historyCap?.color}`}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Available Stock: <span className="font-semibold text-emerald-600">{historyCap?.quantityAvailable || 0} Nos</span>
                    {getPcsPerBag(historyCap?.neckType) > 0 && (
                      <span className="font-semibold text-amber-600 ml-1">
                        (≈ {((historyCap?.quantityAvailable || 0) / getPcsPerBag(historyCap?.neckType)).toFixed(2)} Bags)
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-auto flex-1 p-6">
              {historyLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
                </div>
              ) : historyError ? (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-center">
                  {historyError}
                </div>
              ) : historyData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <History className="h-12 w-12 mb-3 opacity-30" />
                  <p className="font-medium text-sm">No transaction history found for this cap.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Action / Type</th>
                        <th className="px-4 py-3 text-right">Quantity (Nos)</th>
                        <th className="px-4 py-3 text-right">Quantity (Bags)</th>
                        <th className="px-4 py-3">Details / Remarks</th>
                        <th className="px-4 py-3">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {historyData.map((item, index) => {
                        const isPositive = Number(item.quantity) > 0;
                        const pcs = getPcsPerBag(historyCap?.neckType);
                        const bagQty = pcs > 0 ? (Number(item.quantity) / pcs) : null;
                        return (
                          <tr key={item._id || index} className="hover:bg-amber-50/30 transition-colors">
                            <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                              {new Date(item.date).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {getActionBadge(item.changeType)}
                            </td>
                            <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                              <span className={isPositive ? 'text-emerald-600' : 'text-red-600'}>
                                {isPositive ? `+${Number(item.quantity).toLocaleString()}` : Number(item.quantity).toLocaleString()} Nos
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                              {bagQty !== null ? (
                                <span className={isPositive ? 'text-emerald-700' : 'text-red-700'}>
                                  {isPositive ? `+${bagQty.toFixed(2)}` : bagQty.toFixed(2)} Bags
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs font-normal">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700 max-w-xs">
                              {item.remarks || '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {item.recordedBy || 'System'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ──────────────────────────────────── */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4"
          onClick={handleDeleteCancel}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-xl"><Trash2 className="h-5 w-5 text-red-600" /></div>
              <h3 className="text-lg font-semibold text-gray-800">Confirm Deletion</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete this cap?</p>
            {capToDelete && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><p className="text-xs text-gray-400">Neck Type</p><p className="font-semibold text-gray-800">{capToDelete.neckType}</p></div>
                  <div><p className="text-xs text-gray-400">Color</p><p className="font-semibold text-gray-800">{capToDelete.color}</p></div>
                  <div><p className="text-xs text-gray-400">Available</p><p className="font-semibold text-gray-800">{capToDelete.quantityAvailable || 0} Nos</p></div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-sm font-medium text-red-600 mb-4">
              <AlertTriangle className="h-4 w-4" /> This action cannot be undone.
            </div>
            <div className="flex gap-3">
              <button onClick={handleDeleteCancel} disabled={loading}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-60">Cancel</button>
              <button onClick={handleDeleteConfirm} disabled={loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60">
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
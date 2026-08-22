import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, AlertTriangle, Layers, History, ArrowUpRight, ArrowDownRight, RefreshCw, ChevronRight, CheckCircle2 } from 'lucide-react';
import {
  getPreformTypeList,
  addPreformType,
  updatePreformType,
  deletePreformType,
  adjustPreformStock,
  getPreformTypeHistory
} from '../../services/api/stock';

const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-colors";
const labelCls = "block text-sm font-medium text-gray-700 mb-1.5";

export default function PreformTypes() {
  const [preformTypes, setPreformTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add / Edit & Adjustment modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  const [activeTab, setActiveTab] = useState('adjust'); // 'adjust' | 'info'
  const [currentPreform, setCurrentPreform] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    initialStockKg: '',
    changeType: 'addition', // 'addition' | 'reduction' | 'set_value'
    quantityKg: '',
    notes: ''
  });

  // History modal
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyPreform, setHistoryPreform] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  useEffect(() => { fetchTypes(); }, []);

  const fetchTypes = async () => {
    setLoading(true); setError('');
    try {
      const res = await getPreformTypeList();
      const data = res?.data || [];
      setPreformTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to fetch preform types');
    } finally { setLoading(false); }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setCurrentId(null);
    setCurrentPreform(null);
    setActiveTab('info');
    setFormData({
      name: '',
      description: '',
      initialStockKg: '',
      changeType: 'addition',
      quantityKg: '',
      notes: ''
    });
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setIsEditMode(true);
    setCurrentId(item._id);
    setCurrentPreform(item);
    setActiveTab('adjust');
    setFormData({
      name: item.name,
      description: item.description || '',
      initialStockKg: '',
      changeType: 'addition',
      quantityKg: '',
      notes: ''
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({
      name: '',
      description: '',
      initialStockKg: '',
      changeType: 'addition',
      quantityKg: '',
      notes: ''
    });
    setError('');
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');

      if (!isEditMode) {
        if (!formData.name.trim()) { setError('Preform type name is required'); setLoading(false); return; }
        await addPreformType({
          name: formData.name,
          description: formData.description,
          initialStockKg: formData.initialStockKg ? Number(formData.initialStockKg) : 0
        });
        setSuccess('Preform type added successfully!');
      } else {
        if (activeTab === 'adjust') {
          if (!formData.quantityKg || Number(formData.quantityKg) < 0) {
            setError('Please enter a valid non-negative quantity in Kg');
            setLoading(false);
            return;
          }
          await adjustPreformStock(currentId, {
            changeType: formData.changeType,
            quantityKg: Number(formData.quantityKg),
            notes: formData.notes,
            description: formData.description
          });
          setSuccess('Preform stock adjusted successfully!');
        } else {
          if (!formData.name.trim()) { setError('Preform type name is required'); setLoading(false); return; }
          await updatePreformType(currentId, {
            name: formData.name,
            description: formData.description
          });
          setSuccess('Preform type updated successfully!');
        }
      }

      closeModal();
      await fetchTypes();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || `Failed to ${isEditMode ? 'save' : 'add'} preform type`);
    } finally { setLoading(false); }
  };

  // Open Preform History
  const openHistoryModal = async (item) => {
    setHistoryPreform(item);
    setIsHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError('');
    setHistoryData([]);

    try {
      const res = await getPreformTypeHistory(item._id);
      if (res?.success) {
        setHistoryData(res.data?.history || []);
      } else {
        setHistoryError(res?.message || 'No history found');
      }
    } catch (err) {
      setHistoryError(err.message || 'Failed to fetch preform history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteClick = (item) => { setItemToDelete(item); setDeleteDialogOpen(true); };
  const handleDeleteCancel = () => { setDeleteDialogOpen(false); setItemToDelete(null); };
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      setLoading(true); setError('');
      await deletePreformType(itemToDelete._id);
      setSuccess('Preform type deleted!');
      await fetchTypes(); setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to delete preform type');
    } finally { setLoading(false); setDeleteDialogOpen(false); setItemToDelete(null); }
  };

  const normalizeItem = (item) => {
    if (typeof item === 'string') return { _id: item, name: item, description: '', isActive: true, totalAvailableKg: 0 };
    return {
      ...item,
      _id: item._id,
      name: item.name || item.type,
      description: item.description || '',
      totalAvailableKg: item.totalAvailableKg ?? 0
    };
  };

  const getActionBadge = (changeType) => {
    switch (changeType) {
      case 'addition':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><ArrowUpRight className="w-3 h-3" /> Addition</span>;
      case 'reduction':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"><ArrowDownRight className="w-3 h-3" /> Reduction</span>;
      case 'set_value':
      case 'adjustment':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200"><RefreshCw className="w-3 h-3" /> Set Value</span>;
      case 'deduction':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Layers className="w-3 h-3" /> Bottle Production</span>;
      case 'initial':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200"><CheckCircle2 className="w-3 h-3" /> Initial Stock</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 capitalize">{changeType}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl"><Layers className="h-6 w-6 text-amber-600" /></div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Preform Types</h1>
              <p className="text-sm text-slate-500 mt-0.5">{preformTypes.length} types defined</p>
            </div>
          </div>
          <button onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors shadow-sm">
            <Plus className="h-4 w-4" /> Add Preform Type
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

        {/* Loading */}
        {loading && preformTypes.length === 0 && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-amber-200 border-t-amber-500 rounded-full" />
          </div>
        )}

        {/* Cards Grid */}
        {!loading && preformTypes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {preformTypes.map((raw, idx) => {
              const item = normalizeItem(raw);
              return (
                <div key={item._id || idx} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-amber-100 rounded-xl shrink-0">
                          <Layers className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-base leading-snug">{item.name}</p>
                          {item.isActive !== undefined && (
                            <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${item.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'}`}>
                              {item.isActive ? 'Active' : 'Inactive'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => openHistoryModal(item)}
                          title="View Preform History"
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        >
                          <History className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(item)}
                          title="Edit & Adjust Stock"
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(item)}
                          title="Delete Preform Type"
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {item.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">{item.description}</p>
                    )}

                    <div className="mt-3 p-3 bg-amber-50/60 rounded-xl border border-amber-100 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-600">Available Stock:</span>
                      <span className="text-base font-bold text-emerald-600">
                        {Number(item.totalAvailableKg).toFixed(2)} Kg
                      </span>
                    </div>
                  </div>

                  <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                    <button
                      onClick={() => openHistoryModal(item)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                    >
                      <History className="w-3.5 h-3.5" /> View History <ChevronRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1 transition-colors"
                    >
                      Adjust Stock <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && preformTypes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Layers className="h-14 w-14 mb-4 opacity-30" />
            <p className="font-medium">No preform types defined. Add one to get started!</p>
          </div>
        )}
      </div>

      {/* ── Add / Edit & Stock Adjustment Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4"
          onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {isEditMode ? `Edit & Adjust: ${currentPreform?.name}` : 'Add Preform Type'}
                </h3>
                {isEditMode && currentPreform && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Current Stock: <span className="font-semibold text-emerald-600">{Number(currentPreform.totalAvailableKg || 0).toFixed(2)} Kg</span>
                  </p>
                )}
              </div>
              <button onClick={closeModal} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Tabs for Edit */}
            {isEditMode && (
              <div className="flex border-b border-gray-200 bg-gray-50 px-6 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('adjust')}
                  className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'adjust'
                      ? 'border-amber-500 text-amber-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Stock Adjustment
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('info')}
                  className={`pb-2.5 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'info'
                      ? 'border-amber-500 text-amber-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Type Details
                </button>
              </div>
            )}

            <div className="p-6 space-y-4">
              {(!isEditMode || activeTab === 'info') && (
                <>
                  <div>
                    <label className={labelCls}>Name <span className="text-red-500">*</span></label>
                    <input
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={inputCls}
                      placeholder="e.g. nn 500ml 9.12 gm"
                    />
                    <p className="text-xs text-gray-400 mt-1">Unique identifier for this preform type</p>
                  </div>
                  {!isEditMode && (
                    <div>
                      <label className={labelCls}>Initial Stock (Kg)</label>
                      <input
                        name="initialStockKg"
                        type="number"
                        step="0.01"
                        value={formData.initialStockKg}
                        onChange={handleInputChange}
                        className={inputCls}
                        placeholder="e.g. 500"
                      />
                      <p className="text-xs text-gray-400 mt-1">Leave empty or 0 if starting with no stock.</p>
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      rows={3}
                      className={`${inputCls} resize-none`}
                      placeholder="e.g. Standard bottle neck preform specification"
                    />
                  </div>
                </>
              )}

              {isEditMode && activeTab === 'adjust' && (
                <div className="space-y-4">
                  <div>
                    <label className={labelCls}>Adjustment Action <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, changeType: 'addition' }))}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${formData.changeType === 'addition'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                        Addition (+)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, changeType: 'reduction' }))}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${formData.changeType === 'reduction'
                            ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-200'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        <ArrowDownRight className="w-4 h-4 text-red-600" />
                        Reduction (-)
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, changeType: 'set_value' }))}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition-all ${formData.changeType === 'set_value'
                            ? 'bg-purple-50 border-purple-500 text-purple-700 ring-2 ring-purple-200'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                      >
                        <RefreshCw className="w-4 h-4 text-purple-600" />
                        Set Value (=)
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>
                      {formData.changeType === 'addition' && 'Quantity to Add (Kg) *'}
                      {formData.changeType === 'reduction' && 'Quantity to Reduce (Kg) *'}
                      {formData.changeType === 'set_value' && 'New Target Stock (Kg) *'}
                    </label>
                    <input
                      name="quantityKg"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.quantityKg}
                      onChange={handleInputChange}
                      className={inputCls}
                      placeholder={formData.changeType === 'set_value' ? `e.g. ${currentPreform?.totalAvailableKg || 0}` : 'e.g. 50'}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>Notes / Remarks</label>
                    <input
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      className={inputCls}
                      placeholder="e.g. Physical inventory adjustment / Supplier batch"
                    />
                  </div>
                </div>
              )}

              {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60 shadow-sm"
              >
                {loading ? 'Processing...' : isEditMode ? (activeTab === 'adjust' ? 'Apply Adjustment' : 'Update Type') : 'Add Preform Type'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preform History Modal ── */}
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
                    History: {historyPreform?.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Available Stock: <span className="font-semibold text-emerald-600">{Number(historyPreform?.totalAvailableKg || 0).toFixed(2)} Kg</span>
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
                  <p className="font-medium text-sm">No transaction history found for this preform type.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/80 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Action / Type</th>
                        <th className="px-4 py-3 text-right">Quantity (Kg)</th>
                        <th className="px-4 py-3">Details / Notes</th>
                        <th className="px-4 py-3">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {historyData.map((item, index) => {
                        const isPositive = Number(item.quantityKg) > 0;
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
                                {isPositive ? `+${Number(item.quantityKg).toFixed(2)}` : Number(item.quantityKg).toFixed(2)} Kg
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700 max-w-xs">
                              {item.notes || '—'}
                              {item.rejectionsKg > 0 && (
                                <span className="block text-[11px] text-red-500 mt-0.5">
                                  Rejections: {Number(item.rejectionsKg).toFixed(2)} Kg
                                </span>
                              )}
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

      {/* ── Delete Confirmation ── */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4"
          onClick={handleDeleteCancel}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-xl"><Trash2 className="h-5 w-5 text-red-600" /></div>
              <h3 className="text-lg font-semibold text-gray-800">Confirm Deletion</h3>
            </div>
            <p className="text-sm text-gray-600 mb-4">Delete preform type <strong>{itemToDelete?.name}</strong>?</p>
            <div className="flex items-center gap-1.5 text-sm font-medium text-red-600 mb-5">
              <AlertTriangle className="h-4 w-4" /> This action cannot be undone.
            </div>
            <div className="flex gap-3">
              <button onClick={handleDeleteCancel} disabled={loading}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-60">Cancel</button>
              <button onClick={handleDeleteConfirm} disabled={loading}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium disabled:opacity-60">
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
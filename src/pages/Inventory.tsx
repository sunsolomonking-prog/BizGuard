import React from 'react';
import {
  Plus,
  Search,
  Filter,
  Package,
  AlertTriangle,
  TrendingUp,
  Edit2,
  Trash2,
  PlusCircle,
  MinusCircle,
  Download,
  RefreshCw,
  X,
  Save,
  Camera,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';
import { formatCurrency } from '../utils/helpers';
import { bizguardDebug, supabase } from '../lib/supabase';
import { ensureBusinessContext, toAppBusiness } from '../lib/business';
import { useAppStore } from '../store';
import type { Database } from '../lib/database.types';
import SmartSnapModal from '../components/capture/SmartSnapModal';
import type { VisionAnalysisResult } from '../lib/visionInventory';

type ProductRow = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];
type StockMovementInsert = Database['public']['Tables']['stock_movements']['Insert'];

type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';
type ProductFormMode = 'create' | 'edit';
type AdjustmentType = 'in' | 'out' | 'adjustment';

interface ProductView extends ProductRow {
  stockValue: number;
  status: StockStatus;
}

interface ProductFormState {
  name: string;
  sku: string;
  category: string;
  description: string;
  cost_price: string;
  selling_price: string;
  quantity: string;
  reorder_level: string;
  supplier: string;
  barcode: string;
  images: string;
}

interface AdjustmentFormState {
  type: AdjustmentType;
  quantity: string;
  reason: string;
  reference: string;
}

const emptyProductForm: ProductFormState = {
  name: '',
  sku: '',
  category: '',
  description: '',
  cost_price: '0',
  selling_price: '0',
  quantity: '0',
  reorder_level: '10',
  supplier: '',
  barcode: '',
  images: '',
};

const emptyAdjustmentForm: AdjustmentFormState = {
  type: 'in',
  quantity: '1',
  reason: '',
  reference: '',
};

const statusColors: Record<StockStatus, string> = {
  in_stock: 'bg-green-100 text-green-700',
  low_stock: 'bg-yellow-100 text-yellow-700',
  out_of_stock: 'bg-red-100 text-red-700',
};

const statusLabel: Record<StockStatus, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
};

const toNumber = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseImages = (value: string) =>
  value
    .split('\n')
    .map((url) => url.trim())
    .filter(Boolean);

const getStockStatus = (quantity: number, reorderLevel: number): StockStatus => {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= reorderLevel) return 'low_stock';
  return 'in_stock';
};

const toProductView = (product: ProductRow): ProductView => ({
  ...product,
  stockValue: Number(product.cost_price) * product.quantity,
  status: getStockStatus(product.quantity, product.reorder_level),
});

const toProductForm = (product: ProductRow): ProductFormState => ({
  name: product.name,
  sku: product.sku,
  category: product.category,
  description: product.description || '',
  cost_price: String(product.cost_price),
  selling_price: String(product.selling_price),
  quantity: String(product.quantity),
  reorder_level: String(product.reorder_level),
  supplier: product.supplier || '',
  barcode: product.barcode || '',
  images: (product.images || []).join('\n'),
});

export const Inventory: React.FC = () => {
  const { currentBusiness, user, setCurrentBusiness, setBusinesses } = useAppStore();
  const [products, setProducts] = React.useState<ProductView[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [stockFilter, setStockFilter] = React.useState<string>('all');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [productFormMode, setProductFormMode] = React.useState<ProductFormMode>('create');
  const [selectedProduct, setSelectedProduct] = React.useState<ProductView | null>(null);
  const [showProductModal, setShowProductModal] = React.useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = React.useState(false);
  const [productForm, setProductForm] = React.useState<ProductFormState>(emptyProductForm);
  const [adjustmentForm, setAdjustmentForm] = React.useState<AdjustmentFormState>(emptyAdjustmentForm);
  const [showSmartSnap, setShowSmartSnap] = React.useState(false);

  const businessId = currentBusiness?.id;

  const resolveBusinessId = React.useCallback(async () => {
    if (currentBusiness?.id) {
      bizguardDebug('Inventory.resolveBusinessId.fromStore', { currentBusinessId: currentBusiness.id, currentBusinessName: currentBusiness.name });
      return currentBusiness.id;
    }

    const context = await ensureBusinessContext();
    bizguardDebug('Inventory.resolveBusinessId.context', { userId: context.user?.id || null, profileBusinessId: context.profile?.business_id || null, loadedBusinessId: context.business?.id || null });
    if (!context.business) return null;

    const appBusiness = toAppBusiness(context.business);
    setCurrentBusiness(appBusiness);
    setBusinesses([appBusiness]);
    return appBusiness.id;
  }, [currentBusiness?.id, setBusinesses, setCurrentBusiness]);

  const loadProducts = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const resolvedBusinessId = await resolveBusinessId();
    bizguardDebug('Inventory.loadProducts.resolvedBusinessId', { resolvedBusinessId, storeBusinessId: currentBusiness?.id || null });
    if (!resolvedBusinessId) {
      bizguardDebug('Inventory.noBusinessContext', { business_id: resolvedBusinessId, error: 'No resolved business id' });
      setProducts([]);
      setIsLoading(false);
      setError('BizGuard could not create or load your business workspace. Please contact support.');
      return;
    }

    bizguardDebug('Inventory.productsQuery.start', { business_id: resolvedBusinessId });

    const productsResult = await supabase
      .from('products')
      .select('*')
      .eq('business_id', resolvedBusinessId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    const queryError = productsResult.error;
    if (queryError) {
      setError(queryError.message);
      toast.error(`Could not load inventory: ${queryError.message}`);
      bizguardDebug('Inventory.productsQuery.error', { business_id: resolvedBusinessId, error: queryError.message });
      setProducts([]);
    } else {
      bizguardDebug('Inventory.productsQuery.success', { business_id: resolvedBusinessId, products: productsResult.data?.length || 0 });
      setProducts((productsResult.data || []).map(toProductView));
    }

    setIsLoading(false);
  }, [resolveBusinessId]);

  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  React.useEffect(() => {
    if (!businessId) return undefined;

    const channel = supabase
      .channel(`inventory-products-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          loadProducts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, loadProducts]);

  const categories = React.useMemo(
    () => Array.from(new Set(products.map((product) => product.category))).sort(),
    [products],
  );

  const filteredProducts = React.useMemo(() => {
    return products.filter((product) => {
      const normalizedSearch = searchTerm.toLowerCase();
      const matchesSearch =
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.sku.toLowerCase().includes(normalizedSearch) ||
        (product.barcode || '').toLowerCase().includes(normalizedSearch) ||
        (product.supplier || '').toLowerCase().includes(normalizedSearch);
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      const matchesStock = stockFilter === 'all' || product.status === stockFilter;
      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, searchTerm, categoryFilter, stockFilter]);

  const totalValue = filteredProducts.reduce((sum, product) => sum + product.stockValue, 0);
  const lowStockCount = filteredProducts.filter((product) => product.status === 'low_stock' || product.status === 'out_of_stock').length;
  const deadStockCount = filteredProducts.filter((product) => product.quantity > product.reorder_level * 4).length;
  const slowMovingCount = filteredProducts.filter((product) => product.quantity > product.reorder_level * 2 && product.quantity <= product.reorder_level * 4).length;
  const expiringProductsCount = 0;

  const openCreateModal = () => {
    setProductFormMode('create');
    setSelectedProduct(null);
    setProductForm(emptyProductForm);
    setShowProductModal(true);
  };

  const openEditModal = (product: ProductView) => {
    setProductFormMode('edit');
    setSelectedProduct(product);
    setProductForm(toProductForm(product));
    setShowProductModal(true);
  };

  const openAdjustmentModal = (product: ProductView, type: AdjustmentType) => {
    setSelectedProduct(product);
    setAdjustmentForm({ ...emptyAdjustmentForm, type });
    setShowAdjustmentModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setSelectedProduct(null);
    setProductForm(emptyProductForm);
  };

  const closeAdjustmentModal = () => {
    setShowAdjustmentModal(false);
    setSelectedProduct(null);
    setAdjustmentForm(emptyAdjustmentForm);
  };

  const ensureLowStockAlert = async (product: ProductView | ProductRow) => {
    if (!businessId || product.quantity > product.reorder_level) return;

    const { data: existingAlert } = await supabase
      .from('alerts')
      .select('id')
      .eq('business_id', businessId)
      .eq('type', 'low_stock')
      .eq('is_read', false)
      .ilike('message', `%${product.name}%`)
      .limit(1);

    if (existingAlert && existingAlert.length > 0) return;

    await supabase.from('alerts').insert({
      business_id: businessId,
      type: 'low_stock',
      severity: product.quantity <= 0 ? 'error' : 'warning',
      title: `Low stock: ${product.name}`,
      message: `${product.name} has ${product.quantity} units remaining. Reorder level is ${product.reorder_level}.`,
      action_url: '/inventory',
    });
  };

  const buildProductPayload = (): Omit<ProductInsert, 'business_id'> => ({
    name: productForm.name.trim(),
    sku: productForm.sku.trim(),
    category: productForm.category.trim() || 'General',
    description: productForm.description.trim() || null,
    cost_price: toNumber(productForm.cost_price),
    selling_price: toNumber(productForm.selling_price),
    quantity: Math.max(0, Math.floor(toNumber(productForm.quantity))),
    reorder_level: Math.max(0, Math.floor(toNumber(productForm.reorder_level, 10))),
    supplier: productForm.supplier.trim() || null,
    barcode: productForm.barcode.trim() || null,
    images: parseImages(productForm.images),
    is_active: true,
  });

  const validateProductForm = () => {
    if (!productForm.name.trim()) return 'Product name is required.';
    if (!productForm.sku.trim()) return 'SKU is required.';
    if (toNumber(productForm.cost_price) < 0) return 'Cost price cannot be negative.';
    if (toNumber(productForm.selling_price) < 0) return 'Selling price cannot be negative.';
    if (toNumber(productForm.quantity) < 0) return 'Quantity cannot be negative.';
    if (toNumber(productForm.reorder_level) < 0) return 'Reorder level cannot be negative.';
    return null;
  };

  const handleSaveProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!businessId) {
      toast.error('No business is selected.');
      return;
    }

    const validationError = validateProductForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSaving(true);
    const payload = buildProductPayload();

    if (productFormMode === 'create') {
      const { data, error: insertError } = await supabase
        .from('products')
        .insert({ ...payload, business_id: businessId })
        .select('*')
        .single();

      if (insertError) {
        toast.error(`Could not create product: ${insertError.message}`);
        setIsSaving(false);
        return;
      }

      if (data && data.quantity > 0) {
        await supabase.from('stock_movements').insert({
          business_id: businessId,
          product_id: data.id,
          type: 'in',
          quantity: data.quantity,
          reason: 'Initial stock on product creation',
          reference: data.sku,
          created_by: user?.id || null,
        } satisfies StockMovementInsert);
      }

      if (data) await ensureLowStockAlert(data);
      toast.success('Product created successfully');
    } else if (selectedProduct) {
      const updatePayload: ProductUpdate = payload;
      const { data, error: updateError } = await supabase
        .from('products')
        .update(updatePayload)
        .eq('id', selectedProduct.id)
        .eq('business_id', businessId)
        .select('*')
        .single();

      if (updateError) {
        toast.error(`Could not update product: ${updateError.message}`);
        setIsSaving(false);
        return;
      }

      if (data) await ensureLowStockAlert(data);
      toast.success('Product updated successfully');
    }

    closeProductModal();
    await loadProducts();
    setIsSaving(false);
  };

  const handleDeleteProduct = async (product: ProductView) => {
    if (!businessId) return;
    const confirmed = window.confirm(`Delete ${product.name}? This archives the product and hides it from active inventory.`);
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', product.id)
      .eq('business_id', businessId);

    if (deleteError) {
      toast.error(`Could not delete product: ${deleteError.message}`);
      return;
    }

    toast.success('Product deleted');
    await loadProducts();
  };

  const handleSaveAdjustment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!businessId || !selectedProduct) return;

    const adjustmentQuantity = Math.floor(toNumber(adjustmentForm.quantity));
    if (adjustmentQuantity <= 0) {
      toast.error('Adjustment quantity must be greater than zero.');
      return;
    }

    if (!adjustmentForm.reason.trim()) {
      toast.error('Please provide a reason for this stock adjustment.');
      return;
    }

    const nextQuantity =
      adjustmentForm.type === 'in'
        ? selectedProduct.quantity + adjustmentQuantity
        : adjustmentForm.type === 'out'
          ? selectedProduct.quantity - adjustmentQuantity
          : adjustmentQuantity;

    if (nextQuantity < 0) {
      toast.error('Stock cannot be reduced below zero.');
      return;
    }

    const movementQuantity = adjustmentForm.type === 'out'
      ? -adjustmentQuantity
      : adjustmentForm.type === 'adjustment'
        ? nextQuantity - selectedProduct.quantity
        : adjustmentQuantity;

    setIsSaving(true);

    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update({ quantity: nextQuantity })
      .eq('id', selectedProduct.id)
      .eq('business_id', businessId)
      .select('*')
      .single();

    if (updateError) {
      toast.error(`Could not adjust stock: ${updateError.message}`);
      setIsSaving(false);
      return;
    }

    const movement: StockMovementInsert = {
      business_id: businessId,
      product_id: selectedProduct.id,
      type: adjustmentForm.type,
      quantity: movementQuantity,
      reason: adjustmentForm.reason.trim(),
      reference: adjustmentForm.reference.trim() || null,
      created_by: user?.id || null,
    };

    const { error: movementError } = await supabase.from('stock_movements').insert(movement);

    if (movementError) {
      toast.error(`Stock changed, but movement history failed: ${movementError.message}`);
    } else {
      toast.success('Stock adjusted successfully');
    }

    if (updatedProduct) await ensureLowStockAlert(updatedProduct);
    closeAdjustmentModal();
    await loadProducts();
    setIsSaving(false);
  };

  const applySmartSnap = async (result: VisionAnalysisResult) => {
    if (!businessId) return;
    setIsSaving(true);
    try {
      let applied = 0;
      for (const detection of result.detections) {
        const normalized = detection.name.trim().toLowerCase();
        const matched = products.find((product) => (detection.product_id && product.id === detection.product_id) || (detection.barcode && product.barcode === detection.barcode) || product.name.trim().toLowerCase() === normalized);
        if (matched) {
          const nextQuantity = matched.quantity + detection.quantity;
          const { error: updateError } = await supabase.from('products').update({ quantity: nextQuantity }).eq('id', matched.id).eq('business_id', businessId);
          if (updateError) throw updateError;
          await supabase.from('stock_movements').insert({ business_id: businessId, product_id: matched.id, type: 'in', quantity: detection.quantity, reason: 'Smart Snap inventory count', reference: detection.barcode || null, created_by: user?.id || null });
          applied += 1;
        } else {
          const sku = `SNAP-${Date.now().toString(36).toUpperCase()}-${applied + 1}`;
          const { data: created, error: createError } = await supabase.from('products').insert({ business_id: businessId, name: detection.name, sku, category: detection.category || 'Uncategorized', description: 'Created from Smart Snap. Verify pricing and product details.', cost_price: 0, selling_price: 0, quantity: detection.quantity, reorder_level: 10, supplier: null, barcode: detection.barcode || null, images: null, is_active: true }).select('*').single();
          if (createError) throw createError;
          if (created) await supabase.from('stock_movements').insert({ business_id: businessId, product_id: created.id, type: 'in', quantity: detection.quantity, reason: 'Smart Snap initial count', reference: detection.barcode || null, created_by: user?.id || null });
          applied += 1;
        }
      }
      toast.success(`${applied} Smart Snap item${applied === 1 ? '' : 's'} added to inventory.`);
      setShowSmartSnap(false);
      await loadProducts();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not apply Smart Snap inventory result.');
    } finally {
      setIsSaving(false);
    }
  };

  const exportProducts = () => {
    const headers = ['Name', 'SKU', 'Category', 'Quantity', 'Reorder Level', 'Cost Price', 'Selling Price', 'Stock Value', 'Supplier', 'Barcode', 'Status'];
    const rows = filteredProducts.map((product) => [
      product.name,
      product.sku,
      product.category,
      String(product.quantity),
      String(product.reorder_level),
      String(product.cost_price),
      String(product.selling_price),
      String(product.stockValue),
      product.supplier || '',
      product.barcode || '',
      statusLabel[product.status],
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bizguard-inventory-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-slate-500 mt-1">Manage your products and stock levels</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadProducts}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Refresh
          </button>
          <button
            onClick={exportProducts}
            disabled={filteredProducts.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowSmartSnap(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-950 text-white rounded-lg text-sm font-black hover:bg-slate-800 transition-colors"
          >
            <Camera className="w-4 h-4" />
            Snap Count
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:from-emerald-600 hover:from-cyan-600 transition-all shadow-lg shadow-emerald-500/25"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <p className="font-medium">Inventory error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Total Products</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{filteredProducts.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Stock Value</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{formatCurrency(totalValue)}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Low Stock</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{lowStockCount}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Categories</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{categories.length}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Filter className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 rounded-xl p-5 border border-emerald-100"><p className="text-sm text-slate-500">Fast Moving Products</p><p className="text-2xl font-bold text-emerald-700">{Math.max(0, filteredProducts.length - slowMovingCount - deadStockCount - lowStockCount)}</p></div>
        <div className="bg-white rounded-xl p-5 border border-slate-200"><p className="text-sm text-slate-500">Slow Moving</p><p className="text-2xl font-bold text-yellow-600">{slowMovingCount}</p></div>
        <div className="bg-white rounded-xl p-5 border border-slate-200"><p className="text-sm text-slate-500">Dead Stock Risk</p><p className="text-2xl font-bold text-red-600">{deadStockCount}</p></div>
        <div className="bg-white rounded-xl p-5 border border-slate-200"><p className="text-sm text-slate-500">Expiring Batches</p><p className="text-2xl font-bold text-orange-600">{expiringProductsCount}</p></div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products, SKUs, barcodes, suppliers..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="all">All Categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <select value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="all">All Stock</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Stock Value</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-500" />
                    Loading inventory...
                  </td>
                </tr>
              ) : filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                        {product.images && product.images.length > 0 ? <img src={product.images[0]} alt="" className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-400" />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{product.name}</p>
                        {product.supplier && <p className="text-xs text-slate-500">Supplier: {product.supplier}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-slate-600 font-mono text-sm">{product.sku}</span>
                    {product.barcode && <p className="text-xs text-slate-400 mt-1">{product.barcode}</p>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="text-slate-600">{product.category}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openAdjustmentModal(product, 'out')} className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Reduce stock">
                        <MinusCircle className="w-4 h-4" />
                      </button>
                      <span className={cn('font-medium w-12 text-center', product.quantity <= product.reorder_level ? 'text-red-600' : 'text-slate-800')}>{product.quantity}</span>
                      <button onClick={() => openAdjustmentModal(product, 'in')} className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="Add stock">
                        <PlusCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <p className="font-medium text-slate-800">{formatCurrency(Number(product.selling_price))}</p>
                      <p className="text-xs text-slate-500">Cost: {formatCurrency(Number(product.cost_price))}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="font-medium text-slate-800">{formatCurrency(product.stockValue)}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', statusColors[product.status])}>{statusLabel[product.status]}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openAdjustmentModal(product, 'adjustment')} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Set stock count">
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEditModal(product)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Edit product">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteProduct(product)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete product">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No products found</p>
            <button onClick={openCreateModal} className="mt-4 text-emerald-600 font-medium hover:text-emerald-700">Add your first product</button>
          </div>
        )}
      </div>

      <SmartSnapModal
        open={showSmartSnap}
        mode="inventory"
        businessId={businessId}
        knownProducts={products.map((product) => ({ id: product.id, name: product.name, sku: product.sku, barcode: product.barcode }))}
        onClose={() => setShowSmartSnap(false)}
        onApply={applySmartSnap}
      />

      {showProductModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSaveProduct}>
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{productFormMode === 'create' ? 'Add Product' : 'Edit Product'}</h2>
                  <p className="text-sm text-slate-500 mt-1">Manage product details, pricing, barcode, and stock thresholds.</p>
                </div>
                <button type="button" onClick={closeProductModal} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Product Name</span>
                  <input value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">SKU</span>
                  <input value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Category</span>
                  <input value={productForm.category} onChange={(event) => setProductForm({ ...productForm, category: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" placeholder="General" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Barcode</span>
                  <input value={productForm.barcode} onChange={(event) => setProductForm({ ...productForm, barcode: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Cost Price</span>
                  <input type="number" min="0" step="0.01" value={productForm.cost_price} onChange={(event) => setProductForm({ ...productForm, cost_price: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Selling Price</span>
                  <input type="number" min="0" step="0.01" value={productForm.selling_price} onChange={(event) => setProductForm({ ...productForm, selling_price: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Quantity</span>
                  <input type="number" min="0" step="1" value={productForm.quantity} onChange={(event) => setProductForm({ ...productForm, quantity: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Reorder Level</span>
                  <input type="number" min="0" step="1" value={productForm.reorder_level} onChange={(event) => setProductForm({ ...productForm, reorder_level: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Supplier</span>
                  <input value={productForm.supplier} onChange={(event) => setProductForm({ ...productForm, supplier: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Description</span>
                  <textarea value={productForm.description} onChange={(event) => setProductForm({ ...productForm, description: event.target.value })} rows={3} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Image URLs</span>
                  <textarea value={productForm.images} onChange={(event) => setProductForm({ ...productForm, images: event.target.value })} rows={3} placeholder="One image URL per line" className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
              </div>

              <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
                <button type="button" onClick={closeProductModal} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all disabled:opacity-50">
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAdjustmentModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg">
            <form onSubmit={handleSaveAdjustment}>
              <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Stock Adjustment</h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedProduct.name} · Current stock: {selectedProduct.quantity}</p>
                </div>
                <button type="button" onClick={closeAdjustmentModal} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 space-y-4">
                <label className="space-y-2 block">
                  <span className="text-sm font-medium text-slate-700">Adjustment Type</span>
                  <select value={adjustmentForm.type} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, type: event.target.value as AdjustmentType })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="in">Add stock</option>
                    <option value="out">Reduce stock</option>
                    <option value="adjustment">Set physical count</option>
                  </select>
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-medium text-slate-700">{adjustmentForm.type === 'adjustment' ? 'New Quantity' : 'Quantity'}</span>
                  <input type="number" min="1" step="1" value={adjustmentForm.quantity} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, quantity: event.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-medium text-slate-700">Reason</span>
                  <input value={adjustmentForm.reason} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, reason: event.target.value })} placeholder="Restock, damaged goods, physical count, etc." className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
                </label>
                <label className="space-y-2 block">
                  <span className="text-sm font-medium text-slate-700">Reference</span>
                  <input value={adjustmentForm.reference} onChange={(event) => setAdjustmentForm({ ...adjustmentForm, reference: event.target.value })} placeholder="Purchase order, note, barcode scan..." className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </label>
              </div>

              <div className="p-6 border-t border-slate-200 flex justify-end gap-2">
                <button type="button" onClick={closeAdjustmentModal} className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Save Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;

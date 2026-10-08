import React from 'react';
import {
  Plus,
  Search,
  Filter,
  Download,
  ShoppingCart,
  CreditCard,
  Wallet,
  Trash2,
  Eye,
  Printer,
  RefreshCw,
  X,
  UserPlus,
  Package,
  MinusCircle,
  PlusCircle,
  Camera,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../utils/cn';
import { formatCurrency, formatDate } from '../utils/helpers';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store';
import type { Database, Json } from '../lib/database.types';
import SmartSnapModal from '../components/capture/SmartSnapModal';
import type { VisionAnalysisResult } from '../lib/visionInventory';

type SaleRow = Database['public']['Tables']['sales']['Row'];
type SaleItemRow = Database['public']['Tables']['sale_items']['Row'];
type ProductRow = Database['public']['Tables']['products']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'credit';

type SaleStatus = 'completed' | 'pending' | 'refunded' | 'cancelled';

interface SaleView extends SaleRow {
  customerName: string;
  itemCount: number;
}

interface CartItem {
  product: ProductRow;
  quantity: number;
  discount: number;
}

interface NewCustomerForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  credit_limit: string;
}

const emptyCustomerForm: NewCustomerForm = {
  name: '',
  email: '',
  phone: '',
  address: '',
  credit_limit: '0',
};

const paymentIcons: Record<PaymentMethod, LucideIcon> = {
  cash: Wallet,
  bank_transfer: CreditCard,
  card: CreditCard,
  wallet: Wallet,
  credit: CreditCard,
};

const statusColors: Record<SaleStatus, string> = {
  completed: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  refunded: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

const toNumber = (value: string, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getSaleStatus = (status: string): SaleStatus => {
  if (status === 'pending' || status === 'refunded' || status === 'cancelled') return status;
  return 'completed';
};

export const Sales: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const businessId = currentBusiness?.id;

  const [sales, setSales] = React.useState<SaleView[]>([]);
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [customers, setCustomers] = React.useState<CustomerRow[]>([]);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [showNewSaleModal, setShowNewSaleModal] = React.useState(false);
  const [showCustomerForm, setShowCustomerForm] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string>('');
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('cash');
  const [selectedProductId, setSelectedProductId] = React.useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = React.useState('1');
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [saleDiscount, setSaleDiscount] = React.useState('0');
  const [saleTax, setSaleTax] = React.useState('0');
  const [dueDate, setDueDate] = React.useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    return date.toISOString().slice(0, 10);
  });
  const [newCustomer, setNewCustomer] = React.useState<NewCustomerForm>(emptyCustomerForm);
  const [showSmartSnap, setShowSmartSnap] = React.useState(false);

  const loadSales = React.useCallback(async () => {
    if (!businessId) {
      setSales([]);
      setError('No business is selected. Sign in again or create a business profile.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data: saleRows, error: salesError } = await supabase
      .from('sales')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (salesError) {
      setError(salesError.message);
      toast.error(`Could not load sales: ${salesError.message}`);
      setSales([]);
      setIsLoading(false);
      return;
    }

    const saleIds = (saleRows || []).map((sale) => sale.id);
    const customerIds = Array.from(new Set((saleRows || []).map((sale) => sale.customer_id).filter(Boolean))) as string[];

    const [itemsResult, customersResult] = await Promise.all([
      saleIds.length > 0
        ? supabase.from('sale_items').select('*').in('sale_id', saleIds)
        : Promise.resolve({ data: [] as SaleItemRow[], error: null }),
      customerIds.length > 0
        ? supabase.from('customers').select('*').in('id', customerIds)
        : Promise.resolve({ data: [] as CustomerRow[], error: null }),
    ]);

    if (itemsResult.error) toast.error(`Could not load sale items: ${itemsResult.error.message}`);
    if (customersResult.error) toast.error(`Could not load customers: ${customersResult.error.message}`);

    const itemCountBySale = new Map<string, number>();
    (itemsResult.data || []).forEach((item) => {
      itemCountBySale.set(item.sale_id, (itemCountBySale.get(item.sale_id) || 0) + item.quantity);
    });

    const customerById = new Map<string, CustomerRow>();
    (customersResult.data || []).forEach((customer) => customerById.set(customer.id, customer));

    setSales((saleRows || []).map((sale) => ({
      ...sale,
      customerName: sale.customer_id ? customerById.get(sale.customer_id)?.name || 'Unknown customer' : 'Walk-in Customer',
      itemCount: itemCountBySale.get(sale.id) || 0,
    })));
    setIsLoading(false);
  }, [businessId]);

  const loadPosData = React.useCallback(async () => {
    if (!businessId) return;

    const [productsResult, customersResult] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .gt('quantity', 0)
        .order('name', { ascending: true }),
      supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name', { ascending: true }),
    ]);

    if (productsResult.error) {
      toast.error(`Could not load products: ${productsResult.error.message}`);
    } else {
      setProducts(productsResult.data || []);
      if (!selectedProductId && productsResult.data && productsResult.data.length > 0) {
        setSelectedProductId(productsResult.data[0].id);
      }
    }

    if (customersResult.error) {
      toast.error(`Could not load customers: ${customersResult.error.message}`);
    } else {
      setCustomers(customersResult.data || []);
    }
  }, [businessId, selectedProductId]);

  React.useEffect(() => {
    loadSales();
    loadPosData();
  }, [loadSales, loadPosData]);

  React.useEffect(() => {
    if (!businessId) return undefined;

    const channel = supabase
      .channel(`sales-v2-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `business_id=eq.${businessId}` }, () => loadSales())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [businessId, loadSales]);

  const filteredSales = React.useMemo(() => {
    return sales.filter((sale) => {
      const normalizedSearch = searchTerm.toLowerCase();
      const matchesSearch =
        sale.invoice_number.toLowerCase().includes(normalizedSearch) ||
        sale.customerName.toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === 'all' || sale.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sales, searchTerm, statusFilter]);

  const subtotal = cart.reduce((sum, item) => sum + Number(item.product.selling_price) * item.quantity, 0);
  const itemDiscountTotal = cart.reduce((sum, item) => sum + item.discount, 0);
  const totalDiscount = toNumber(saleDiscount) + itemDiscountTotal;
  const tax = toNumber(saleTax);
  const total = Math.max(subtotal + tax - totalDiscount, 0);
  const totalSales = filteredSales.reduce((sum, sale) => sum + Number(sale.total), 0);

  const resetPosForm = () => {
    setSelectedCustomerId('');
    setPaymentMethod('cash');
    setSelectedProductId(products[0]?.id || '');
    setSelectedQuantity('1');
    setCart([]);
    setSaleDiscount('0');
    setSaleTax('0');
    setShowCustomerForm(false);
    setNewCustomer(emptyCustomerForm);
  };

  const openNewSale = () => {
    resetPosForm();
    setShowNewSaleModal(true);
    loadPosData();
  };

  const closeNewSale = () => {
    setShowNewSaleModal(false);
    resetPosForm();
  };

  const addProductToCart = () => {
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) {
      toast.error('Select a product to add.');
      return;
    }

    const quantity = Math.floor(toNumber(selectedQuantity, 1));
    if (quantity <= 0) {
      toast.error('Quantity must be greater than zero.');
      return;
    }

    const existingQuantity = cart.find((item) => item.product.id === product.id)?.quantity || 0;
    if (existingQuantity + quantity > product.quantity) {
      toast.error(`Insufficient stock. ${product.name} has ${product.quantity} units available.`);
      return;
    }

    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...current, { product, quantity, discount: 0 }];
    });
    setSelectedQuantity('1');
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    setCart((current) => current.map((item) => {
      if (item.product.id !== productId) return item;
      const nextQuantity = Math.max(1, Math.min(quantity, item.product.quantity));
      return { ...item, quantity: nextQuantity };
    }));
  };

  const updateCartDiscount = (productId: string, discount: number) => {
    setCart((current) => current.map((item) => {
      if (item.product.id !== productId) return item;
      const maxLineTotal = Number(item.product.selling_price) * item.quantity;
      return { ...item, discount: Math.max(0, Math.min(discount, maxLineTotal)) };
    }));
  };

  const removeCartItem = (productId: string) => {
    setCart((current) => current.filter((item) => item.product.id !== productId));
  };

  const createCustomer = async () => {
    if (!businessId) return null;
    if (!newCustomer.name.trim()) {
      toast.error('Customer name is required.');
      return null;
    }

    const { data, error: customerError } = await supabase
      .from('customers')
      .insert({
        business_id: businessId,
        name: newCustomer.name.trim(),
        email: newCustomer.email.trim() || null,
        phone: newCustomer.phone.trim() || null,
        address: newCustomer.address.trim() || null,
        credit_limit: Math.max(0, toNumber(newCustomer.credit_limit)),
        is_active: true,
      })
      .select('*')
      .single();

    if (customerError) {
      toast.error(`Could not create customer: ${customerError.message}`);
      return null;
    }

    setCustomers((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedCustomerId(data.id);
    setShowCustomerForm(false);
    setNewCustomer(emptyCustomerForm);
    toast.success('Customer created and selected');
    return data;
  };

  const validateSale = () => {
    if (!businessId) return 'No business is selected.';
    if (cart.length === 0) return 'Add at least one product to the sale.';
    if (paymentMethod === 'credit' && !selectedCustomerId) return 'Credit sales require a selected customer.';
    if (totalDiscount > subtotal + tax) return 'Discount cannot exceed sale total.';
    if (tax < 0) return 'Tax cannot be negative.';
    if (toNumber(saleDiscount) < 0) return 'Discount cannot be negative.';
    return null;
  };

  const applySmartSnapToSale = async (result: VisionAnalysisResult) => {
    const nextCart: CartItem[] = [];
    const unmatched: string[] = [];
    for (const detection of result.detections) {
      const normalized = detection.name.trim().toLowerCase();
      const product = products.find((item) => (detection.product_id && item.id === detection.product_id) || (detection.barcode && item.barcode === detection.barcode) || item.name.trim().toLowerCase() === normalized);
      if (!product) { unmatched.push(detection.name); continue; }
      const quantity = Math.max(1, Math.floor(detection.quantity));
      const existing = nextCart.find((item) => item.product.id === product.id);
      const nextQuantity = (existing?.quantity || 0) + quantity;
      if (nextQuantity > product.quantity) {
        unmatched.push(`${product.name} (only ${product.quantity} in stock)`);
        continue;
      }
      if (existing) existing.quantity = nextQuantity;
      else nextCart.push({ product, quantity, discount: 0 });
    }
    if (!nextCart.length) {
      toast.error(`No detected items matched current stock. ${unmatched.length ? `Check: ${unmatched.join(', ')}` : ''}`);
      return;
    }
    setCart(nextCart);
    setShowSmartSnap(false);
    setShowNewSaleModal(true);
    await loadPosData();
    if (unmatched.length) toast(`Review needed for: ${unmatched.join(', ')}`, { icon: '⚠️' });
    else toast.success(`${nextCart.length} product${nextCart.length === 1 ? '' : 's'} added from Smart Snap. Review before checkout.`);
  };

  const createSale = async () => {
    const validationError = validateSale();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!businessId) return;

    setIsSaving(true);

    const items = cart.map((item) => ({
      product_id: item.product.id,
      quantity: item.quantity,
      discount: item.discount,
    })) as Json;

    const { error: saleError } = await supabase.rpc('create_pos_sale', {
      p_business_id: businessId,
      p_customer_id: selectedCustomerId || null,
      p_payment_method: paymentMethod,
      p_discount: toNumber(saleDiscount),
      p_tax: tax,
      p_due_date: paymentMethod === 'credit' ? dueDate : null,
      p_items: items,
    });

    if (saleError) {
      toast.error(`Could not create sale: ${saleError.message}`);
      setIsSaving(false);
      return;
    }

    toast.success('Sale completed successfully');
    closeNewSale();
    await Promise.all([loadSales(), loadPosData()]);
    setIsSaving(false);
  };


  const printReceipt = (sale: SaleView) => {
    const receiptWindow = window.open('', '_blank', 'width=420,height=720');
    if (!receiptWindow) {
      toast.error('Popup blocked. Allow popups to print receipts.');
      return;
    }
    receiptWindow.document.write(`
      <html><head><title>${sale.invoice_number}</title><style>
      body{font-family:Inter,Arial,sans-serif;padding:24px;color:#0f172a} h1{font-size:20px} .row{display:flex;justify-content:space-between;margin:8px 0}.total{font-weight:800;border-top:1px solid #ddd;padding-top:12px;margin-top:12px}
      </style></head><body><h1>BizGuard Receipt</h1><p>${currentBusiness?.name || 'Business'}</p><p>Invoice: ${sale.invoice_number}</p><p>Customer: ${sale.customerName}</p><p>Date: ${formatDate(sale.created_at)}</p><div class="row"><span>Payment</span><span>${sale.payment_method}</span></div><div class="row total"><span>Total</span><span>${formatCurrency(Number(sale.total))}</span></div><script>window.print()</script></body></html>
    `);
    receiptWindow.document.close();
  };

  const exportSales = () => {
    const headers = ['Invoice', 'Customer', 'Items', 'Payment', 'Status', 'Subtotal', 'Tax', 'Discount', 'Total', 'Date'];
    const rows = filteredSales.map((sale) => [
      sale.invoice_number,
      sale.customerName,
      String(sale.itemCount),
      sale.payment_method,
      sale.status,
      String(sale.subtotal),
      String(sale.tax),
      String(sale.discount),
      String(sale.total),
      sale.created_at,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bizguard-sales-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales</h1>
          <p className="text-slate-500 mt-1">Manage and track all your sales transactions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadSales} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
            Refresh
          </button>
          <button onClick={exportSales} disabled={filteredSales.length === 0} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button onClick={() => setShowSmartSnap(true)} className="flex items-center gap-2 px-4 py-2 bg-slate-950 text-white rounded-lg text-sm font-black hover:bg-slate-800 transition-colors">
            <Camera className="w-4 h-4" />
            Snap Sale
          </button>
          <button onClick={openNewSale} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg text-sm font-medium hover:from-emerald-600 hover:to-cyan-600 transition-all shadow-lg shadow-emerald-500/25">
            <Plus className="w-4 h-4" />
            New Sale
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
          <p className="font-medium">Sales error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center"><ShoppingCart className="w-6 h-6 text-white" /></div>
            <div><p className="text-sm text-slate-500">Total Sales</p><p className="text-2xl font-bold text-slate-800">{filteredSales.length}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center"><Wallet className="w-6 h-6 text-white" /></div>
            <div><p className="text-sm text-slate-500">Total Revenue</p><p className="text-2xl font-bold text-slate-800">{formatCurrency(totalSales)}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center"><CreditCard className="w-6 h-6 text-white" /></div>
            <div><p className="text-sm text-slate-500">Average Sale</p><p className="text-2xl font-bold text-slate-800">{formatCurrency(filteredSales.length > 0 ? totalSales / filteredSales.length : 0)}</p></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" placeholder="Search by invoice or customer..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent">
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Payment</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-500"><RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-500" />Loading sales...</td></tr>
              ) : filteredSales.map((sale) => {
                const method = (['cash', 'bank_transfer', 'card', 'wallet', 'credit'].includes(sale.payment_method) ? sale.payment_method : 'cash') as PaymentMethod;
                const PaymentIcon = paymentIcons[method];
                const status = getSaleStatus(sale.status);
                return (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap"><span className="font-medium text-slate-800">{sale.invoice_number}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-slate-600">{sale.customerName}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-slate-600">{sale.itemCount} items</span></td>
                    <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center gap-2"><PaymentIcon className="w-4 h-4 text-slate-400" /><span className="text-slate-600 capitalize">{sale.payment_method}</span></div></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className={cn('px-2.5 py-1 text-xs font-medium rounded-full', statusColors[status])}>{sale.status}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="font-semibold text-slate-800">{formatCurrency(Number(sale.total))}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-slate-600">{formatDate(sale.created_at, 'MMM dd, yyyy')}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-right"><div className="flex items-center justify-end gap-2"><button className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Eye className="w-4 h-4" /></button><button onClick={() => printReceipt(sale)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Printer className="w-4 h-4" /></button><button className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isLoading && filteredSales.length === 0 && <div className="text-center py-12"><ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No sales found</p></div>}
      </div>

      <SmartSnapModal
        open={showSmartSnap}
        mode="sales"
        businessId={businessId}
        knownProducts={products.map((product) => ({ id: product.id, name: product.name, sku: product.sku, barcode: product.barcode }))}
        onClose={() => setShowSmartSnap(false)}
        onApply={applySmartSnapToSale}
      />

      {showNewSaleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div><h2 className="text-xl font-bold text-slate-800">New POS Sale</h2><p className="text-sm text-slate-500 mt-1">Select customer, products, payment method, and complete checkout.</p></div>
              <button onClick={closeNewSale} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-5">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-800">Customer</h3>
                    <button onClick={() => setShowCustomerForm(!showCustomerForm)} className="flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700"><UserPlus className="w-4 h-4" /> New Customer</button>
                  </div>
                  <select value={selectedCustomerId} onChange={(event) => setSelectedCustomerId(event.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">Walk-in Customer</option>
                    {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} {customer.current_balance > 0 ? `· Balance ${formatCurrency(Number(customer.current_balance))}` : ''}</option>)}
                  </select>

                  {showCustomerForm && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                      <input placeholder="Customer name" value={newCustomer.name} onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg" />
                      <input placeholder="Phone" value={newCustomer.phone} onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg" />
                      <input placeholder="Email" value={newCustomer.email} onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg" />
                      <input placeholder="Credit limit" type="number" min="0" value={newCustomer.credit_limit} onChange={(event) => setNewCustomer({ ...newCustomer, credit_limit: event.target.value })} className="px-3 py-2 border border-slate-200 rounded-lg" />
                      <input placeholder="Address" value={newCustomer.address} onChange={(event) => setNewCustomer({ ...newCustomer, address: event.target.value })} className="md:col-span-2 px-3 py-2 border border-slate-200 rounded-lg" />
                      <button type="button" onClick={createCustomer} className="md:col-span-2 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600">Create and Select Customer</button>
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-3">Add Products</h3>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_auto] gap-3">
                    <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500">
                      {products.length === 0 ? <option value="">No products in stock</option> : products.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatCurrency(Number(product.selling_price))} · Stock {product.quantity}</option>)}
                    </select>
                    <input type="number" min="1" step="1" value={selectedQuantity} onChange={(event) => setSelectedQuantity(event.target.value)} className="px-3 py-2 border border-slate-200 rounded-lg" />
                    <button onClick={addProductToCart} className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-lg font-medium hover:from-emerald-600 hover:to-cyan-600">Add</button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 flex items-center justify-between"><h3 className="font-semibold text-slate-800">Cart</h3><span className="text-sm text-slate-500">{cart.length} product lines</span></div>
                  {cart.length === 0 ? (
                    <div className="text-center py-10"><Package className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">No products added yet</p></div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {cart.map((item) => {
                        const lineTotal = Number(item.product.selling_price) * item.quantity - item.discount;
                        return (
                          <div key={item.product.id} className="p-4 grid grid-cols-1 md:grid-cols-[1fr_160px_140px_120px_auto] gap-3 items-center">
                            <div><p className="font-medium text-slate-800">{item.product.name}</p><p className="text-xs text-slate-500">{item.product.sku} · Available {item.product.quantity}</p></div>
                            <div className="flex items-center gap-2"><button onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)} className="p-1 text-slate-400 hover:text-emerald-600"><MinusCircle className="w-4 h-4" /></button><input type="number" min="1" max={item.product.quantity} value={item.quantity} onChange={(event) => updateCartQuantity(item.product.id, Math.floor(toNumber(event.target.value, 1)))} className="w-16 text-center px-2 py-1 border border-slate-200 rounded" /><button onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)} className="p-1 text-slate-400 hover:text-emerald-600"><PlusCircle className="w-4 h-4" /></button></div>
                            <input type="number" min="0" step="0.01" value={item.discount} onChange={(event) => updateCartDiscount(item.product.id, toNumber(event.target.value))} className="px-3 py-2 border border-slate-200 rounded-lg" placeholder="Discount" />
                            <span className="font-semibold text-slate-800">{formatCurrency(lineTotal)}</span>
                            <button onClick={() => removeCartItem(item.product.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-3">Payment</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {(['cash', 'bank_transfer', 'card', 'wallet', 'credit'] as PaymentMethod[]).map((method) => {
                      const Icon = paymentIcons[method];
                      return <button key={method} onClick={() => setPaymentMethod(method)} className={cn('flex items-center justify-center gap-2 px-3 py-3 rounded-lg border text-sm font-medium capitalize', paymentMethod === method ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}><Icon className="w-4 h-4" />{method.replace('_', ' ')}</button>;
                    })}
                  </div>
                  {paymentMethod === 'credit' && <label className="block mt-4 space-y-2"><span className="text-sm font-medium text-slate-700">Due Date</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg" /></label>}
                </div>

                <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-3">
                  <h3 className="font-semibold text-slate-800">Totals</h3>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium">{formatCurrency(subtotal)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Item discounts</span><span className="font-medium">-{formatCurrency(itemDiscountTotal)}</span></div>
                  <label className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Sale discount</span><input type="number" min="0" step="0.01" value={saleDiscount} onChange={(event) => setSaleDiscount(event.target.value)} className="w-28 px-2 py-1 border border-slate-200 rounded text-right" /></label>
                  <label className="flex items-center justify-between gap-3 text-sm"><span className="text-slate-500">Tax</span><input type="number" min="0" step="0.01" value={saleTax} onChange={(event) => setSaleTax(event.target.value)} className="w-28 px-2 py-1 border border-slate-200 rounded text-right" /></label>
                  <div className="border-t border-slate-200 pt-3 flex justify-between"><span className="font-semibold text-slate-800">Total</span><span className="font-bold text-xl text-slate-800">{formatCurrency(total)}</span></div>
                </div>

                <button onClick={createSale} disabled={isSaving || cart.length === 0} className="w-full py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-emerald-600 hover:to-cyan-600 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSaving ? 'Processing Sale...' : `Complete ${paymentMethod.replace('_', ' ')} Sale`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;

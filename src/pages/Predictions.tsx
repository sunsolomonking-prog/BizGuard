import React from 'react';
import { TrendingUp, Package, Zap, RefreshCw, AlertTriangle, BarChart3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppStore } from '../store';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/helpers';
import type { Database } from '../lib/database.types';

type ProductRow = Database['public']['Tables']['products']['Row'];
type SaleRow = Database['public']['Tables']['sales']['Row'];
type SaleItemRow = Database['public']['Tables']['sale_items']['Row'];

interface ForecastRow {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  weeklyDemand: number;
  predicted7: number;
  predicted30: number;
  predicted90: number;
  recommendedOrder: number;
  confidence: number;
  revenuePotential: number;
  status: 'restock' | 'watch' | 'healthy' | 'overstock';
}

export const Predictions: React.FC = () => {
  const { currentBusiness } = useAppStore();
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [sales, setSales] = React.useState<SaleRow[]>([]);
  const [saleItems, setSaleItems] = React.useState<SaleItemRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const businessId = currentBusiness?.id;

  const loadPredictions = React.useCallback(async () => {
    if (!businessId) {
      setProducts([]);
      setSales([]);
      setSaleItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const [productsResult, salesResult] = await Promise.all([
      supabase.from('products').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('sales').select('*').eq('business_id', businessId).gte('created_at', since.toISOString()).order('created_at', { ascending: false }),
    ]);

    const firstError = productsResult.error || salesResult.error;
    if (firstError) {
      toast.error(`Could not load predictions: ${firstError.message}`);
      setIsLoading(false);
      return;
    }

    const saleIds = (salesResult.data || []).map((sale) => sale.id);
    const itemsResult = saleIds.length > 0 ? await supabase.from('sale_items').select('*').in('sale_id', saleIds) : { data: [], error: null };
    if (itemsResult.error) toast.error(`Could not load sale items: ${itemsResult.error.message}`);

    setProducts(productsResult.data || []);
    setSales(salesResult.data || []);
    setSaleItems((itemsResult.data || []) as SaleItemRow[]);
    setIsLoading(false);
  }, [businessId]);

  React.useEffect(() => {
    loadPredictions();
  }, [loadPredictions]);

  const forecasts = React.useMemo<ForecastRow[]>(() => {
    const soldByProduct = new Map<string, { quantity: number; revenue: number }>();
    saleItems.forEach((item) => {
      const current = soldByProduct.get(item.product_id) || { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += Number(item.total);
      soldByProduct.set(item.product_id, current);
    });

    return products.map((product) => {
      const sold = soldByProduct.get(product.id) || { quantity: 0, revenue: 0 };
      const weeklyDemand = sold.quantity / 13;
      const predicted7 = Math.ceil(weeklyDemand);
      const predicted30 = Math.ceil(weeklyDemand * 4.3);
      const predicted90 = Math.ceil(weeklyDemand * 13);
      const recommendedOrder = Math.max(0, predicted30 + product.reorder_level - product.quantity);
      const status: ForecastRow['status'] = product.quantity <= product.reorder_level || recommendedOrder > 0 ? 'restock' : product.quantity > predicted90 && predicted90 > 0 ? 'overstock' : weeklyDemand > 0 ? 'healthy' : 'watch';
      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        currentStock: product.quantity,
        weeklyDemand,
        predicted7,
        predicted30,
        predicted90,
        recommendedOrder,
        confidence: Math.min(95, sales.length > 10 ? 82 : sales.length > 0 ? 62 : 40),
        revenuePotential: predicted30 * Number(product.selling_price),
        status,
      };
    }).sort((a, b) => b.recommendedOrder - a.recommendedOrder || b.weeklyDemand - a.weeklyDemand);
  }, [products, saleItems, sales.length]);

  const restockCount = forecasts.filter((forecast) => forecast.status === 'restock').length;
  const overstockCount = forecasts.filter((forecast) => forecast.status === 'overstock').length;
  const forecastRevenue = forecasts.reduce((sum, forecast) => sum + forecast.revenuePotential, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Predictions</h1>
          <p className="text-slate-500 mt-1">Demand forecasting and restock recommendations from live sales and inventory data</p>
        </div>
        <button onClick={loadPredictions} disabled={isLoading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><TrendingUp className="h-6 w-6 text-emerald-600" /><p className="mt-3 text-sm text-slate-500">30-Day Revenue Potential</p><p className="text-2xl font-black text-slate-800">{formatCurrency(forecastRevenue)}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><Package className="h-6 w-6 text-blue-600" /><p className="mt-3 text-sm text-slate-500">Products Forecasted</p><p className="text-2xl font-black text-slate-800">{forecasts.length}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><AlertTriangle className="h-6 w-6 text-orange-600" /><p className="mt-3 text-sm text-slate-500">Restock Needed</p><p className="text-2xl font-black text-slate-800">{restockCount}</p></div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><BarChart3 className="h-6 w-6 text-purple-600" /><p className="mt-3 text-sm text-slate-500">Overstock Risk</p><p className="text-2xl font-black text-slate-800">{overstockCount}</p></div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="font-bold text-slate-800">Product Demand Forecast</h2>
          <p className="text-sm text-slate-500">7, 30 and 90 day forecast based on historical sale_items and current stock</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-600"><tr><th className="px-5 py-3">Product</th><th className="px-5 py-3">Stock</th><th className="px-5 py-3">7 Days</th><th className="px-5 py-3">30 Days</th><th className="px-5 py-3">90 Days</th><th className="px-5 py-3">Order</th><th className="px-5 py-3">Confidence</th><th className="px-5 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? <tr><td colSpan={8} className="px-5 py-10 text-center text-slate-500">Loading predictions...</td></tr> : forecasts.map((forecast) => (
                <tr key={forecast.productId} className="hover:bg-slate-50"><td className="px-5 py-4"><p className="font-semibold text-slate-800">{forecast.productName}</p><p className="text-xs text-slate-500">{forecast.sku}</p></td><td className="px-5 py-4">{forecast.currentStock}</td><td className="px-5 py-4">{forecast.predicted7}</td><td className="px-5 py-4">{forecast.predicted30}</td><td className="px-5 py-4">{forecast.predicted90}</td><td className="px-5 py-4 font-bold text-emerald-600">{forecast.recommendedOrder}</td><td className="px-5 py-4">{forecast.confidence}%</td><td className="px-5 py-4"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700">{forecast.status}</span></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 p-6 text-white">
        <div className="flex items-center gap-3">
          <Zap className="h-8 w-8" />
          <div><h3 className="text-lg font-bold">Smart Restock Engine Active</h3><p className="opacity-90">Recommendations are generated from live POS movement, stock levels, and reorder thresholds.</p></div>
        </div>
      </div>
    </div>
  );
};

export default Predictions;

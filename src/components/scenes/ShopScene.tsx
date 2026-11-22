"use client";

import React, { useState, useEffect } from "react";
import {
  ShoppingBag,
  Package,
  AlertTriangle,
  Plus,
  Minus,
  Check,
  Truck,
  Store,
  Trash2,
  RefreshCw,
  Search,
  Tag,
  ArrowRight,
  ShieldCheck,
  Pencil,
  XCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PaymentModal } from "../PaymentModal";
import { useAuth } from "@/contexts/AuthContext";

interface ShopSceneProps {
  pollIntervalMs?: number;
  onDataLoaded?: (data: { members: any[]; selectedMemberId: string }) => void;
  memberSelectRef?: React.MutableRefObject<((memberId: string) => void) | null>;
}

export function ShopScene({
  pollIntervalMs = 3500,
  onDataLoaded,
  memberSelectRef,
}: ShopSceneProps = {}) {
  const { user } = useAuth();
  const canManageProducts = user?.role === "OWNER" || user?.role === "PRO_SHOP";

  const [products, setProducts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Cart State: productId -> quantity
  const [cart, setCart] = useState<{ [productId: string]: number }>({});
  const [channel, setChannel] = useState<"COUNTER" | "SOFA_ONLINE">("COUNTER");
  const [orderType, setOrderType] = useState<"IN_STORE" | "ONLINE_COLLECTION" | "ONLINE_DELIVERY">(
    "IN_STORE"
  );
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // Product Add / Edit Modal State
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    category: "RACKET",
    price: 3500,
    stockQuantity: 15,
    reorderThreshold: 5,
    description: "",
    sku: "",
    imageUrl: "",
  });
  const [productModalError, setProductModalError] = useState<string | null>(null);
  const [isProductSubmitting, setIsProductSubmitting] = useState(false);

  // Payment Modal State
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);

  // Fetch Data
  const fetchData = async () => {
    try {
      const [prodRes, memRes, ordRes] = await Promise.all([
        fetch(
          `/api/shop/products?search=${encodeURIComponent(search)}${
            selectedCategory !== "ALL" ? `&category=${selectedCategory}` : ""
          }`
        ),
        fetch("/api/members"),
        fetch("/api/shop/orders?limit=6"),
      ]);

      const prodData = await prodRes.json();
      const memData = await memRes.json();
      const ordData = await ordRes.json();

      if (prodData.success) setProducts(prodData.products);
      if (memData.success) {
        const memList = memData.members || [];
        setMembers(memList);
        setSelectedMemberId((prev) => {
          if (prev && memList.some((m: any) => m.id === prev)) {
            return prev;
          }
          return memList.length > 0 ? memList[0].id : "";
        });
      }
      if (ordData.success) setRecentOrders(ordData.orders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Expose member select handler for test harnesses
  useEffect(() => {
    if (memberSelectRef) memberSelectRef.current = (mId: string) => setSelectedMemberId(mId);
  }, [memberSelectRef]);

  // Hook for observability
  useEffect(() => {
    onDataLoaded?.({ members, selectedMemberId });
  }, [members, selectedMemberId]);

  // Real-time polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollIntervalMs);
    return () => clearInterval(interval);
  }, [selectedCategory, search, pollIntervalMs]);

  // Cart operations
  const addToCart = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setCart((prev) => {
      const currentQty = prev[productId] || 0;
      if (currentQty >= product.stockQuantity) {
        alert(
          `Only ${product.stockQuantity} units available on single shelf! Cannot add more.`
        );
        return prev;
      }
      return { ...prev, [productId]: currentQty + 1 };
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const currentQty = prev[productId] || 0;
      if (currentQty <= 1) {
        const next = { ...prev };
        delete next[productId];
        return next;
      }
      return { ...prev, [productId]: currentQty - 1 };
    });
  };

  const clearCart = () => setCart({});

  // Single Shelf Restock Simulation
  const handleRestock = async (productId: string, addedStock: number = 10) => {
    try {
      const res = await fetch("/api/shop/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, addedStock }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open Add Product Modal
  const handleOpenAddProduct = () => {
    setEditingProductId(null);
    setProductForm({
      name: "",
      category: "RACKET",
      price: 2500,
      stockQuantity: 20,
      reorderThreshold: 5,
      description: "",
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      imageUrl: "",
    });
    setProductModalError(null);
    setIsProductModalOpen(true);
  };

  // Open Edit Product Modal
  const handleOpenEditProduct = (prod: any) => {
    setEditingProductId(prod.id);
    setProductForm({
      name: prod.name,
      category: prod.category,
      price: prod.price,
      stockQuantity: prod.stockQuantity,
      reorderThreshold: prod.reorderThreshold,
      description: prod.description || "",
      sku: prod.sku,
      imageUrl: prod.imageUrl || "",
    });
    setProductModalError(null);
    setIsProductModalOpen(true);
  };

  // Save Product (Create or Update)
  const handleSaveProduct = async () => {
    setIsProductSubmitting(true);
    setProductModalError(null);

    try {
      const method = editingProductId ? "PUT" : "POST";
      const payload = editingProductId ? { id: editingProductId, ...productForm } : productForm;

      const res = await fetch("/api/shop/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save product");
      }

      setIsProductModalOpen(false);
      fetchData();
    } catch (err: any) {
      setProductModalError(err.message);
    } finally {
      setIsProductSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to remove "${productName}" from the catalog?`)) return;

    try {
      const res = await fetch(`/api/shop/products?id=${encodeURIComponent(productId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete product");
        return;
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || "Network error while deleting product");
    }
  };

  // Calculations
  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const discountPercent = selectedMember?.plan?.shopDiscountPercent ?? 0;

  const cartItemsList = Object.entries(cart).map(([productId, quantity]) => {
    const product = products.find((p) => p.id === productId);
    return {
      product,
      quantity,
      unitPrice: product ? product.price : 0,
      total: product ? product.price * quantity : 0,
    };
  });

  const cartSubtotal = cartItemsList.reduce((sum, item) => sum + item.total, 0);
  const cartDiscountAmount = Number(((cartSubtotal * discountPercent) / 100).toFixed(2));
  const cartFinalTotal = Math.max(0, Number((cartSubtotal - cartDiscountAmount).toFixed(2)));

  // Final Checkout submission
  const handleCheckoutSuccess = async (txn: any) => {
    setIsPayModalOpen(false);
    clearCart();
    fetchData();
    setOrderSuccessMsg(`Order placed successfully! Reference: ${txn.referenceNo}`);
    setTimeout(() => setOrderSuccessMsg(null), 5000);
  };

  const handlePlaceOrder = async (payMethod: string = "UPI") => {
    const itemsPayload = Object.entries(cart).map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    try {
      const res = await fetch("/api/shop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberId: selectedMemberId || null,
          customerName: selectedMember ? selectedMember.name : customerName,
          customerPhone: selectedMember ? selectedMember.phone : customerPhone,
          orderType: channel === "COUNTER" ? "IN_STORE" : orderType,
          deliveryAddress: orderType === "ONLINE_DELIVERY" ? deliveryAddress : null,
          items: itemsPayload,
          paymentMethod: payMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Order placement failed");
      }

      handleCheckoutSuccess(data.transaction);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <ShoppingBag className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-white">Scene 3: Pro Gear Shop & Single-Shelf POS</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            One single shelf inventory: In-store desk sales and online sofa orders withdraw from the exact same stock in real-time.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canManageProducts && (
            <button
              onClick={handleOpenAddProduct}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-semibold rounded-xl text-xs transition shadow"
              title="Add a new gear product to inventory"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product
            </button>
          )}

          {/* Channel Toggle */}
          <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setChannel("COUNTER");
                setOrderType("IN_STORE");
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                channel === "COUNTER"
                  ? "bg-slate-800 text-amber-400 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Store className="w-3.5 h-3.5" /> Counter Desk POS
            </button>
            <button
              onClick={() => {
                setChannel("SOFA_ONLINE");
                setOrderType("ONLINE_COLLECTION");
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                channel === "SOFA_ONLINE"
                  ? "bg-slate-800 text-emerald-400 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Truck className="w-3.5 h-3.5" /> Sofa Online Order
            </button>
          </div>
        </div>
      </div>

      {orderSuccessMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{orderSuccessMsg}</span>
        </div>
      )}

      {/* Categories & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search rackets, balls, strings, shoes, apparel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {["ALL", "RACKET", "BALLS", "SHOES", "APPAREL", "ACCESSORIES"].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Products + Cart Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Grid (2 Cols) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {products.map((prod) => {
            const isLow = prod.isLowStock;
            const inCartQty = cart[prod.id] || 0;

            return (
              <div
                key={prod.id}
                className={`p-4 rounded-2xl border flex flex-col justify-between transition ${
                  isLow
                    ? "bg-rose-950/20 border-rose-800/80 shadow-rose-950/20"
                    : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                      {prod.category}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-slate-500">{prod.sku}</span>
                      {canManageProducts && (
                        <div className="flex items-center gap-1 ml-1 border-l border-slate-800 pl-1.5">
                          <button
                            onClick={() => handleOpenEditProduct(prod)}
                            className="p-1 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded transition"
                            title="Edit Product"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod.id, prod.name)}
                            className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                            title="Delete Product"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-white text-sm leading-snug">{prod.name}</h3>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{prod.description}</p>

                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-base font-extrabold text-amber-400">
                      {formatCurrency(prod.price)}
                    </span>

                    {/* Single Shelf Stock Badge */}
                    <div className="text-right">
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                          isLow
                            ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {isLow && <AlertTriangle className="w-3 h-3" />}
                        Shelf: {prod.stockQuantity} left
                      </span>
                      {isLow && (
                        <p className="text-[10px] text-rose-400 mt-0.5 font-semibold">
                          Below reorder limit ({prod.reorderThreshold})!
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
                  {isLow && (
                    <button
                      onClick={() => handleRestock(prod.id, 10)}
                      className="px-2.5 py-1.5 bg-rose-900/40 hover:bg-rose-900/60 text-rose-300 text-xs font-medium rounded-xl border border-rose-800/80 flex items-center gap-1"
                      title="Simulate vendor shipment to replenish single shelf"
                    >
                      <RefreshCw className="w-3 h-3" /> Restock (+10)
                    </button>
                  )}

                  <button
                    disabled={prod.stockQuantity <= 0}
                    onClick={() => addToCart(prod.id)}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{inCartQty > 0 ? `In Cart (${inCartQty})` : "Add to Order"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Omnichannel Cart & Checkout Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Active POS Cart ({Object.keys(cart).length})
                </h2>
              </div>
              {Object.keys(cart).length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="mt-3 divide-y divide-slate-800/60 max-h-60 overflow-y-auto pr-1">
              {cartItemsList.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">
                  Cart is currently empty. Tap items from the shelf to sell.
                </p>
              ) : (
                cartItemsList.map((item) => {
                  if (!item.product) return null;
                  return (
                    <div key={item.product.id} className="py-2.5 flex justify-between items-center text-xs">
                      <div className="flex-1 pr-2">
                        <p className="font-semibold text-white truncate">{item.product.name}</p>
                        <span className="text-[10px] text-slate-400">
                          {formatCurrency(item.unitPrice)} each
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-bold text-white font-mono w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => addToCart(item.product.id)}
                          className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center hover:bg-slate-700"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Customer Details Form */}
            <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
              <div>
                <label className="text-xs text-slate-400">Club Member (Discount Eligibility)</label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="">Walk-in Non-Member (0% Off)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.memberNumber}) • {m.planTier} ({m.plan?.shopDiscountPercent}% Off)
                    </option>
                  ))}
                </select>
              </div>

              {!selectedMemberId && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Guest Name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                  <input
                    type="text"
                    placeholder="Phone"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              )}

              {/* Delivery Address if online delivery */}
              {channel === "SOFA_ONLINE" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOrderType("ONLINE_COLLECTION")}
                      className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold ${
                        orderType === "ONLINE_COLLECTION"
                          ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-400"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      Club Pickup
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType("ONLINE_DELIVERY")}
                      className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold ${
                        orderType === "ONLINE_DELIVERY"
                          ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-400"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      Doorstep Delivery
                    </button>
                  </div>
                  {orderType === "ONLINE_DELIVERY" && (
                    <input
                      type="text"
                      placeholder="Home Delivery Address in Hyderabad..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Pricing Summary & Checkout Button */}
          <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span className="font-mono">{formatCurrency(cartSubtotal)}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Member Tier Discount ({discountPercent}%):</span>
                <span className="font-mono">-{formatCurrency(cartDiscountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-white font-bold text-sm pt-1 border-t border-slate-800/60">
              <span>Payable Total:</span>
              <span className="font-mono text-amber-400">{formatCurrency(cartFinalTotal)}</span>
            </div>

            <button
              disabled={cartItemsList.length === 0}
              onClick={() => setIsPayModalOpen(true)}
              className="w-full py-2.5 mt-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-950 transition flex items-center justify-center gap-1.5"
            >
              <span>Proceed to Instant Checkout</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Product Add / Edit Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-amber-400 uppercase">
                  Pro Shop Gear Inventory
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {editingProductId ? "Edit Product Details" : "Add New Gear Product"}
                </h2>
              </div>
              <button
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {productModalError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{productModalError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Product Name</label>
                <input
                  type="text"
                  placeholder="e.g. Wilson Pro Staff 97 V14 Racket"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Category</label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  >
                    <option value="RACKET">RACKET</option>
                    <option value="BALLS">BALLS</option>
                    <option value="SHOES">SHOES</option>
                    <option value="APPAREL">APPAREL</option>
                    <option value="ACCESSORIES">ACCESSORIES</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">SKU Code</label>
                  <input
                    type="text"
                    placeholder="e.g. SKU-PRO-01"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Shelf Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={productForm.stockQuantity}
                    onChange={(e) => setProductForm({ ...productForm, stockQuantity: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Low Limit</label>
                  <input
                    type="number"
                    min={1}
                    value={productForm.reorderThreshold}
                    onChange={(e) => setProductForm({ ...productForm, reorderThreshold: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Description</label>
                <textarea
                  rows={2}
                  placeholder="Product specs, grip size, string tension details..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProductSubmitting}
                onClick={handleSaveProduct}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl text-sm font-bold shadow-lg shadow-amber-950"
              >
                {isProductSubmitting ? "Saving..." : editingProductId ? "Save Product" : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal for In-Store Counter Checkout */}
      {isPayModalOpen && (
        <PaymentModal
          isOpen={isPayModalOpen}
          onClose={() => setIsPayModalOpen(false)}
          amount={cartFinalTotal}
          title="Pro Gear Shop Checkout"
          notes={`Counter Sale: ${cartItemsList.map((i) => `${i.product?.name} (x${i.quantity})`).join(", ")}`}
          type="SHOP_PURCHASE"
          category="SHOP"
          memberId={selectedMemberId || undefined}
          memberName={selectedMember?.name || customerName || "Counter Customer"}
          onSuccess={async (txn) => {
            await handlePlaceOrder(txn.paymentMethod);
          }}
        />
      )}
    </div>
  );
}

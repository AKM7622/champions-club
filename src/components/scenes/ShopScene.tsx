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
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { PaymentModal } from "../PaymentModal";

export function ShopScene() {
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
        setMembers(memData.members);
        if (!selectedMemberId && memData.members.length > 0) {
          setSelectedMemberId(memData.members[0].id);
        }
      }
      if (ordData.success) setRecentOrders(ordData.orders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Polling every 3.5 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3500);
    return () => clearInterval(interval);
  }, [search, selectedCategory]);

  // Cart operations
  const addToCart = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const currentQty = cart[productId] || 0;
    if (currentQty >= prod.stockQuantity) {
      alert(`Cannot add more: Only ${prod.stockQuantity} available on the shelf!`);
      return;
    }
    setCart({ ...cart, [productId]: currentQty + 1 });
  };

  const removeFromCart = (productId: string) => {
    const currentQty = cart[productId] || 0;
    if (currentQty <= 1) {
      const newCart = { ...cart };
      delete newCart[productId];
      setCart(newCart);
    } else {
      setCart({ ...cart, [productId]: currentQty - 1 });
    }
  };

  const clearCart = () => setCart({});

  // Restock product
  const handleRestock = async (productId: string, qty: number = 10) => {
    try {
      const res = await fetch("/api/shop/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, addedStock: qty }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Calculations
  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const discountPercent = selectedMember ? selectedMember.plan.shopDiscountPercent : 0;

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
                    <span className="font-mono text-[11px] text-slate-500">{prod.sku}</span>
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

        {/* Live Order & Checkout Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sticky top-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {channel === "COUNTER" ? "Counter POS Checkout" : "Online Sofa Order"}
                </h3>
              </div>
              {cartItemsList.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear
                </button>
              )}
            </div>

            {/* Member Plan Selection for Automatic Discount */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Customer / Member</label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="">Non-Member / Walk-In (0% Discount)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.planTier} - {m.plan.shopDiscountPercent}% Off)
                  </option>
                ))}
              </select>
            </div>

            {/* Online Delivery / Collection details */}
            {channel === "SOFA_ONLINE" && (
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <label className="text-xs text-slate-400">Fulfillment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setOrderType("ONLINE_COLLECTION")}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-semibold ${
                      orderType === "ONLINE_COLLECTION"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    Club Desk Pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderType("ONLINE_DELIVERY")}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-semibold ${
                      orderType === "ONLINE_DELIVERY"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    Home Delivery
                  </button>
                </div>

                {orderType === "ONLINE_DELIVERY" && (
                  <div>
                    <label className="text-xs text-slate-400">Home Address</label>
                    <textarea
                      rows={2}
                      placeholder="Flat 402, Palm Meadows, Bangalore"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Cart Items List */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {cartItemsList.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  Cart is empty. Click "+ Add to Order" on items from the shelf.
                </div>
              ) : (
                cartItemsList.map(({ product, quantity, unitPrice, total }) => {
                  if (!product) return null;
                  return (
                    <div
                      key={product.id}
                      className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex justify-between items-center"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-white truncate">{product.name}</p>
                        <p className="text-[10px] text-slate-400">
                          {formatCurrency(unitPrice)} × {quantity}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800">
                          <button
                            onClick={() => removeFromCart(product.id)}
                            className="p-1 hover:text-rose-400"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="px-1.5 font-mono text-[11px] font-bold">{quantity}</span>
                          <button
                            onClick={() => addToCart(product.id)}
                            className="p-1 hover:text-emerald-400"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-bold text-white min-w-[55px] text-right font-mono">
                          {formatCurrency(total)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bill Summary */}
            {cartItemsList.length > 0 && (
              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(cartSubtotal)}</span>
                </div>
                {discountPercent > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Member Discount ({discountPercent}%):</span>
                    <span>-{formatCurrency(cartDiscountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                  <span>Net Payable:</span>
                  <span className="text-amber-400">{formatCurrency(cartFinalTotal)}</span>
                </div>
              </div>
            )}

            {/* Pay / Complete Order Button */}
            <button
              disabled={cartItemsList.length === 0}
              onClick={() => {
                if (channel === "COUNTER") {
                  setIsPayModalOpen(true);
                } else {
                  handlePlaceOrder("UPI");
                }
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-amber-950 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {channel === "COUNTER"
                  ? `Pay ${formatCurrency(cartFinalTotal)} (POS Modal)`
                  : `Place Sofa Order (${formatCurrency(cartFinalTotal)})`}
              </span>
            </button>
          </div>
        </div>
      </div>

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
            // Call order backend with txn already confirmed
            await handlePlaceOrder(txn.paymentMethod);
          }}
        />
      )}
    </div>
  );
}

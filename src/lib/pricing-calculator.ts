import { PlanTier } from "@prisma/client";

export interface MembershipPlanRules {
  tier: PlanTier;
  courtDiscountPercent: number; // e.g. 100 for Gold, 50 for Silver, 30 for Junior
  shopDiscountPercent: number;  // e.g. 20 for Gold, 10 for Silver, 15 for Junior
  barDiscountPercent: number;   // e.g. 20 for Gold, 10 for Silver, 5 for Junior
  maxDailyBookings: number;
}

export interface CourtPriceCalculation {
  basePrice: number;
  discountAmount: number;
  discountPercent: number;
  finalPrice: number;
  isFree: boolean;
}

export interface ShopPriceCalculation {
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  finalPrice: number;
}

export interface BarBillCalculation {
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  taxAmount: number;
  finalAmount: number;
}

export interface MembershipFeeCalculation {
  tier: PlanTier;
  monthlyFee: number;
  durationMonths: number;
  basePrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
}

/**
 * Shared utility routing all court, shop, and bar pricing calculations
 * through MembershipPlan rules.
 */
export class PricingCalculator {
  /**
   * Calculate Court Booking Price
   */
  static calculateCourtBooking(params: {
    hourlyRate: number;
    durationMinutes?: number;
    plan?: MembershipPlanRules | null;
    isSocialPlay?: boolean;
    socialPlayersCount?: number;
  }): CourtPriceCalculation {
    const {
      hourlyRate,
      durationMinutes = 60,
      plan = null,
      isSocialPlay = false,
      socialPlayersCount = 1,
    } = params;

    const hours = durationMinutes / 60;
    let basePrice = hourlyRate * hours;

    // Social play flat rate per player (e.g. ₹250 per player for Friday evening social play)
    if (isSocialPlay) {
      const socialBasePerPerson = 250;
      basePrice = socialBasePerPerson * Math.max(1, socialPlayersCount);
      const discountPercent = plan ? Math.min(50, plan.courtDiscountPercent) : 0;
      const discountAmount = Number(((basePrice * discountPercent) / 100).toFixed(2));
      const finalPrice = Math.max(0, Number((basePrice - discountAmount).toFixed(2)));
      return {
        basePrice,
        discountAmount,
        discountPercent,
        finalPrice,
        isFree: finalPrice === 0,
      };
    }

    const discountPercent = plan ? plan.courtDiscountPercent : 0;
    const discountAmount = Number(((basePrice * discountPercent) / 100).toFixed(2));
    const finalPrice = Math.max(0, Number((basePrice - discountAmount).toFixed(2)));

    return {
      basePrice: Number(basePrice.toFixed(2)),
      discountAmount,
      discountPercent,
      finalPrice,
      isFree: finalPrice === 0,
    };
  }

  /**
   * Calculate Shop Item Price
   */
  static calculateShopOrder(params: {
    items: Array<{ unitPrice: number; quantity: number }>;
    plan?: MembershipPlanRules | null;
  }): ShopPriceCalculation {
    const { items, plan = null } = params;
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    const discountPercent = plan ? plan.shopDiscountPercent : 0;
    const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
    const finalPrice = Math.max(0, Number((subtotal - discountAmount).toFixed(2)));

    return {
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount,
      discountPercent,
      finalPrice,
    };
  }

  /**
   * Calculate Bar Bill / Tab Amount
   */
  static calculateBarBill(params: {
    items: Array<{ unitPrice: number; quantity: number }>;
    plan?: MembershipPlanRules | null;
    taxRate?: number; // default 5% GST
  }): BarBillCalculation {
    const { items, plan = null, taxRate = 0.05 } = params;
    const subtotal = items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );

    const discountPercent = plan ? plan.barDiscountPercent : 0;
    const discountAmount = Number(((subtotal * discountPercent) / 100).toFixed(2));
    const discountedTotal = Math.max(0, subtotal - discountAmount);
    const taxAmount = Number((discountedTotal * taxRate).toFixed(2));
    const finalAmount = Math.round(discountedTotal + taxAmount);

    return {
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount,
      discountPercent,
      taxAmount,
      finalAmount,
    };
  }

  /**
   * Calculate Membership Enrollment or Renewal Fee
   */
  static calculateMembershipFee(params: {
    monthlyFee: number;
    durationMonths: number;
    tier?: PlanTier;
    discountPercent?: number;
  }): MembershipFeeCalculation {
    const { monthlyFee, durationMonths, tier = PlanTier.GOLD, discountPercent = 0 } = params;
    const safeMonthlyFee = Math.max(0, Number(monthlyFee) || 0);
    const validDuration = Math.max(1, Math.floor(Number(durationMonths) || 1));
    const basePrice = Number((safeMonthlyFee * validDuration).toFixed(2));
    const validDiscount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
    const discountAmount = Number(((basePrice * validDiscount) / 100).toFixed(2));
    const finalPrice = Math.max(0, Number((basePrice - discountAmount).toFixed(2)));

    return {
      tier,
      monthlyFee: safeMonthlyFee,
      durationMonths: validDuration,
      basePrice,
      discountPercent: validDiscount,
      discountAmount,
      finalPrice,
    };
  }

  /**
   * Check membership expiration status
   */
  static getMembershipStatus(expiryDate: Date | string): "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return "EXPIRED";
    if (diffDays <= 7) return "EXPIRING_SOON";
    return "ACTIVE";
  }
}

export default PricingCalculator;


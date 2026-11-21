import {
  PrismaClient,
  PlanTier,
  MemberStatus,
  SportType,
  ProductCategory,
  TableStatus,
  TabStatus,
  KitchenStatus,
  MenuCategory,
  PaymentMethod,
  PaymentStatus,
  BookingStatus,
  TransactionType,
  TransactionCategory,
  OrderType,
  OrderStatus,
  LeadStatus,
  StaffRole,
  LeaveStatus,
} from "@prisma/client";
import { subDays, addDays, addMonths, setHours, setMinutes } from "date-fns";
import { PricingCalculator } from "../src/lib/pricing-calculator";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Cleaning existing database...");
  await prisma.barOrderItem.deleteMany({});
  await prisma.barTab.deleteMany({});
  await prisma.barMenuItem.deleteMany({});
  await prisma.barTable.deleteMany({});
  await prisma.shopOrderItem.deleteMany({});
  await prisma.shopOrder.deleteMany({});
  await prisma.shopProduct.deleteMany({});
  await prisma.courtBooking.deleteMany({});
  await prisma.court.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.leave.deleteMany({});
  await prisma.shift.deleteMany({});
  await prisma.staffMember.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.member.deleteMany({});
  await prisma.membershipPlan.deleteMany({});

  console.log("🏢 1. Seeding Membership Plans...");
  const goldPlan = await prisma.membershipPlan.create({
    data: {
      tier: PlanTier.GOLD,
      name: "Gold All-Access",
      monthlyFee: 6000,
      courtDiscountPercent: 100, // 100% free court bookings
      shopDiscountPercent: 20,
      barDiscountPercent: 20,
      maxDailyBookings: 2,
      color: "amber",
      perks: [
        "100% Free Court Bookings",
        "20% Discount at Pro Gear Shop",
        "20% Discount at Bar & Cafeteria",
        "2 Daily Court Booking Limit",
        "Priority Social Play Access",
        "Free Locker & Towel Service",
      ],
    },
  });

  const silverPlan = await prisma.membershipPlan.create({
    data: {
      tier: PlanTier.SILVER,
      name: "Silver Standard",
      monthlyFee: 3500,
      courtDiscountPercent: 50, // 50% off court bookings
      shopDiscountPercent: 10,
      barDiscountPercent: 10,
      maxDailyBookings: 2,
      color: "slate",
      perks: [
        "50% Off All Court Bookings",
        "10% Discount at Pro Gear Shop",
        "10% Discount at Bar & Cafeteria",
        "2 Daily Court Booking Limit",
        "Standard Social Play Access",
      ],
    },
  });

  const juniorPlan = await prisma.membershipPlan.create({
    data: {
      tier: PlanTier.JUNIOR,
      name: "Junior Academy (Under 18)",
      monthlyFee: 2200,
      courtDiscountPercent: 40, // 40% off court bookings
      shopDiscountPercent: 15, // 15% discount on gear
      barDiscountPercent: 5,
      maxDailyBookings: 2,
      color: "sky",
      perks: [
        "40% Off Court Bookings (Peak & Off-peak)",
        "15% Discount on Junior Rackets & Shoes",
        "5% Discount at Bar & Health Drinks",
        "Free Saturday Junior Academy Drills",
      ],
    },
  });

  console.log("👥 2. Seeding 15 Members (including one expiring soon)...");
  const now = new Date();
  const membersData = [
    // 5 Gold Members
    {
      memberNumber: "CC-1001",
      name: "Rohan Sharma",
      email: "rohan.sharma@example.com",
      phone: "+91 98201 12345",
      planTier: PlanTier.GOLD,
      startDate: subDays(now, 180),
      expiryDate: addMonths(now, 6),
      status: MemberStatus.ACTIVE,
      notes: "Former state tennis semifinalist. Regular evening player.",
    },
    {
      memberNumber: "CC-1002",
      name: "Priya Patel",
      email: "priya.patel@example.com",
      phone: "+91 98202 23456",
      planTier: PlanTier.GOLD,
      startDate: subDays(now, 90),
      expiryDate: addMonths(now, 9),
      status: MemberStatus.ACTIVE,
      notes: "Plays cricket on weekends and tennis on Tuesday mornings.",
    },
    {
      memberNumber: "CC-1003",
      name: "Vikramaditya Singhania",
      email: "vikram.s@singhaniaholdings.com",
      phone: "+91 98203 34567",
      planTier: PlanTier.GOLD,
      startDate: subDays(now, 240),
      expiryDate: addMonths(now, 4),
      status: MemberStatus.ACTIVE,
      notes: "Corporate sponsor. Hosts business matches on Friday nights.",
    },
    {
      memberNumber: "CC-1004",
      name: "Ananya Iyer",
      email: "ananya.iyer@example.com",
      phone: "+91 98204 45678",
      planTier: PlanTier.GOLD,
      startDate: subDays(now, 120),
      expiryDate: addMonths(now, 8),
      status: MemberStatus.ACTIVE,
      notes: "Prefers Roland Garros clay court. Coffee connoisseur at the bar.",
    },
    {
      memberNumber: "CC-1005",
      name: "Sameer Nair",
      email: "sameer.nair@example.com",
      phone: "+91 98205 56789",
      planTier: PlanTier.GOLD,
      startDate: subDays(now, 60),
      expiryDate: addMonths(now, 10),
      status: MemberStatus.ACTIVE,
      notes: "Daily early morning runner and tennis player (06:30 AM).",
    },

    // 5 Silver Members (including ONE EXPIRING SOON)
    {
      memberNumber: "CC-2001",
      name: "Rajesh Kumar",
      email: "rajesh.kumar@example.com",
      phone: "+91 98206 67890",
      planTier: PlanTier.SILVER,
      startDate: subDays(now, 330),
      expiryDate: addMonths(now, 1),
      status: MemberStatus.ACTIVE,
      notes: "Cricket all-rounder. Uses Bowling Machine frequently.",
    },
    {
      // ⚠️ EXPIRING SOON REQUIREMENT: Expiry in 3 days!
      memberNumber: "CC-2002",
      name: "Neha Kapoor",
      email: "neha.kapoor@example.com",
      phone: "+91 98207 78901",
      planTier: PlanTier.SILVER,
      startDate: subDays(now, 362),
      expiryDate: addDays(now, 3), // 3 days remaining!
      status: MemberStatus.EXPIRING_SOON,
      notes: "Renewal notice sent by email. Front desk flag set.",
    },
    {
      memberNumber: "CC-2003",
      name: "Siddharth Mehta",
      email: "sid.mehta@example.com",
      phone: "+91 98208 89012",
      planTier: PlanTier.SILVER,
      startDate: subDays(now, 150),
      expiryDate: addMonths(now, 7),
      status: MemberStatus.ACTIVE,
      notes: "Active in weekend club box cricket leagues.",
    },
    {
      memberNumber: "CC-2004",
      name: "Kavita Reddy",
      email: "kavita.reddy@example.com",
      phone: "+91 98209 90123",
      planTier: PlanTier.SILVER,
      startDate: subDays(now, 200),
      expiryDate: addMonths(now, 5),
      status: MemberStatus.ACTIVE,
      notes: "Tennis intermediate ladder player.",
    },
    {
      memberNumber: "CC-2005",
      name: "Arjun Verma",
      email: "arjun.verma@example.com",
      phone: "+91 98210 01234",
      planTier: PlanTier.SILVER,
      startDate: subDays(now, 45),
      expiryDate: addMonths(now, 11),
      status: MemberStatus.ACTIVE,
      notes: "Signed up during Diwali Open tournament.",
    },

    // 5 Junior Members
    {
      memberNumber: "CC-3001",
      name: "Ishaan Gupta (U-16)",
      email: "ishaan.parent@example.com",
      phone: "+91 98211 12345",
      planTier: PlanTier.JUNIOR,
      startDate: subDays(now, 120),
      expiryDate: addMonths(now, 6),
      status: MemberStatus.ACTIVE,
      notes: "AITA Junior Tennis Circuit ranked player.",
    },
    {
      memberNumber: "CC-3002",
      name: "Aarav Deshmukh (U-14)",
      email: "deshmukh.family@example.com",
      phone: "+91 98212 23456",
      planTier: PlanTier.JUNIOR,
      startDate: subDays(now, 80),
      expiryDate: addMonths(now, 8),
      status: MemberStatus.ACTIVE,
      notes: "Cricket academy fast-bowling prodigy.",
    },
    {
      memberNumber: "CC-3003",
      name: "Diya Sen (U-16)",
      email: "diya.sen@example.com",
      phone: "+91 98213 34567",
      planTier: PlanTier.JUNIOR,
      startDate: subDays(now, 100),
      expiryDate: addMonths(now, 7),
      status: MemberStatus.ACTIVE,
      notes: "Junior tennis team captain.",
    },
    {
      memberNumber: "CC-3004",
      name: "Vihaan Joshi (U-12)",
      email: "joshi.vikram@example.com",
      phone: "+91 98214 45678",
      planTier: PlanTier.JUNIOR,
      startDate: subDays(now, 50),
      expiryDate: addMonths(now, 10),
      status: MemberStatus.ACTIVE,
      notes: "Enrolled in weekend coaching camp.",
    },
    {
      memberNumber: "CC-3005",
      name: "Zara Fernandez (U-18)",
      email: "zara.fernandez@example.com",
      phone: "+91 98215 56789",
      planTier: PlanTier.JUNIOR,
      startDate: subDays(now, 160),
      expiryDate: addMonths(now, 4),
      status: MemberStatus.ACTIVE,
      notes: "Cricket top-order batter and tennis social player.",
    },
  ];

  const createdMembers = [];
  for (const m of membersData) {
    const member = await prisma.member.create({ data: m });
    createdMembers.push(member);
  }

  console.log("🎾 3. Seeding 4 Courts...");
  const courtsData = [
    {
      name: "Centre Tennis Court 1",
      sport: SportType.TENNIS,
      surface: "Plexicushion Synthetic (Floodlit)",
      hourlyRate: 800,
      description: "Championship synthetic court with LED broadcast floodlighting.",
    },
    {
      name: "Roland Garros Clay Court 2",
      sport: SportType.TENNIS,
      surface: "European Red Clay",
      hourlyRate: 900,
      description: "Traditional imported red clay court. Slide-friendly with high spin response.",
    },
    {
      name: "Lord's Indoor Cricket Net 1",
      sport: SportType.CRICKET,
      surface: "Synthetic AstroTurf with Bola Machine",
      hourlyRate: 750,
      description: "Automated multi-speed Bola bowling machine with speed gun and video replay.",
    },
    {
      name: "Eden Box Cricket Arena 2",
      sport: SportType.CRICKET,
      surface: "High-Bounce Cushioned Turf",
      hourlyRate: 1100,
      description: "Enclosed all-weather turf arena for 6v6 & 8v8 box cricket matches.",
    },
  ];

  const createdCourts = [];
  for (const c of courtsData) {
    const court = await prisma.court.create({ data: c });
    createdCourts.push(court);
  }

  console.log("🛍️ 4. Seeding 12 Shop Items (one below reorder threshold)...");
  const shopProductsData = [
    {
      sku: "RKT-WIL-001",
      name: "Wilson Pro Staff 97 v14",
      category: ProductCategory.RACKET,
      price: 21500,
      stockQuantity: 8,
      reorderThreshold: 3,
      description: "Precision-engineered graphite tennis racket for advanced control and feel.",
    },
    {
      sku: "RKT-BAB-002",
      name: "Babolat Pure Aero Rafa Edition",
      category: ProductCategory.RACKET,
      price: 19800,
      stockQuantity: 6,
      reorderThreshold: 3,
      description: "Spin monster racket designed in collaboration with Rafael Nadal.",
    },
    {
      sku: "BAT-SG-003",
      name: "SG Sunny Gold Grade-1 English Willow Bat",
      category: ProductCategory.RACKET,
      price: 16500,
      stockQuantity: 5,
      reorderThreshold: 2,
      description: "Handcrafted master bat with thick edges and light balanced pickup.",
    },
    {
      sku: "BAL-HEAD-004",
      name: "Head Tour Championship Balls (Can of 3)",
      category: ProductCategory.BALLS,
      price: 450,
      stockQuantity: 42,
      reorderThreshold: 15,
      description: "Premium pressurized felt balls certified for ITF tournament play.",
    },
    {
      sku: "BAL-KKB-005",
      name: "Kookaburra Turf White Leather Cricket Ball",
      category: ProductCategory.BALLS,
      price: 1200,
      stockQuantity: 18,
      reorderThreshold: 8,
      description: "Four-piece alum tanned leather ball for day/night match conditions.",
    },
    {
      sku: "SHOE-ASC-006",
      name: "Asics Gel-Resolution 9 Hardcourt",
      category: ProductCategory.SHOES,
      price: 11999,
      stockQuantity: 7,
      reorderThreshold: 4,
      description: "Ultimate stability and cushioning for aggressive baseline movement.",
    },
    {
      sku: "SHOE-PMA-007",
      name: "Puma 22.1 All-Rounder Cricket Spikes",
      category: ProductCategory.SHOES,
      price: 8499,
      stockQuantity: 6,
      reorderThreshold: 3,
      description: "Lightweight rubber and metal hybrid studs for synthetic and natural turf.",
    },
    {
      sku: "APP-CC-008",
      name: "Champions Club Official Match Polo",
      category: ProductCategory.APPAREL,
      price: 1899,
      stockQuantity: 28,
      reorderThreshold: 10,
      description: "Breathable moisture-wicking club crest jersey with UV 50+ protection.",
    },
    {
      sku: "APP-CST-009",
      name: "Castore Pro Performance Track Jacket",
      category: ProductCategory.APPAREL,
      price: 4200,
      stockQuantity: 11,
      reorderThreshold: 5,
      description: "Windproof and flexible warm-up jacket for pre-match stretching.",
    },
    {
      sku: "ACC-LUX-010",
      name: "Luxilon ALU Power 125 String Reel (220m)",
      category: ProductCategory.ACCESSORIES,
      price: 14500,
      stockQuantity: 4,
      reorderThreshold: 2,
      description: "The gold standard co-polyester monofilament tour string.",
    },
    {
      sku: "ACC-YNX-011",
      name: "Yonex Super Grap Overgrip (Pack of 3)",
      category: ProductCategory.ACCESSORIES,
      price: 350,
      stockQuantity: 36,
      reorderThreshold: 10,
      description: "High-tack absorbent polyurethane grips for sweaty match conditions.",
    },
    {
      // ⚠️ ONE BELOW REORDER THRESHOLD REQUIREMENT:
      // Stock = 2, Threshold = 5 => Needs Reorder!
      sku: "ACC-KKB-012",
      name: "Kookaburra Pro 2.0 Batting Gloves (RH)",
      category: ProductCategory.ACCESSORIES,
      price: 2400,
      stockQuantity: 2, // 2 left, threshold is 5!
      reorderThreshold: 5,
      description: "Split-finger high-density foam gloves with Pittards leather palm.",
    },
  ];

  const createdShopProducts = [];
  for (const p of shopProductsData) {
    const prod = await prisma.shopProduct.create({ data: p });
    createdShopProducts.push(prod);
  }

  console.log("🍽️ 5. Seeding 6 Bar Tables & Menu...");
  const tablesData = [
    { tableNumber: 1, name: "Table 1 - Courtside Patio", capacity: 4, status: TableStatus.AVAILABLE },
    { tableNumber: 2, name: "Table 2 - Center Dining Booth", capacity: 6, status: TableStatus.OCCUPIED },
    { tableNumber: 3, name: "Table 3 - Lounge Low Sofa", capacity: 6, status: TableStatus.AVAILABLE },
    { tableNumber: 4, name: "Table 4 - High-Top Bar Stools", capacity: 2, status: TableStatus.AVAILABLE },
    { tableNumber: 5, name: "Table 5 - Terrace Pergola", capacity: 8, status: TableStatus.OCCUPIED },
    { tableNumber: 6, name: "Table 6 - VIP Match Lounge", capacity: 4, status: TableStatus.RESERVED },
  ];

  const createdTables = [];
  for (const t of tablesData) {
    const table = await prisma.barTable.create({ data: t });
    createdTables.push(table);
  }

  const menuItemsData = [
    { name: "Artisanal Filter Coffee", category: MenuCategory.BEVERAGES, price: 120, prepTimeMinutes: 5 },
    { name: "Cold Brew Tonic with Orange Peel", category: MenuCategory.BEVERAGES, price: 220, prepTimeMinutes: 5 },
    { name: "Fresh Valencia Orange & Carrot Juice", category: MenuCategory.BEVERAGES, price: 180, prepTimeMinutes: 8 },
    { name: "Fast&Up Active Electrolyte Lime Fizz", category: MenuCategory.ENERGY_DRINKS, price: 140, prepTimeMinutes: 3 },
    { name: "Red Bull Energy 250ml", category: MenuCategory.ENERGY_DRINKS, price: 160, prepTimeMinutes: 2 },
    { name: "Truffle Parmesan Hand-Cut Fries", category: MenuCategory.SNACKS, price: 260, prepTimeMinutes: 12 },
    { name: "Grilled Chicken Tikka & Cheddar Panini", category: MenuCategory.SNACKS, price: 320, prepTimeMinutes: 15 },
    { name: "Sourdough Avocado & Poached Egg Toast", category: MenuCategory.SNACKS, price: 310, prepTimeMinutes: 12 },
    { name: "Post-Workout High-Protein Chicken Bowl", category: MenuCategory.MAINS, price: 380, prepTimeMinutes: 18 },
    { name: "Champions Double Smash Cheeseburger", category: MenuCategory.MAINS, price: 420, prepTimeMinutes: 16 },
    { name: "Wood-Fired Margherita & Basil Pizza", category: MenuCategory.MAINS, price: 480, prepTimeMinutes: 20 },
    { name: "Mediterranean Hummus & Falafel Platter", category: MenuCategory.SNACKS, price: 290, prepTimeMinutes: 10 },
  ];

  const createdMenuItems = [];
  for (const m of menuItemsData) {
    const item = await prisma.barMenuItem.create({ data: m });
    createdMenuItems.push(item);
  }

  // Create active open tabs for the 2 occupied tables
  const table2 = createdTables[1];
  const table5 = createdTables[4];

  // Tab for Table 2 (Member: Rohan Sharma)
  const tab1Calc = PricingCalculator.calculateBarBill({
    items: [
      { unitPrice: 380, quantity: 2 },
      { unitPrice: 220, quantity: 2 },
      { unitPrice: 260, quantity: 1 },
    ],
    plan: goldPlan,
  });

  const tab1 = await prisma.barTab.create({
    data: {
      tabNumber: "TAB-02-101",
      tableId: table2.id,
      memberId: createdMembers[0].id, // Rohan Sharma (Gold)
      status: TabStatus.OPEN,
      subtotal: tab1Calc.subtotal,
      discountAmount: tab1Calc.discountAmount,
      taxAmount: tab1Calc.taxAmount,
      finalAmount: tab1Calc.finalAmount,
      openedAt: setMinutes(setHours(now, 13), 30),
      items: {
        create: [
          {
            menuItemId: createdMenuItems[8].id, // Chicken Bowl
            quantity: 2,
            unitPrice: 380,
            totalPrice: 760,
            kitchenStatus: KitchenStatus.SERVED,
            kitchenNotes: "Extra grilled chicken dressing on side",
          },
          {
            menuItemId: createdMenuItems[1].id, // Cold Brew
            quantity: 2,
            unitPrice: 220,
            totalPrice: 440,
            kitchenStatus: KitchenStatus.SERVED,
          },
          {
            menuItemId: createdMenuItems[5].id, // Truffle Fries
            quantity: 1,
            unitPrice: 260,
            totalPrice: 260,
            kitchenStatus: KitchenStatus.PREPARING, // Currently cooking in kitchen!
            kitchenNotes: "Crispy well-done please",
          },
        ],
      },
    },
  });

  // Tab for Table 5 (Walk-in group / Social match)
  const tab2Calc = PricingCalculator.calculateBarBill({
    items: [
      { unitPrice: 480, quantity: 2 },
      { unitPrice: 140, quantity: 4 },
      { unitPrice: 420, quantity: 2 },
    ],
    plan: null, // Walk-in, no discount
  });

  const tab2 = await prisma.barTab.create({
    data: {
      tabNumber: "TAB-05-102",
      tableId: table5.id,
      guestName: "Vikram Group (Cricket Match Tab)",
      status: TabStatus.OPEN,
      subtotal: tab2Calc.subtotal,
      discountAmount: tab2Calc.discountAmount,
      taxAmount: tab2Calc.taxAmount,
      finalAmount: tab2Calc.finalAmount,
      openedAt: setMinutes(setHours(now, 14), 0),
      items: {
        create: [
          {
            menuItemId: createdMenuItems[10].id, // Pizza
            quantity: 2,
            unitPrice: 480,
            totalPrice: 960,
            kitchenStatus: KitchenStatus.READY, // In kitchen pass ready to serve!
          },
          {
            menuItemId: createdMenuItems[3].id, // Fast&Up Electrolyte
            quantity: 4,
            unitPrice: 140,
            totalPrice: 560,
            kitchenStatus: KitchenStatus.SERVED,
          },
          {
            menuItemId: createdMenuItems[9].id, // Smash Burger
            quantity: 2,
            unitPrice: 420,
            totalPrice: 840,
            kitchenStatus: KitchenStatus.PREPARING,
          },
        ],
      },
    },
  });

  console.log("📊 6. Seeding 30 Days of Historical Ledger Entries & Linked Records...");
  const paymentMethods = [PaymentMethod.UPI, PaymentMethod.CARD, PaymentMethod.CASH];
  let txnCounter = 1000;

  // Let's create transactions across past 30 days
  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const dayDate = subDays(now, dayOffset);
    const dayOfWeek = dayDate.getDay(); // 0 is Sunday, 5 is Friday

    // 1. Daily Court Bookings
    const numCourtBookings = dayOfWeek === 0 || dayOfWeek === 6 ? 4 : 2;
    for (let c = 0; c < numCourtBookings; c++) {
      const court = createdCourts[c % createdCourts.length];
      const member = c % 2 === 0 ? createdMembers[(dayOffset + c) % createdMembers.length] : null;
      const plan = member
        ? member.planTier === PlanTier.GOLD
          ? goldPlan
          : member.planTier === PlanTier.SILVER
          ? silverPlan
          : juniorPlan
        : null;

      const isSocialPlay = dayOfWeek === 5 && c === 0; // Friday social play!
      const calc = PricingCalculator.calculateCourtBooking({
        hourlyRate: court.hourlyRate,
        plan,
        isSocialPlay,
        socialPlayersCount: isSocialPlay ? 4 : 1,
      });

      const startTime = setMinutes(setHours(dayDate, 17 + (c % 4)), (c % 2) * 30);
      const endTime = addDays(setMinutes(setHours(dayDate, 18 + (c % 4)), (c % 2) * 30), 0);

      const method = paymentMethods[(dayOffset + c) % paymentMethods.length];
      txnCounter++;
      const refNo = `TXN-${dayDate.getFullYear()}${String(dayDate.getMonth() + 1).padStart(2, "0")}-${txnCounter}`;

      if (calc.finalPrice > 0) {
        const txn = await prisma.transaction.create({
          data: {
            referenceNo: refNo,
            type: TransactionType.COURT_BOOKING,
            category: TransactionCategory.COURT,
            amount: calc.finalPrice,
            paymentMethod: method,
            memberId: member ? member.id : null,
            notes: `Court booking: ${court.name} (${isSocialPlay ? "Friday Social Play" : "Standard 60m"})`,
            createdAt: setHours(dayDate, 16 + (c % 3)),
          },
        });

        await prisma.courtBooking.create({
          data: {
            courtId: court.id,
            memberId: member ? member.id : null,
            guestName: member ? null : `Walk-in Guest ${dayOffset}-${c}`,
            startTime,
            endTime,
            isSocialPlay,
            socialPlayersCount: isSocialPlay ? 4 : 1,
            basePrice: calc.basePrice,
            discountAmount: calc.discountAmount,
            finalPrice: calc.finalPrice,
            status: BookingStatus.COMPLETED,
            paymentStatus: PaymentStatus.PAID,
            paymentMethod: method,
            transactionId: txn.id,
          },
        });
      } else {
        // Gold member 100% free booking (no payment charged, but tracked)
        await prisma.courtBooking.create({
          data: {
            courtId: court.id,
            memberId: member ? member.id : null,
            startTime,
            endTime,
            isSocialPlay: false,
            basePrice: calc.basePrice,
            discountAmount: calc.discountAmount,
            finalPrice: 0,
            status: BookingStatus.COMPLETED,
            paymentStatus: PaymentStatus.PAID,
            notes: "Gold Member 100% Free All-Access Benefit",
          },
        });
      }
    }

    // 2. Daily Pro Shop Purchases
    if (dayOffset % 2 === 0) {
      const prod = createdShopProducts[(dayOffset * 3) % createdShopProducts.length];
      const member = createdMembers[(dayOffset * 2) % createdMembers.length];
      const plan =
        member.planTier === PlanTier.GOLD
          ? goldPlan
          : member.planTier === PlanTier.SILVER
          ? silverPlan
          : juniorPlan;

      const shopCalc = PricingCalculator.calculateShopOrder({
        items: [{ unitPrice: prod.price, quantity: 1 }],
        plan,
      });

      txnCounter++;
      const refNo = `TXN-${dayDate.getFullYear()}${String(dayDate.getMonth() + 1).padStart(2, "0")}-${txnCounter}`;
      const method = paymentMethods[(dayOffset + 1) % paymentMethods.length];

      const txn = await prisma.transaction.create({
        data: {
          referenceNo: refNo,
          type: TransactionType.SHOP_PURCHASE,
          category: TransactionCategory.SHOP,
          amount: shopCalc.finalPrice,
          paymentMethod: method,
          memberId: member.id,
          notes: `Pro Shop sale: ${prod.name} (Tier discount ${shopCalc.discountPercent}%)`,
          createdAt: setHours(dayDate, 14),
        },
      });

      await prisma.shopOrder.create({
        data: {
          orderNumber: `ORD-${dayDate.getFullYear()}${String(dayDate.getMonth() + 1).padStart(2, "0")}-${txnCounter}`,
          memberId: member.id,
          customerName: member.name,
          customerPhone: member.phone,
          orderType: dayOffset % 4 === 0 ? OrderType.ONLINE_COLLECTION : OrderType.IN_STORE,
          status: OrderStatus.COMPLETED,
          totalBasePrice: shopCalc.subtotal,
          discountAmount: shopCalc.discountAmount,
          finalPrice: shopCalc.finalPrice,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: method,
          transactionId: txn.id,
          items: {
            create: [
              {
                productId: prod.id,
                quantity: 1,
                unitPrice: prod.price,
                totalPrice: prod.price,
              },
            ],
          },
        },
      });
    }

    // 3. Daily Bar & Cafeteria Settled Tabs
    const barRounds = dayOfWeek === 5 || dayOfWeek === 6 ? 3 : 2;
    for (let b = 0; b < barRounds; b++) {
      const member = b === 0 ? createdMembers[(dayOffset + 5) % createdMembers.length] : null;
      const plan = member
        ? member.planTier === PlanTier.GOLD
          ? goldPlan
          : member.planTier === PlanTier.SILVER
          ? silverPlan
          : juniorPlan
        : null;

      const mItem1 = createdMenuItems[(dayOffset + b) % createdMenuItems.length];
      const mItem2 = createdMenuItems[(dayOffset + b + 3) % createdMenuItems.length];

      const barCalc = PricingCalculator.calculateBarBill({
        items: [
          { unitPrice: mItem1.price, quantity: 2 },
          { unitPrice: mItem2.price, quantity: 1 },
        ],
        plan,
      });

      txnCounter++;
      const refNo = `TXN-${dayDate.getFullYear()}${String(dayDate.getMonth() + 1).padStart(2, "0")}-${txnCounter}`;
      const method = paymentMethods[(dayOffset + b) % paymentMethods.length];

      const txn = await prisma.transaction.create({
        data: {
          referenceNo: refNo,
          type: TransactionType.BAR_BILL,
          category: TransactionCategory.BAR,
          amount: barCalc.finalAmount,
          paymentMethod: method,
          memberId: member ? member.id : null,
          notes: `Settled Bar Tab: Table ${(b % 6) + 1} (${member ? member.name : "Walk-in"})`,
          createdAt: setHours(dayDate, 20 + (b % 2)),
        },
      });

      await prisma.barTab.create({
        data: {
          tabNumber: `TAB-HIST-${dayOffset}-${b}`,
          tableId: createdTables[b % createdTables.length].id,
          memberId: member ? member.id : null,
          guestName: member ? null : `Bar Guest ${dayOffset}-${b}`,
          status: TabStatus.CLOSED,
          subtotal: barCalc.subtotal,
          discountAmount: barCalc.discountAmount,
          taxAmount: barCalc.taxAmount,
          finalAmount: barCalc.finalAmount,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: method,
          transactionId: txn.id,
          openedAt: setHours(dayDate, 19),
          closedAt: setHours(dayDate, 20 + (b % 2)),
          items: {
            create: [
              {
                menuItemId: mItem1.id,
                quantity: 2,
                unitPrice: mItem1.price,
                totalPrice: mItem1.price * 2,
                kitchenStatus: KitchenStatus.SERVED,
              },
              {
                menuItemId: mItem2.id,
                quantity: 1,
                unitPrice: mItem2.price,
                totalPrice: mItem2.price,
                kitchenStatus: KitchenStatus.SERVED,
              },
            ],
          },
        },
      });
    }

    // 4. Periodic Membership Fees
    if (dayOffset % 7 === 0) {
      const member = createdMembers[dayOffset % createdMembers.length];
      const plan =
        member.planTier === PlanTier.GOLD
          ? goldPlan
          : member.planTier === PlanTier.SILVER
          ? silverPlan
          : juniorPlan;

      txnCounter++;
      const refNo = `TXN-${dayDate.getFullYear()}${String(dayDate.getMonth() + 1).padStart(2, "0")}-${txnCounter}`;
      await prisma.transaction.create({
        data: {
          referenceNo: refNo,
          type: TransactionType.MEMBERSHIP_FEE,
          category: TransactionCategory.MEMBERSHIP,
          amount: plan.monthlyFee,
          paymentMethod: PaymentMethod.UPI,
          memberId: member.id,
          notes: `Monthly Membership Renewal: ${plan.name} (${member.name})`,
          createdAt: setHours(dayDate, 11),
        },
      });
    }

    // 5. Corporate Invoicing
    if (dayOffset === 12 || dayOffset === 25) {
      txnCounter++;
      const refNo = `TXN-${dayDate.getFullYear()}${String(dayDate.getMonth() + 1).padStart(2, "0")}-${txnCounter}`;
      await prisma.transaction.create({
        data: {
          referenceNo: refNo,
          type: TransactionType.CORPORATE_INVOICE,
          category: TransactionCategory.CORPORATE,
          amount: dayOffset === 12 ? 45000 : 65000,
          paymentMethod: PaymentMethod.CARD,
          notes: `Corporate League Package settlement - Infosys Sports Club`,
          createdAt: setHours(dayDate, 15),
        },
      });
    }
  }

  console.log("👥 7. Seeding Staff, Shifts, and Leaves...");
  const staffData = [
    { name: "Sunil Gavaskar K.", role: StaffRole.FRONT_DESK, phone: "+91 99001 11222", email: "sunil.k@champions.club", hourlyWage: 200, monthlySalary: 38000 },
    { name: "Devika Rao", role: StaffRole.FRONT_DESK, phone: "+91 99002 22333", email: "devika.r@champions.club", hourlyWage: 200, monthlySalary: 38000 },
    { name: "Chef Harish Rawat", role: StaffRole.CHEF, phone: "+91 99003 33444", email: "harish.r@champions.club", hourlyWage: 250, monthlySalary: 45000 },
    { name: "Manoj Barista", role: StaffRole.BARISTA, phone: "+91 99004 44555", email: "manoj.b@champions.club", hourlyWage: 180, monthlySalary: 32000 },
    { name: "Coach Anand Kumar", role: StaffRole.COURT_COACH, phone: "+91 99005 55666", email: "coach.anand@champions.club", hourlyWage: 350, monthlySalary: 55000 },
    { name: "Farhan Merchant", role: StaffRole.MANAGER, phone: "+91 99006 66777", email: "farhan.m@champions.club", hourlyWage: 400, monthlySalary: 65000 },
  ];

  const createdStaff = [];
  for (const s of staffData) {
    const staff = await prisma.staffMember.create({ data: s });
    createdStaff.push(staff);
  }

  // Shifts for today
  await prisma.shift.createMany({
    data: [
      { staffId: createdStaff[0].id, date: now, startTime: "06:00", endTime: "14:00", hoursWorked: 8, notes: "Morning court desk & opening checklist" },
      { staffId: createdStaff[1].id, date: now, startTime: "14:00", endTime: "22:00", hoursWorked: 8, notes: "Evening rush & cash drawer reconciliation" },
      { staffId: createdStaff[2].id, date: now, startTime: "11:00", endTime: "22:00", hoursWorked: 10, notes: "Kitchen prep & dinner service" },
      { staffId: createdStaff[3].id, date: now, startTime: "12:00", endTime: "21:00", hoursWorked: 8, notes: "Bar counter & espresso maintenance" },
    ],
  });

  // Sample Leave request
  await prisma.leave.create({
    data: {
      staffId: createdStaff[4].id,
      startDate: addDays(now, 5),
      endDate: addDays(now, 7),
      reason: "Attending National Tennis Coaching Level-2 Certification",
      status: LeaveStatus.PENDING,
    },
  });

  console.log("📨 8. Seeding Online Leads & Inquiries...");
  await prisma.lead.createMany({
    data: [
      {
        name: "Deepak Chawla",
        email: "deepak.c@techcorp.in",
        phone: "+91 97111 88990",
        interest: "Tennis Trial & Gold Membership",
        status: LeadStatus.NEW,
        notes: "Requested a Saturday 10 AM trial session for himself and his spouse.",
        trialDate: addDays(now, 2),
      },
      {
        name: "Meera Krishnan",
        email: "meera.krish@gmail.com",
        phone: "+91 97112 99001",
        interest: "Junior Cricket Academy (Son 11 yrs)",
        status: LeadStatus.QUOTE_SENT,
        quoteAmount: 18000,
        notes: "Sent quote for 3-month Junior Academy batch + custom gear kit.",
      },
      {
        name: "Accenture Sports Committee",
        email: "sports.hyd@accenture.com",
        phone: "+91 97113 00112",
        interest: "Weekend Box Cricket Corporate Tournament",
        status: LeadStatus.CONTACTED,
        quoteAmount: 75000,
        notes: "Followed up with HR manager. Awaiting date confirmation for 16 teams.",
      },
    ],
  });

  console.log("🧾 9. Seeding Corporate Invoices...");
  await prisma.invoice.createMany({
    data: [
      {
        invoiceNumber: "INV-2026-089",
        clientName: "Infosys Sports Committee",
        clientEmail: "sports@infosys.com",
        clientType: "CORPORATE",
        amount: 45000,
        taxAmount: 8100,
        totalAmount: 53100,
        dueDate: addDays(now, 10),
        status: PaymentStatus.PENDING,
        description: "Quarterly corporate court booking reservation (10 slots/week)",
      },
      {
        invoiceNumber: "INV-2026-090",
        clientName: "Tata Consultancy Services Tennis League",
        clientEmail: "admin@tcs-sports.org",
        clientType: "CORPORATE",
        amount: 32000,
        taxAmount: 5760,
        totalAmount: 37760,
        dueDate: subDays(now, 2),
        status: PaymentStatus.PAID,
        description: "Inter-company tennis championship court fee & refreshments",
      },
    ],
  });

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "./lib/auth-token";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Static asset and internal Next.js exemptions
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.match(/\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // 2. Public auth endpoints and public APIs
  const isPublicAuthRoute =
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/me";

  const isPublicApiRoute =
    isPublicAuthRoute ||
    pathname === "/api/members/join" ||
    (pathname === "/api/plans" && req.method.toUpperCase() === "GET") ||
    (pathname === "/api/courts" && req.method.toUpperCase() === "GET") ||
    (pathname === "/api/leads" && req.method.toUpperCase() === "POST");

  // Public pages accessible without logging in
  const isPublicPage =
    pathname === "/memberships" ||
    pathname.startsWith("/memberships/") ||
    pathname === "/join" ||
    pathname.startsWith("/join/");

  // Read and verify session cookie
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const payload = sessionCookie ? await verifySessionToken(sessionCookie) : null;
  const isAuthenticated = !!payload;

  // 3. Login page route logic
  if (pathname === "/login" || pathname === "/login/") {
    // Allow users to access /login whether unauthenticated or authenticated
    // so they can view session info, switch personas, or sign in as different roles
    return NextResponse.next();
  }

  // 4. Public pages allowed without login
  if (isPublicPage) {
    return NextResponse.next();
  }

  // 5. Public API routes (accessible whether unauthenticated or authenticated)
  if (isPublicApiRoute) {
    if (isAuthenticated) {
      const requestHeaders = new Headers(req.headers);
      requestHeaders.set("x-user-id", payload.userId);
      requestHeaders.set("x-user-role", payload.role);
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    }
    return NextResponse.next();
  }

  // 6. Unauthenticated guard for protected routes
  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Please log in to proceed." },
        { status: 401 }
      );
    }

    // Redirect unauthenticated page requests to /login with callbackUrl
    const callbackUrl = encodeURIComponent(`${pathname}${search}`);
    const loginUrl = new URL(`/login?callbackUrl=${callbackUrl}`, req.url);
    return NextResponse.redirect(loginUrl);
  }

  // 6. Granular Role-Based Access Control (RBAC) on API routes
  if (pathname.startsWith("/api/")) {
    const role = payload.role;
    const method = req.method.toUpperCase();

    // The OWNER role has unrestricted super-admin privileges across all routes
    if (role !== "OWNER") {
      // Finance: strictly OWNER only
      if (pathname.startsWith("/api/finance")) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Finance reports require OWNER permissions." },
          { status: 403 }
        );
      }

      // HR & Staff Management: strictly OWNER only
      if (pathname.startsWith("/api/hr")) {
        return NextResponse.json(
          { success: false, error: "Forbidden: HR records require OWNER permissions." },
          { status: 403 }
        );
      }

      // Security Audit Logs: strictly OWNER only
      if (pathname.startsWith("/api/auth/audit")) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Security audit log requires OWNER permissions." },
          { status: 403 }
        );
      }

      // Admin Endpoints: strictly OWNER only across all HTTP methods
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { success: false, error: "Forbidden: Admin endpoints require OWNER permissions." },
          { status: 403 }
        );
      }

      // Membership Plans Configuration: strictly OWNER only for mutations
      if (pathname.startsWith("/api/plans")) {
        if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
          return NextResponse.json(
            { success: false, error: "Forbidden: Modifying membership plans requires OWNER permissions." },
            { status: 403 }
          );
        }
      }

      // CRM Leads & Invoicing: OWNER and FRONT_DESK
      if (pathname.startsWith("/api/leads") || pathname.startsWith("/api/invoices")) {
        if (role !== "FRONT_DESK") {
          return NextResponse.json(
            { success: false, error: "Forbidden: Leads and invoices require FRONT_DESK or OWNER role." },
            { status: 403 }
          );
        }
      }

      // Members Management (Staff only - /api/members/join is public and exempt)
      if (pathname.startsWith("/api/members") && pathname !== "/api/members/join") {
        // Modifying members requires FRONT_DESK or OWNER
        if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
          if (role !== "FRONT_DESK") {
            return NextResponse.json(
              { success: false, error: "Forbidden: Member management requires FRONT_DESK or OWNER role." },
              { status: 403 }
            );
          }
        }
      }

      // Courts Management: modifications require FRONT_DESK or COACH
      if (pathname.startsWith("/api/courts")) {
        if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
          if (role !== "FRONT_DESK" && role !== "COACH") {
            return NextResponse.json(
              { success: false, error: "Forbidden: Court configuration requires FRONT_DESK or COACH role." },
              { status: 403 }
            );
          }
        }
      }

      // Bookings: Any authenticated user can read or POST (members book courts), but modify/cancel requires FRONT_DESK/COACH
      if (pathname.startsWith("/api/bookings")) {
        if (["PUT", "DELETE", "PATCH"].includes(method)) {
          if (role !== "FRONT_DESK" && role !== "COACH") {
            return NextResponse.json(
              { success: false, error: "Forbidden: Booking modification requires FRONT_DESK or COACH role." },
              { status: 403 }
            );
          }
        }
      }

      // Pro Shop Products: modifying inventory requires PRO_SHOP
      if (pathname.startsWith("/api/shop/products")) {
        if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
          if (role !== "PRO_SHOP") {
            return NextResponse.json(
              { success: false, error: "Forbidden: Inventory updates require PRO_SHOP role." },
              { status: 403 }
            );
          }
        }
      }

      // Pro Shop Orders: creating orders is allowed for all, but status updating/cancelling requires PRO_SHOP
      if (pathname.startsWith("/api/shop/orders")) {
        if (["PUT", "DELETE", "PATCH"].includes(method)) {
          if (role !== "PRO_SHOP") {
            return NextResponse.json(
              { success: false, error: "Forbidden: Order management requires PRO_SHOP role." },
              { status: 403 }
            );
          }
        }
      }

      // Bar & Café Tabs: modifications require BAR_STAFF or CHEF
      if (pathname.startsWith("/api/bar/tabs")) {
        if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
          if (role !== "BAR_STAFF" && role !== "CHEF") {
            return NextResponse.json(
              { success: false, error: "Forbidden: Bar and kitchen tabs require BAR_STAFF or CHEF role." },
              { status: 403 }
            );
          }
        }
      }

      // Bar Menu & Tables: modifications require BAR_STAFF
      if (pathname.startsWith("/api/bar/menu") || pathname.startsWith("/api/bar/tables")) {
        if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
          if (role !== "BAR_STAFF") {
            return NextResponse.json(
              { success: false, error: "Forbidden: Bar setup requires BAR_STAFF role." },
              { status: 403 }
            );
          }
        }
      }

      // Financial Transactions: reading requires FRONT_DESK
      if (pathname.startsWith("/api/transactions")) {
        if (method === "GET") {
          if (role !== "FRONT_DESK") {
            return NextResponse.json(
              { success: false, error: "Forbidden: Transaction records require FRONT_DESK or OWNER role." },
              { status: 403 }
            );
          }
        }
      }
    }

    // Attach verified user claims to request headers for downstream handlers
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", payload.userId);
    requestHeaders.set("x-user-role", payload.role);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

export default middleware;

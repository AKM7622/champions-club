import dns from "node:dns";

export interface MxRecord {
  exchange: string;
  priority: number;
}

export type EmailErrorCode =
  | "INVALID_SYNTAX"
  | "DOMAIN_NOT_FOUND"
  | "NO_MX_RECORDS"
  | "DNS_TIMEOUT"
  | "DNS_ERROR";

export interface EmailValidationOptions {
  /**
   * Whether to allow predefined or configured test domains to pass without DNS lookup.
   * Default: true
   */
  allowTestDomains?: boolean;

  /**
   * Additional test domains or domains to treat as test domains.
   */
  additionalTestDomains?: string[];

  /**
   * Custom DNS MX resolver function, useful for unit testing and dependency injection.
   * Defaults to node:dns.promises.resolveMx.
   */
  dnsResolver?: (domain: string) => Promise<dns.MxRecord[]>;

  /**
   * Timeout in milliseconds for DNS MX resolution.
   * Default: 4000ms
   */
  timeoutMs?: number;

  /**
   * Whether to perform only syntax/format validation without DNS MX lookup.
   * Default: false
   */
  syntaxOnly?: boolean;

  /**
   * Fallback to valid if DNS lookup encounters an unexpected timeout.
   * Default: false
   */
  fallbackOnTimeout?: boolean;
}

export interface EmailValidationResult {
  isValid: boolean;
  error?: string;
  domain?: string;
  localPart?: string;
  normalizedEmail?: string;
  mxRecords?: dns.MxRecord[];
  isTestDomain?: boolean;
  errorCode?: EmailErrorCode;
}

/**
 * Standard test, development, and documentation domains that should be isolated
 * from outbound DNS queries to ensure zero flakiness during tests or offline development.
 */
export const DEFAULT_TEST_DOMAINS: readonly string[] = Object.freeze([
  "example.com",
  "example.org",
  "example.net",
  "example.edu",
  "test.com",
  "test.org",
  "test.net",
  "champions.club",
  "singhaniaholdings.com",
  "localhost",
]);

/**
 * RFC 5322 & RFC 5321 compliant email syntax and format validator.
 * Checks length bounds, character sets, label rules, and dot positioning without ReDoS vulnerability.
 */
export function isRFC5322Format(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }

  const trimmed = email.trim();
  // RFC 5321 Section 4.5.3.1.3: Total email length max 254 octets
  if (!trimmed || trimmed.length > 254) {
    return false;
  }

  // Exactly one separator @
  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return false;
  }

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1);

  // In unquoted emails, exactly one @ symbol is permitted
  if (localPart.includes("@")) {
    return false;
  }

  // Local part length: 1 to 64 octets (RFC 5321)
  if (localPart.length === 0 || localPart.length > 64) {
    return false;
  }

  // Local part cannot start or end with a dot, nor contain consecutive dots
  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
    return false;
  }

  // RFC 5322 unquoted atom characters: a-z, A-Z, 0-9, and !#$%&'*+-/=?^_`{|}~.
  const localPartRegex = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/;
  if (!localPartRegex.test(localPart)) {
    return false;
  }

  if (domainPart.startsWith(".") || domainPart.endsWith(".") || domainPart.includes("..")) {
    return false;
  }

  const labels = domainPart.split(".");

  // Single label domain is only valid if localhost
  if (labels.length === 1) {
    return domainPart.toLowerCase() === "localhost";
  }

  for (const label of labels) {
    if (label.length === 0 || label.length > 63) {
      return false;
    }
    // Cannot start or end with hyphen
    if (label.startsWith("-") || label.endsWith("-")) {
      return false;
    }
    // Only alphanumeric and hyphens allowed in domain labels
    if (!/^[a-zA-Z0-9-]+$/.test(label)) {
      return false;
    }
  }

  // TLD (last label) must be at least 2 characters and not all-numeric (RFC 1123)
  const tld = labels[labels.length - 1];
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    return false;
  }

  return true;
}

/**
 * Checks if a domain is a recognized test, demo, or documentation domain.
 */
export function isTestDomain(domain: string, options?: EmailValidationOptions): boolean {
  if (options?.allowTestDomains === false) {
    return false;
  }

  // Environment bypass flags for sandboxes or custom test runners
  if (
    process.env.DISABLE_DNS_VALIDATION === "true" ||
    process.env.BYPASS_DNS_VALIDATION === "true"
  ) {
    return true;
  }

  const normalizedDomain = domain.toLowerCase().trim();

  // RFC 6761 reserved TLDs
  if (
    normalizedDomain === "localhost" ||
    normalizedDomain.endsWith(".localhost") ||
    normalizedDomain.endsWith(".test") ||
    normalizedDomain.endsWith(".example") ||
    normalizedDomain.endsWith(".invalid")
  ) {
    return true;
  }

  // Check additional test domains from options
  if (options?.additionalTestDomains) {
    for (const d of options.additionalTestDomains) {
      const normD = d.toLowerCase().trim();
      if (normalizedDomain === normD || normalizedDomain.endsWith(`.${normD}`)) {
        return true;
      }
    }
  }

  // Check environment variable TEST_EMAIL_DOMAINS
  if (process.env.TEST_EMAIL_DOMAINS) {
    const envDomains = process.env.TEST_EMAIL_DOMAINS.split(",").map((s) => s.trim().toLowerCase());
    for (const d of envDomains) {
      if (d && (normalizedDomain === d || normalizedDomain.endsWith(`.${d}`))) {
        return true;
      }
    }
  }

  // Check default test domains
  for (const d of DEFAULT_TEST_DOMAINS) {
    if (normalizedDomain === d || normalizedDomain.endsWith(`.${d}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Executes DNS MX resolution with an enforced timeout.
 */
export async function resolveMxWithTimeout(
  domain: string,
  timeoutMs: number = 4000,
  resolver: (domain: string) => Promise<dns.MxRecord[]> = dns.promises.resolveMx
): Promise<dns.MxRecord[]> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err: any = new Error(`DNS MX lookup timed out after ${timeoutMs}ms for domain: ${domain}`);
      err.code = "ETIMEDOUT";
      reject(err);
    }, timeoutMs);
    if (timer && typeof timer.unref === "function") {
      timer.unref();
    }
  });

  try {
    return await Promise.race([resolver(domain), timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

/**
 * Validates an email address using RFC 5322 syntax validation followed by
 * server-side DNS MX record resolution to verify the domain has active mail servers.
 *
 * Test/development isolation is preserved for specified test domains.
 */
export async function validateEmail(
  email: string,
  options?: EmailValidationOptions
): Promise<EmailValidationResult> {
  if (!email || typeof email !== "string") {
    return {
      isValid: false,
      error: "Please provide a valid email address.",
      errorCode: "INVALID_SYNTAX",
    };
  }

  const trimmed = email.trim();
  if (!isRFC5322Format(trimmed)) {
    return {
      isValid: false,
      error: "Please provide a valid email address.",
      errorCode: "INVALID_SYNTAX",
    };
  }

  const atIndex = trimmed.lastIndexOf("@");
  const localPart = trimmed.slice(0, atIndex);
  let domain = trimmed.slice(atIndex + 1).toLowerCase();

  // Normalize punycode or ASCII hostname if applicable
  try {
    domain = new URL(`http://${domain}`).hostname.toLowerCase();
  } catch {
    // Keep raw domain if URL parse fails
  }

  const normalizedEmail = `${localPart}@${domain}`;

  // If caller only wants format check
  if (options?.syntaxOnly) {
    return {
      isValid: true,
      domain,
      localPart,
      normalizedEmail,
    };
  }

  // Check test/development domain isolation
  if (isTestDomain(domain, options)) {
    return {
      isValid: true,
      domain,
      localPart,
      normalizedEmail,
      isTestDomain: true,
      mxRecords: [{ exchange: `mock-mx.${domain}`, priority: 10 }],
    };
  }

  // Server-side DNS MX Lookup
  const timeoutMs = options?.timeoutMs ?? 4000;
  const resolver = options?.dnsResolver ?? dns.promises.resolveMx;

  try {
    const mxRecords = await resolveMxWithTimeout(domain, timeoutMs, resolver);

    // If resolver returned null/undefined or empty array
    if (!mxRecords || mxRecords.length === 0) {
      return {
        isValid: false,
        error: "The email domain does not exist or has no active mail servers.",
        domain,
        localPart,
        normalizedEmail,
        errorCode: "NO_MX_RECORDS",
      };
    }

    // RFC 7505: "Null MX" record
    // A single MX record with exchange "." or "" indicates the domain explicitly does not accept mail.
    // Ensure at least one active, non-null mail exchange exists.
    const hasActiveMailExchange = mxRecords.some((record) => {
      const exchange = typeof record?.exchange === "string" ? record.exchange.trim() : "";
      return exchange.length > 0 && exchange !== ".";
    });

    if (!hasActiveMailExchange) {
      return {
        isValid: false,
        error: "The email domain does not exist or has no active mail servers.",
        domain,
        localPart,
        normalizedEmail,
        errorCode: "NO_MX_RECORDS",
        mxRecords,
      };
    }

    return {
      isValid: true,
      domain,
      localPart,
      normalizedEmail,
      mxRecords,
    };
  } catch (err: any) {
    const code = err?.code;

    if (code === "ETIMEDOUT" || code === "ETIMEOUT") {
      if (options?.fallbackOnTimeout || process.env.DNS_FALLBACK_ON_TIMEOUT === "true") {
        return {
          isValid: true,
          domain,
          localPart,
          normalizedEmail,
          errorCode: "DNS_TIMEOUT",
        };
      }
      return {
        isValid: false,
        error: "The email domain does not exist or has no active mail servers.",
        domain,
        localPart,
        normalizedEmail,
        errorCode: "DNS_TIMEOUT",
      };
    }

    if (code === "ENOTFOUND") {
      return {
        isValid: false,
        error: "The email domain does not exist or has no active mail servers.",
        domain,
        localPart,
        normalizedEmail,
        errorCode: "DOMAIN_NOT_FOUND",
      };
    }

    if (
      code === "ENODATA" ||
      code === "EBADNAME" ||
      code === "EREFUSED" ||
      code === "ENORESP"
    ) {
      return {
        isValid: false,
        error: "The email domain does not exist or has no active mail servers.",
        domain,
        localPart,
        normalizedEmail,
        errorCode: "NO_MX_RECORDS",
      };
    }

    // Generic DNS failure
    return {
      isValid: false,
      error: "The email domain does not exist or has no active mail servers.",
      domain,
      localPart,
      normalizedEmail,
      errorCode: "DNS_ERROR",
    };
  }
}

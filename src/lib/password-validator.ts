/**
 * Production Password Strength & Policy Validator
 */

export interface PasswordCriterion {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 to 4
  strengthLabel: "Too Weak" | "Weak" | "Fair" | "Strong" | "Very Strong";
  criteria: PasswordCriterion[];
  errorMessage?: string;
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const pwd = password || "";

  const criteria: PasswordCriterion[] = [
    {
      id: "length",
      label: "At least 8 characters",
      met: pwd.length >= 8,
    },
    {
      id: "lowercase",
      label: "One lowercase letter (a-z)",
      met: /[a-z]/.test(pwd),
    },
    {
      id: "uppercase",
      label: "One uppercase letter (A-Z)",
      met: /[A-Z]/.test(pwd),
    },
    {
      id: "number",
      label: "One number (0-9)",
      met: /[0-9]/.test(pwd),
    },
    {
      id: "special",
      label: "One special character (symbol)",
      met: /[^A-Za-z0-9]/.test(pwd),
    },
  ];

  // Required criteria for validation
  const requiredMet = criteria.filter((c) => c.id !== "special").every((c) => c.met);
  const totalMet = criteria.filter((c) => c.met).length;

  let strengthLabel: "Too Weak" | "Weak" | "Fair" | "Strong" | "Very Strong" = "Too Weak";
  let score = 0;

  if (totalMet <= 1) {
    strengthLabel = "Too Weak";
    score = 0;
  } else if (totalMet === 2) {
    strengthLabel = "Weak";
    score = 1;
  } else if (totalMet === 3) {
    strengthLabel = "Fair";
    score = 2;
  } else if (totalMet === 4) {
    strengthLabel = "Strong";
    score = 3;
  } else if (totalMet === 5) {
    strengthLabel = "Very Strong";
    score = 4;
  }

  const unmetRequired = criteria.filter((c) => c.id !== "special" && !c.met);
  const errorMessage =
    unmetRequired.length > 0
      ? `Password does not meet requirements: ${unmetRequired.map((c) => c.label.toLowerCase()).join(", ")}.`
      : undefined;

  return {
    isValid: requiredMet,
    score,
    strengthLabel,
    criteria,
    errorMessage,
  };
}

export interface CommitteeRegistrationInput {
  committeeName: string;
  email: string;
  primaryMobile: string;
  address: string;
  eventDate: string;
  password: string;
  confirmPassword: string;
}

export const PASSWORD_RULE =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter and a number.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

export function normaliseEmail(email: string): string {
  return String(email || '').trim().toLowerCase();
}

export function normaliseMobile(mobile: string): string {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

/** The fields both the public form and the Super Admin form collect. */
export type CommitteeBasics = Omit<CommitteeRegistrationInput, 'password' | 'confirmPassword'>;

/** Field-by-field messages so the form can show them inline. */
export function validateCommitteeBasics(input: CommitteeBasics): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!input.committeeName?.trim()) errors.committeeName = 'Committee name is required.';
  else if (input.committeeName.trim().length < 3) errors.committeeName = 'Committee name looks too short.';

  if (!input.address?.trim()) errors.address = 'Address is required.';

  const email = normaliseEmail(input.email);
  if (!email) errors.email = 'Email address is required.';
  else if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email address.';

  const mobile = normaliseMobile(input.primaryMobile);
  if (!input.primaryMobile?.trim()) errors.primaryMobile = 'Primary mobile number is required.';
  // normaliseMobile would happily strip letters out, so reject them before it runs.
  else if (/[a-z]/i.test(input.primaryMobile)) errors.primaryMobile = 'Mobile number can contain digits only.';
  else if (!MOBILE_RE.test(mobile)) errors.primaryMobile = 'Enter a valid 10-digit Indian mobile number.';

  const rawDate = (input.eventDate || '').trim();
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
  if (!rawDate) errors.eventDate = 'Event date is required.';
  else if (!parts) errors.eventDate = 'Choose a valid event date.';
  else {
    const year = Number(parts[1]);
    const month = Number(parts[2]);
    const dayOfMonth = Number(parts[3]);
    const day = new Date(year, month - 1, dayOfMonth);
    if (day.getFullYear() !== year || day.getMonth() !== month - 1 || day.getDate() !== dayOfMonth) {
      errors.eventDate = 'Choose a valid event date.';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (day < today) errors.eventDate = 'Event date cannot be in the past.';
    }
  }

  return errors;
}

export function validateCommitteeRegistration(
  input: CommitteeRegistrationInput
): Record<string, string> {
  const errors = validateCommitteeBasics(input);

  const password = input.password || '';
  const strong =
    password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password);
  if (!password) errors.password = 'Password is required.';
  else if (!strong) errors.password = PASSWORD_RULE;

  if (password !== (input.confirmPassword || '')) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%&';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT = '23456789';

/**
 * Sign-in password for a committee the Super Admin creates. Obeying
 * PASSWORD_RULE is not optional: the login form rejects anything weaker, so a
 * generated password that broke the rule would lock the committee out.
 */
export function generateCommitteePassword(length = 12): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  const letters = Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length]);
  [UPPER, LOWER, DIGIT].forEach((set, i) => {
    letters[i] = set[bytes[length - 1 - i] % set.length];
  });
  // Shuffle so the guaranteed characters are not always in front.
  for (let i = letters.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1);
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters.join('');
}

/** Human-readable application reference shown on the waiting page. */
export function buildApplicationRef(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  bytes.forEach((b) => {
    suffix += alphabet[b % alphabet.length];
  });
  return `JBC-${new Date().getFullYear()}-${suffix}`;
}

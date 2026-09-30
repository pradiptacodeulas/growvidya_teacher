/**
 * Utility functions for user avatars and initials fallback
 */

/**
 * Check if the picture string is an actual uploaded picture and not a default avatar or null/placeholder
 */
export const isNonEmptyPicture = (pic?: string | null): boolean => {
  if (!pic || typeof pic !== 'string') return false;
  const p = pic.trim().toLowerCase();
  if (p === '' || p === 'null' || p === 'undefined') return false;
  if (
    p.includes('male-user.png') ||
    p.includes('female-user.png') ||
    p.includes('placeholder')
  ) {
    return false;
  }
  return true;
};

/**
 * Returns initials for avatar display.
 * - If first and last name exist (e.g., "Rahul Sharma"):
 *   Returns first letter of first name and first letter of last name ("RS")
 * - If single word name (e.g., "Teacher", "Rahul", "Pooja"):
 *   Returns first letter and last letter ("TR", "RL", "PA")
 */
export const getAvatarInitials = (
  name?: string,
  firstName?: string,
  lastName?: string
): string => {
  const f = firstName?.trim() || '';
  const l = lastName?.trim() || '';

  if (f && l) {
    return `${f.charAt(0).toUpperCase()}${l.charAt(0).toUpperCase()}`;
  }

  const clean = (f || l || name || '').trim();
  if (!clean) return 'T';

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const firstInitial = parts[0].charAt(0).toUpperCase();
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  }

  if (clean.length === 1) {
    return clean.toUpperCase();
  }

  // Single word: first letter and last letter of the name
  const firstChar = clean.charAt(0).toUpperCase();
  const lastChar = clean.charAt(clean.length - 1).toUpperCase();
  return `${firstChar}${lastChar}`;
};

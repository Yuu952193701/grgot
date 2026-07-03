/**
 * Unified Time Utility
 * Handles all date and time retrieval, comparison, and formatting for the application.
 * Utilizes the local system time and timezone automatically.
 */

/**
 * Returns the current local system time as a Date object.
 * In the future, this can be easily modified to fetch server time.
 */
export function getCurrentTime(): Date {
  return new Date();
}

/**
 * Returns the current local system time as an ISO string.
 */
export function getCurrentISOString(): string {
  return getCurrentTime().toISOString();
}

/**
 * Formats a Date object or date/time string to "YYYY-MM-DD HH:mm"
 * utilizing the local timezone.
 */
export function formatDateTime(dateInput?: Date | string | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/**
 * Formats a Date object or date/time string to "YYYY-MM-DD"
 */
export function formatDate(dateInput?: Date | string | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return '';
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Determines if a due date is overdue compared to the current local system date.
 * Compares only the date components (ignoring hours/minutes).
 */
export function isOverdue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  const today = getCurrentTime();
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return false;
  
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return due < today;
}

/**
 * Formats Chinese simplified date "M/D"
 */
export function formatChineseDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2] || parts[1], 10);
      return `⏰${month}/${day}`;
    }
    return dateStr;
  }
  return `⏰${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Formats full Chinese date "YYYY年M月D日"
 */
export function formatFullChineseDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const parts = dateStr.split('-');
    if (parts.length >= 3) {
      return `${parts[0]}年${parseInt(parts[1], 10)}月${parseInt(parts[2], 10)}日`;
    }
    return dateStr;
  }
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

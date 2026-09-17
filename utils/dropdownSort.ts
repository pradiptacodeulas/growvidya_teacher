/**
 * Centralized utility for sorting dropdown options according to their IDs in ASCENDING order.
 * Ensures lowest ID appears first (1, 2, 3, ...), with natural alphanumeric fallback.
 * Also dynamically attaches "(current)" indicator to active academic year based on is_current.
 */

export const getItemId = (item: any): any => {
  if (item === null || item === undefined) return null;
  if (typeof item === 'number') return item;
  if (typeof item !== 'object') {
    const num = Number(item);
    return !isNaN(num) ? num : item;
  }

  const idCandidates = [
    'id',
    '_id',
    'value',
    'class_id',
    'section_id',
    'exam_id',
    'subject_id',
    'academic_year_id',
    'role_id',
    'route_id',
    'vehicle_id',
    'driver_id',
    'helper_id',
    'hostel_id',
    'room_id',
    'state_id',
    'city_id',
    'sort_order',
  ];

  for (const candidate of idCandidates) {
    if (item[candidate] !== undefined && item[candidate] !== null && item[candidate] !== '') {
      const val = item[candidate];
      const num = Number(val);
      return !isNaN(num) ? num : val;
    }
  }

  return item.name || item.title || null;
};

export const sortDropdownById = (list: any[], direction: 'asc' | 'desc' = 'asc'): any[] => {
  if (!Array.isArray(list) || list.length <= 1) {
    return Array.isArray(list) ? [...list] : [];
  }

  const copy = [...list];
  const isAsc = direction === 'asc';

  return copy.sort((a, b) => {
    if (a === b) return 0;
    if (a === null || a === undefined) return isAsc ? 1 : -1;
    if (b === null || b === undefined) return isAsc ? -1 : 1;

    const idA = getItemId(a);
    const idB = getItemId(b);

    if (idA === idB) return 0;
    if (idA === null || idA === undefined) return isAsc ? 1 : -1;
    if (idB === null || idB === undefined) return isAsc ? -1 : 1;

    if (typeof idA === 'number' && typeof idB === 'number') {
      return isAsc ? idA - idB : idB - idA;
    }

    const cmp = String(idA).localeCompare(String(idB), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    return isAsc ? cmp : -cmp;
  });
};

export const formatAcademicYearOption = (item: any): any => {
  if (!item || typeof item !== 'object') return item;
  const isCurrent =
    Number(item.is_current) === 1 ||
    String(item.is_current) === '1' ||
    item.isCurrent === true ||
    item.is_current === true;

  const raw = item.academic_year || item.name || item.title || '';
  const clean = String(raw).replace(/\s*\(current\)\s*/gi, '').trim();

  if (clean) {
    const formatted = isCurrent ? `${clean} (current)` : clean;
    item.academic_year = formatted;
    item.name = formatted;
    item.title = formatted;
    item.is_current = isCurrent ? 1 : 0;
    item.isCurrent = isCurrent;
  }
  return item;
};

export const DROPDOWN_ARRAY_KEYS = [
  'classes',
  'sections',
  'allSections',
  'academicYears',
  'academic_years',
  'subjects',
  'examTypes',
  'exam_types',
  'exams',
  'grades',
  'shifts',
  'periods',
  'days',
  'leaveTypes',
  'leave_types',
  'materialTypes',
  'material_types',
  'countries',
  'states',
  'cities',
];

export const DROPDOWN_URL_PATTERNS = [
  '/academics/classes',
  '/academics/sections',
  '/academics/years',
  '/academics/subjects',
  '/academics/shifts',
  '/academics/periods',
  '/academics/material-types',
  '/examinations/grades',
  '/examinations/exams',
  '/leaves/types',
];

export const sortResponseDropdowns = (url: string, payload: any): any => {
  if (!payload || typeof payload !== 'object') return payload;

  const urlStr = typeof url === 'string' ? url : '';
  const isAcademicYearUrl = urlStr.includes('/academics/years');

  for (const key of DROPDOWN_ARRAY_KEYS) {
    if (Array.isArray(payload[key])) {
      let sorted = sortDropdownById(payload[key], 'asc');
      if (key === 'academicYears' || key === 'academic_years') {
        sorted = sorted.map(formatAcademicYearOption);
      }
      payload[key] = sorted;
    }
  }

  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    for (const key of DROPDOWN_ARRAY_KEYS) {
      if (Array.isArray(payload.data[key])) {
        let sorted = sortDropdownById(payload.data[key], 'asc');
        if (key === 'academicYears' || key === 'academic_years') {
          sorted = sorted.map(formatAcademicYearOption);
        }
        payload.data[key] = sorted;
      }
    }
  }

  const isDropdownUrl = DROPDOWN_URL_PATTERNS.some((pattern) => urlStr.includes(pattern));

  if (isDropdownUrl) {
    if (Array.isArray(payload.data)) {
      let sorted = sortDropdownById(payload.data, 'asc');
      if (isAcademicYearUrl) {
        sorted = sorted.map(formatAcademicYearOption);
      }
      payload.data = sorted;
    } else if (Array.isArray(payload)) {
      let sorted = sortDropdownById(payload, 'asc');
      if (isAcademicYearUrl) {
        sorted = sorted.map(formatAcademicYearOption);
      }
      return sorted;
    }
  }

  return payload;
};

export default sortDropdownById;

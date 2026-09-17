export const Palette = {
  // Light Theme - Crisp, Paper Off-White & Professional
  light: {
    background: '#F6F8FC',       // Clean Paper Off-White
    surface: '#FFFFFF',          // Pure White Card Surface
    surfaceSubtle: '#F1F4F9',    // Secondary Soft Fill
    headerBg: '#FFFFFF',         // Header Background
    textPrimary: '#111827',      // Deep Obsidian Text
    textSecondary: '#4B5563',    // Slate Medium Gray Text
    textMuted: '#9CA3AF',        // Cool Muted Gray Text
    border: '#E4E9F2',           // Hairline Border
    primary: '#3D5EE1',          // Royal Indigo Blue Brand Accent
    primaryLight: '#EEF2FF',     // Soft Indigo Background Tint
    cardBg: '#FFFFFF',           // Card Fill
    tabBarBg: '#FFFFFF',         // Bottom Tab Bar
    tabBarBorder: '#E4E9F2',
    inputBg: '#F1F4F9',
    inputBorder: '#E4E9F2',
    icon: '#111827',
    badgeBg: '#EEF2FF',
    shadowColor: '#000000',
    statusBarStyle: 'dark' as const,
  },
  
  // Dark Theme - Rich Paper Black & Obsidian Slate
  dark: {
    background: '#0B0E14',       // Deep Paper Black
    surface: '#141822',          // Charcoal Paper Black Surface
    surfaceSubtle: '#1C2230',    // Secondary Fill
    headerBg: '#141822',         // Header Background
    textPrimary: '#F9FAFB',      // Crisp Off-White Text
    textSecondary: '#9CA3AF',    // Silver Gray Text
    textMuted: '#6B7280',        // Muted Graphite Text
    border: '#262D3E',           // Hairline Obsidian Border
    primary: '#5B78F6',          // Refined Vibrant Indigo
    primaryLight: '#1E2545',     // Midnight Indigo Tint
    cardBg: '#141822',           // Card Fill
    tabBarBg: '#141822',         // Bottom Tab Bar
    tabBarBorder: '#262D3E',
    inputBg: '#0B0E14',
    inputBorder: '#262D3E',
    icon: '#F9FAFB',
    badgeBg: '#1E2545',
    shadowColor: '#000000',
    statusBarStyle: 'light' as const,
  },

  // Semantic Status Colors
  status: {
    present: { lightBg: '#ECFDF5', darkBg: '#064E3B', color: '#10B981', label: 'Present' },
    late: { lightBg: '#FEF3C7', darkBg: '#78350F', color: '#F59E0B', label: 'Late' },
    absent: { lightBg: '#FEE2E2', darkBg: '#7F1D1D', color: '#EF4444', label: 'Absent' },
    halfDay: { lightBg: '#EFF6FF', darkBg: '#1E3A8A', color: '#3B82F6', label: 'Half Day' },
  }
};

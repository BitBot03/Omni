// Master Icon System
// Central repository for all SVG icons in OMNI Fitness to ensure perfect structural and visual consistency across tabs.
window.Icons = {
    _base: (paths, size, stroke, style, isFill) => {
        if(isFill) {
            return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="app-icon" style="${style}">${paths}</svg>`;
        }
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" class="app-icon" style="fill:none; ${style}">${paths}</svg>`;
    },
    
    // Primary Tab Navigation (Filled by default)
    dashboard: (size=24, style='') => Icons._base(`<path d="M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7v-9h-7v9Zm0-16v5h7V4h-7Z"/>`, size, null, style, true),
    workouts: (size=24, style='') => Icons._base(`<path d="M4 10H2v4h2v3h4V7H4v3Zm16 0V7h-4v10h4v-3h2v-4h-2ZM9 9h6v6H9V9Z"/>`, size, null, style, true),
    nutrition: (size=24, style='') => Icons._base(`<path d="M17.5 3C13 3 10 6 10 10.5V12H8.7C6.1 12 4 14.1 4 16.7 4 19.1 5.9 21 8.3 21H12c4.4 0 8-3.6 8-8V3h-2.5ZM17 6.2V13c0 2.8-2.2 5-5 5H8.3C7.5 18 7 17.5 7 16.7c0-1 .7-1.7 1.7-1.7H13v-4.5c0-2.1 1.4-3.8 4-4.3Z"/>`, size, null, style, true),
    recovery: (size=24, style='') => Icons._base(`<path d="M12 21s-7-4.4-9.2-9.1C1 8 3.3 4 7.4 4c2 0 3.6 1 4.6 2.5C13 5 14.6 4 16.6 4 20.7 4 23 8 21.2 11.9 19 16.6 12 21 12 21Zm0-4.1c2.1-1.5 5.1-4.1 6.2-6.3.8-1.7-.1-3.6-1.8-3.6-1.1 0-2 .6-2.6 1.7L12 12l-1.8-3.3C9.6 7.6 8.7 7 7.6 7 5.9 7 5 8.9 5.8 10.6c1.1 2.2 4.1 4.8 6.2 6.3Z"/>`, size, null, style, true),
    analytics: (size=24, style='') => Icons._base(`<path d="M4 19h16v2H2V3h2v16Zm3-2V9h3v8H7Zm5 0V5h3v12h-3Zm5 0v-6h3v6h-3Z"/>`, size, null, style, true),
    aicoach: (size=24, style='') => Icons._base(`<path d="M12 2l1.2 4.1L17 4.2l-1.9 3.9L19 9.3l-4.1 1.2L16.8 14 13 12.2 11.8 16 10.6 12.2 6.8 14l1.9-3.5L4.6 9.3l4-1.2L6.8 4.2l3.8 1.9L12 2Zm-7 14h14v5H5v-5Zm3 2v1h8v-1H8Z"/>`, size, null, style, true),

    // Core Actions (Stroke-based)
    search: (size=18, stroke=1.5, style='') => Icons._base(`<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>`, size, stroke, style),
    back: (size=18, stroke=1.5, style='') => Icons._base(`<path d="m15 18-6-6 6-6"/>`, size, stroke, style),
    close: (size=16, stroke=1.5, style='') => Icons._base(`<path d="M18 6L6 18M6 6l12 12"></path>`, size, stroke, style),
    plus: (size=16, stroke=1.5, style='') => Icons._base(`<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>`, size, stroke, style),
    reset: (size=18, stroke=1.5, style='') => Icons._base(`<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path>`, size, stroke, style),
    
    // Chevrons (Stroke-based)
    chevronDown: (size=14, stroke=1.5, style='') => Icons._base(`<path d="m6 9 6 6 6-6"/>`, size, stroke, style),
    chevronUp: (size=14, stroke=1.5, style='') => Icons._base(`<path d="m18 15-6-6-6 6"/>`, size, stroke, style),
    chevronRight: (size=14, stroke=1.5, style='') => Icons._base(`<path d="m9 18 6-6-6-6"/>`, size, stroke, style),

    // Content Management (Stroke-based)
    edit: (size=14, stroke=1.5, style='') => Icons._base(`<path d="M20.7 6.4c.4-.4.4-1 0-1.4l-2.7-2.7c-.4-.4-1-.4-1.4 0l-1.8 1.8 4.1 4.1 1.8-1.8zM3 16.9V21h4.1l10.6-10.6-4.1-4.1L3 16.9z"/>`, size, null, style, true),
    sliders: (size=16, stroke=1.5, style='') => Icons._base(`<line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line>`, size, stroke, style),
    trash: (size=14, stroke=1.5, style='') => Icons._base(`<path d="M18 5h-3.5l-1-1h-3l-1 1H6v2h12V5zM7 8v10c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V8H7zm4 9H9v-6h2v6zm4 0h-2v-6h2v6z"/>`, size, null, style, true),
    save: (size=16, stroke=1.5, style='') => Icons._base(`<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline>`, size, stroke, style),
    check: (size=16, stroke=1.5, style='') => Icons._base(`<polyline points="20 6 9 17 4 12"></polyline>`, size, stroke, style),
    checkFill: (size=16, style='') => Icons._base(`<path d="M9.4 16.6 4.8 12l-1.4 1.4 6 6L21 7.8l-1.4-1.4-10.2 10.2Z"/>`, size, null, style, true),
    
    // Identifiers & Utils
    customUser: (size=16, stroke=1.5, style='') => Icons._base(`<path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z"/>`, size, null, style, true),
    settings: (size=16, stroke=1.5, style='') => Icons._base(`<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>`, size, stroke, style),
    play: (size=16, stroke=1.5, style='') => Icons._base(`<polygon points="5 3 19 12 5 21 5 3"></polygon>`, size, stroke, style),
    playCircle: (size=16, stroke=1.5, style='') => Icons._base(`<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4z"/>`, size, stroke, style),
    breathwork: (size=16, stroke=1.5, style='') => Icons._base(`<path d="M4 8h10a2 2 0 1 0-2-2h-2a4 4 0 1 1 4 4H4V8Zm0 4h14a3 3 0 1 1-3 3h2a1 1 0 1 0 1-1H4v-2Zm0 5h8a2 2 0 1 1-2 2H8a4 4 0 1 0 4-4H4v2Z"/>`, size, stroke, style), // Formerly wind

    filter: (size=16, stroke=1.5, style='') => Icons._base(`<path d="M3 6h18M6 12h12M10 18h4"></path>`, size, stroke, style),
    playFill: (size=16, style='') => Icons._base(`<path d="M5 3l14 9-14 9V3z"/>`, size, null, style, true),
    
    // Mindfulness / Elemental
    moon: (size=16, style='') => Icons._base(`<path d="M20.5 13.5A8.5 8.5 0 0 1 10.5 3.5 8.5 8.5 0 1 0 20.5 13.5z"/>`, size, null, style, true),
    flame: (size=16, style='') => Icons._base(`<path d="M12 2c0 0-4 6-4 11a4 4 0 0 0 8 0c0-5-4-11-4-11z"/>`, size, null, style, true),
    snow: (size=16, style='') => Icons._base(`<path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z"/>`, size, null, style, true),
    sunrise: (size=16, style='') => Icons._base(`<path d="M12 4a8 8 0 0 0-8 8v2h16v-2a8 8 0 0 0-8-8z"/>`, size, null, style, true),
    mindIntegration: (size=16, style='') => Icons._base(`<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/>`, size, null, style, true),

    univMobility: (size=16, style='') => Icons._base(`<circle cx="12" cy="12" r="10" opacity="0.25"/><circle cx="12" cy="12" r="5"/>`, size, null, style, true),
    univProtocol: (size=16, style='') => Icons._base(`<circle cx="12" cy="12" r="10" opacity="0.25"/><circle cx="12" cy="12" r="5"/>`, size, null, style, true),

    // Added Utils
    calendar: (size=16, stroke=1.5, style='') => Icons._base(`<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>`, size, stroke, style)
};

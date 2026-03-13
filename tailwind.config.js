/** @type {import('tailwindcss').Config} */
// Nota: En un entorno de build standard (Node.js), usaríamos 'module.exports'.
// Para el entorno CDN actual, asignamos directamente a 'tailwind.config'.

window.tailwind = window.tailwind || {};
window.tailwind.config = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#114a28', // Verde oscuro (Bouticapp Brand)
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: '#f3f4f6', // Gray-100
          foreground: '#1f2937', // Gray-800
        },
        destructive: {
          DEFAULT: '#ef4444', // Red-500
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#dcfce7', // Green-100 (filas resaltadas, badges)
          foreground: '#166534', // Green-800
        },
        card: {
          DEFAULT: '#ffffff',
          foreground: '#020817',
        },
        // Agregamos colores semánticos útiles para el sistema
        success: {
            DEFAULT: '#22c55e', // Green-500
            foreground: '#ffffff'
        },
        warning: {
            DEFAULT: '#f97316', // Orange-500
            foreground: '#ffffff'
        },
        info: {
            DEFAULT: '#3b82f6', // Blue-500
            foreground: '#ffffff'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      }
    }
  }
}
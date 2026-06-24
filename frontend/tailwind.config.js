/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  theme: {
    extend: {
      colors: {
        "bordeaux": "#800020",
        "bordeaux-dark": "#600018"
      }
    }
  },
  safelist: [
    'grid-cols-1',
    'md:grid-cols-2',
    'lg:grid-cols-3',
    'lg:grid-cols-4',
    'md:col-span-2',
    'col-span-full'
  ],
  plugins: [
    require("daisyui"),
    function({ addUtilities }) {
      addUtilities({
        '.no-scrollbar': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.disabled-strong': {
          '@apply opacity-50 cursor-not-allowed': {},
        }
      })
    }
  ],
  daisyui: {
    themes: [
      {
        fanta: {
          "primary": "#800020",
          "secondary": "#ffcc00",
          "accent": "#1fb2a6",
          "neutral": "#2a323c",
          "base-100": "#ffffff",
          "info": "#3abff8",
          "success": "#36d399",
          "warning": "#fbbd23",
          "error": "#f87272"
        }
      }
    ]
  }
};
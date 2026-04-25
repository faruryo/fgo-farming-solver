import { extendTheme } from '@chakra-ui/react'
import { Noto_Sans_JP } from 'next/font/google'

const font = Noto_Sans_JP({
  weight: ['400', '700'],
  preload: false,
})

const fontFamily = `${font.style.fontFamily}, "Hiragino Kaku Gothic ProN", "Hiragino Sans", sans-serif`

export const theme = extendTheme({
  colors: {
    item: {
      bronze: '#dd6b20',
      silver: '#a0aec0',
      gold: '#d69e2e',
      blue: '#3182ce',
      red: '#e53e3e',
    },
    gold: {
      50: '#fff9e6',
      100: '#ffedb3',
      200: '#ffe180',
      300: '#ffd54d',
      400: '#ffc91a',
      500: '#e6b000',
      600: '#b38900',
      700: '#806200',
      800: '#4d3b00',
      900: '#1a1400',
    },
  },
  components: {
    Link: {
      baseStyle: {
        color: 'blue.500',
      },
      variants: {
        unstyled: {
          color: 'default',
          _hover: {
            textDecoration: 'none',
          },
        },
      },
    },
  },
  styles: {
    global: {
      body: {
        bg: 'transparent',
      },
      main: {
        bg: 'transparent',
      },
      table: {
        borderRadius: 'xl',
        overflow: 'hidden',
        thead: {
          th: {
            bg: 'var(--panel)',
          },
        },
        tbody: {
          th: {
            bg: 'rgba(30,46,74,0.04)',
          },
        },
      },
    },
  },
  fonts: {
    heading: fontFamily,
    body: fontFamily,
  },
})

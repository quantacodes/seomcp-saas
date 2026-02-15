import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App.tsx'
import './index.css'

// Clerk publishable key
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

// Show error if key is missing
if (!CLERK_PUBLISHABLE_KEY || CLERK_PUBLISHABLE_KEY === 'pk_test_...') {
  console.error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider 
      publishableKey={CLERK_PUBLISHABLE_KEY || ''}
      allowedRedirectOrigins={[
        'http://localhost:5173',
        'http://localhost:3456',
        'https://seomcp.dev',
        'https://www.seomcp.dev',
      ]}
      appearance={{
        variables: {
          colorPrimary: '#E5A430',
          colorBackground: '#0C0C0F',
          colorText: '#EDEDF0',
          colorTextSecondary: '#9A9AB2',
          colorInputBackground: '#16161D',
          colorBorder: 'rgba(255,255,255,0.06)',
          borderRadius: '10px',
          fontFamily: 'Inter, system-ui, sans-serif',
        },
        elements: {
          card: {
            backgroundColor: '#16161D',
            border: '1px solid rgba(255,255,255,0.06)',
          },
          formButtonPrimary: {
            backgroundColor: '#E5A430',
            color: '#000000',
            fontWeight: 600,
            '&:hover': {
              backgroundColor: '#F0B840',
            },
          },
          socialButtonsBlockButton: {
            backgroundColor: '#1E1E28',
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#EDEDF0',
          },
          formFieldInput: {
            backgroundColor: '#0C0C0F',
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#EDEDF0',
          },
          footerActionLink: {
            color: '#E5A430',
          },
        },
      }}
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>,
)

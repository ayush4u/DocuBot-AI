import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
        
        {/* Favicon */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        
        {/* Meta tags */}
        <meta name="description" content="DocuBot - Advanced AI Assistant for document analysis and intelligent conversations" />
        <meta name="theme-color" content="#00D4FF" />
      </Head>
      <body style={{ fontFamily: 'Inter, Segoe UI, Arial, sans-serif' }}>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

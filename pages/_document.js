import { Head, Html, Main, NextScript } from 'next/document';

import { BOOKLET_FONTS_URL } from '../data/bookletData';

const Document = () => (
  <Html lang="id">
    <Head>
      <link rel="icon" href="/favicon.png" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap"
      />
      <link rel="stylesheet" href={BOOKLET_FONTS_URL} />
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
      />
    </Head>
    <body>
      <Main />
      <NextScript />
    </body>
  </Html>
);

export default Document;

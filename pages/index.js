import React from 'react';
import Head from 'next/head';

import BookletBuilder from '../components/BookletBuilder/BookletBuilder';

const TITLE = 'Booklet Foto 3D Custom | GetGoing × 3Dieter';
const DESCRIPTION =
  'Buat booklet foto cetak 3D berisi 12 foto perjalananmu. Pilih judul sampul, font, warna, finishing dan filter foto, lalu lihat preview 3D-nya.';

const Home = () => (
  <>
    <Head>
      <title>{TITLE}</title>
      <meta name="description" content={DESCRIPTION} />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta property="og:title" content={TITLE} />
      <meta property="og:description" content={DESCRIPTION} />
      <meta property="og:image" content="/content/img/3dieter/booklet-strip.jpg" />
    </Head>
    <BookletBuilder />
  </>
);

export default Home;

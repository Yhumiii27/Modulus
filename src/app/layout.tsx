import type { Metadata } from 'next';
import '@norma/charte/nocturne.css';
import '@norma/charte/touch.css';
import '@norma/charte/coque.css';
import './globals.css';
import { interClassName } from '@/fonts/inter';
import { I18nProvider } from '@/i18n/client';
import { getLang, getTheme } from '@/server/session';

export const metadata: Metadata = {
  title: 'Modulus',
  description: 'Modulus — sales and estimating of the EPC2I group: catalogue, deals, offers, quotations, know-how',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const [lang, theme] = await Promise.all([getLang(), getTheme()]);
  return (
    // The display theme (Norma: cookie epc2i-theme, dark by default) is set at render, so the page never flashes.
    <html lang={lang} data-theme={theme} className={interClassName}>
      <body>
        <I18nProvider lang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}

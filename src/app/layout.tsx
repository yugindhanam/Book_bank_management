import type { Metadata } from "next";
import { Toaster } from "sonner";
import { COLLEGE_NAME, LIBRARY_NAME } from "@/lib/branding";
import "./globals.css";
export const metadata: Metadata = {
  title: `Folio | ${LIBRARY_NAME}`,
  description: `The Book Bank of ${COLLEGE_NAME}. Catalogue, borrowing and circulation, together.`,
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}

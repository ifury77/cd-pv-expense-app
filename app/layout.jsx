import "./globals.css";
import { SessionProvider } from "./providers";

export const metadata = {
  title: "PV Expense App - Redington ASEAN",
  description: "Payment voucher generator for Ivan Ong",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

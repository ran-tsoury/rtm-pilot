import "./globals.css";

export const metadata = {
  title: "RTM Pilot",
  description: "RTM Pilot Application",
};

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}

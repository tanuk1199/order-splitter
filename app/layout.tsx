import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Splitter",
  description: "Shopify order splitting webhook handler",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

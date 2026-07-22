import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "SignaLab · corpus de LSM",
  description:
    "Plataforma de SignaLab (OtherAI) para grabar y anotar un corpus de Lengua de Señas Mexicana — 101 configuraciones de mano.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {/* Franja espectro: motivo de inclusión, una sola vez por vista */}
        <div className="spectrum-stripe" aria-hidden>
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}

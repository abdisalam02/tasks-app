import './globals.css';
import Navbar from './api/components/Navbar';
import ProfileCompletionChecker from './api/components/ProfileCompletionChecker';

export const metadata = {
  title: "I'm Bored App",
  description: "A fun task generator and assignment app.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ProfileCompletionChecker />
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}

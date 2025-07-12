import { ContactList } from '@/components/chat/contact-list';

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen w-full bg-background">
      <ContactList />
      <main className="flex-1">{children}</main>
    </div>
  );
}

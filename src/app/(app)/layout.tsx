import { pageUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Shell } from "@/components/shell";
import { LIBRARY_NAME } from "@/lib/branding";
export const dynamic = "force-dynamic";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await pageUser();
  const unread = await db.notification.count({
    where: { userId: user.id, read: false },
  });
  const settings = await db.librarySettings.findUnique({
    where: { id: "library" },
  });
  return (
    <Shell
      user={{ name: user.name, role: user.role }}
      unread={unread}
      libraryName={settings?.name ?? LIBRARY_NAME}
    >
      {children}
    </Shell>
  );
}

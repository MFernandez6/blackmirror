import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { FieldShell } from "@/components/layout/field-shell";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  return (
    <FieldShell
      user={{
        name: session.user.name,
        email: session.user.email,
        role: session.user.role,
      }}
    >
      {children}
    </FieldShell>
  );
}

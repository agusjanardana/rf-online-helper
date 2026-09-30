import { redirect } from "next/navigation";
import { databaseConfigured } from "@/src/lib/supabase/server";
import { currentUser } from "@/src/lib/auth/session";
import { InviteAccept } from "@/src/components/guild/invite-accept";
import { SetupNotice } from "@/src/components/guild/ui";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!databaseConfigured()) return <SetupNotice />;
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invites/${token}`)}`);
  return <InviteAccept token={token} username={user.username} />;
}

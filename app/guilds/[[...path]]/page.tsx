import { redirect } from "next/navigation";
import { databaseConfigured } from "@/src/lib/supabase/server";
import { currentUser } from "@/src/lib/auth/session";
import { GuildApp } from "@/src/components/guild/guild-app";
import { SetupNotice } from "@/src/components/guild/ui";
export default async function Page({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  if (!databaseConfigured()) return <SetupNotice />;
  const user = await currentUser();
  if (!user) redirect("/login");
  const { path = [] } = await params;
  return <GuildApp key={path.join("/")} path={path} username={user.username} />;
}

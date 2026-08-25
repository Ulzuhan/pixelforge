import { currentAccount } from "@/lib/auth";
import { Landing } from "@/components/landing";
import { Tool } from "./tool";

/**
 * The front door, decided on the server: a stranger gets the landing page,
 * somebody signed in gets the tool.
 *
 * force-dynamic because this reads the session cookie — prerendering would
 * bake one of the two answers into a static page.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const account = await currentAccount();
  if (!account) return <Landing />;
  return <Tool email={account.email} />;
}

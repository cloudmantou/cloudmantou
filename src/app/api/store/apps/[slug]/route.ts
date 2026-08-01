import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ok, fail } from "@/lib/api-response";
import { toPublicStoreApp, userCanAccessStoreInstall } from "@/lib/store-apps.server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const { slug } = await context.params;
  const app = await prisma.storeApp.findFirst({
    where: { slug, published: true },
  });

  if (!app) {
    return fail("应用不存在", 40400, 404);
  }

  const session = await auth();
  const canInstall = await userCanAccessStoreInstall(session?.user?.id);

  return ok(toPublicStoreApp(app, canInstall));
}

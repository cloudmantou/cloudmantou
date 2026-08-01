import { prisma } from "@/lib/prisma";
import { ok } from "@/lib/api-response";
import { toPublicStoreApp } from "@/lib/store-apps.server";

export const dynamic = "force-dynamic";

export async function GET() {
  const apps = await prisma.storeApp.findMany({
    where: { published: true },
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return ok(apps.map((app) => toPublicStoreApp(app)));
}

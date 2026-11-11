import { prisma } from "@/lib/prisma";
import { CATALOG_KEY, catalogSchema, initialCatalog } from "@/lib/assistant-catalog";
export async function readLoginCatalog() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: CATALOG_KEY } });
  return { raw: setting?.value ?? null, catalog: setting ? catalogSchema.parse(JSON.parse(setting.value)) : initialCatalog };
}

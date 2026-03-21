import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * GET /api/sourcing/products/[id] - 商品詳細取得
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const product = await prisma.sourcingProduct.findUnique({
    where: { id: params.id },
    include: {
      trendSources: { orderBy: { detectedAt: "desc" } },
      priceHistory: { orderBy: { recordedAt: "desc" }, take: 30 },
      purchaseOrders: { orderBy: { createdAt: "desc" } },
      amazonListings: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!product) {
    return NextResponse.json({ error: "商品が見つかりません" }, { status: 404 });
  }

  return NextResponse.json(product);
}

/**
 * PATCH /api/sourcing/products/[id] - 商品情報を更新
 */
const updateProductSchema = z.object({
  name: z.string().optional(),
  jan: z.string().optional(),
  asin: z.string().optional(),
  officialUrl: z.string().url().optional().nullable(),
  officialPrice: z.number().int().positive().optional().nullable(),
  amazonPrice: z.number().int().positive().optional().nullable(),
  category: z.string().optional(),
  status: z.enum([
    "DETECTED", "RESEARCHING", "PROFITABLE", "PURCHASING",
    "IN_STOCK", "LISTED", "SOLD", "SKIPPED", "EXPIRED",
  ]).optional(),
  notes: z.string().optional().nullable(),
  trendScore: z.number().int().min(0).max(100).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateProductSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "バリデーションエラー", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const product = await prisma.sourcingProduct.update({
    where: { id: params.id },
    data: parsed.data,
    include: { trendSources: true },
  });

  return NextResponse.json(product);
}

/**
 * DELETE /api/sourcing/products/[id] - 商品を削除
 */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  await prisma.sourcingProduct.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}

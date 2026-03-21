import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * GET /api/sourcing/products - 商品一覧取得
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const minTrendScore = searchParams.get("minTrendScore");
  const amazonStock = searchParams.get("amazonStock");
  const search = searchParams.get("search");
  const sortBy = searchParams.get("sortBy") || "trendScore";
  const order = searchParams.get("order") || "desc";
  const page = Number(searchParams.get("page") || "1");
  const limit = Number(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = { in: status.split(",") };
  }
  if (minTrendScore) {
    where.trendScore = { gte: Number(minTrendScore) };
  }
  if (amazonStock) {
    where.amazonStock = amazonStock;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { asin: { contains: search } },
      { jan: { contains: search } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.sourcingProduct.findMany({
      where,
      include: {
        trendSources: {
          orderBy: { detectedAt: "desc" },
          take: 3,
        },
        _count: {
          select: {
            purchaseOrders: true,
            amazonListings: true,
            priceHistory: true,
          },
        },
      },
      orderBy: { [sortBy]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sourcingProduct.count({ where }),
  ]);

  return NextResponse.json({
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * POST /api/sourcing/products - 手動で商品を登録
 */
const createProductSchema = z.object({
  name: z.string().min(1, "商品名は必須です"),
  jan: z.string().optional(),
  asin: z.string().optional(),
  officialUrl: z.string().url().optional(),
  officialPrice: z.number().int().positive().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createProductSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "バリデーションエラー", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const product = await prisma.sourcingProduct.create({
    data: {
      ...parsed.data,
      trendScore: 0,
      status: "DETECTED",
      trendSources: {
        create: {
          sourceType: "MANUAL",
          sourceTitle: "手動登録",
        },
      },
    },
    include: { trendSources: true },
  });

  return NextResponse.json(product, { status: 201 });
}

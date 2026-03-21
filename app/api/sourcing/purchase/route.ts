import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifySourcingAccess } from "@/lib/sourcing/auth-guard";

/**
 * GET /api/sourcing/purchase - 仕入れ注文一覧
 */
export async function GET(req: Request) {
  const denied = await verifySourcingAccess(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const productId = searchParams.get("productId");

  const where: Record<string, unknown> = {};
  if (status) where.orderStatus = status;
  if (productId) where.productId = productId;

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      product: {
        select: { id: true, name: true, asin: true, imageUrl: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ orders });
}

/**
 * POST /api/sourcing/purchase - 仕入れ注文を作成
 */
const createOrderSchema = z.object({
  productId: z.string(),
  purchaseSite: z.string().min(1),
  purchaseUrl: z.string().url().optional(),
  purchasePrice: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const denied = await verifySourcingAccess(req);
  if (denied) return denied;

  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "バリデーションエラー", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, purchaseSite, purchaseUrl, purchasePrice, quantity, notes } = parsed.data;
  const totalCost = purchasePrice * quantity;

  const order = await prisma.purchaseOrder.create({
    data: {
      productId,
      purchaseSite,
      purchaseUrl,
      purchasePrice,
      quantity,
      totalCost,
      orderStatus: "PENDING",
      notes,
    },
    include: {
      product: {
        select: { id: true, name: true },
      },
    },
  });

  // 商品ステータスを「仕入れ中」に更新
  await prisma.sourcingProduct.update({
    where: { id: productId },
    data: { status: "PURCHASING" },
  });

  return NextResponse.json(order, { status: 201 });
}

/**
 * PATCH /api/sourcing/purchase - 仕入れ注文ステータスを更新
 */
const updateOrderSchema = z.object({
  id: z.string(),
  orderStatus: z.enum(["PENDING", "ORDERED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"]).optional(),
  orderNumber: z.string().optional(),
  trackingNumber: z.string().optional(),
  estimatedArrival: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function PATCH(req: Request) {
  const denied = await verifySourcingAccess(req);
  if (denied) return denied;

  const body = await req.json();
  const parsed = updateOrderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "バリデーションエラー", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id, orderStatus, ...rest } = parsed.data;

  const updateData: Record<string, unknown> = { ...rest };
  if (orderStatus) {
    updateData.orderStatus = orderStatus;
    if (orderStatus === "ORDERED") updateData.orderedAt = new Date();
    if (orderStatus === "DELIVERED") updateData.arrivedAt = new Date();
  }

  const order = await prisma.purchaseOrder.update({
    where: { id },
    data: updateData,
    include: {
      product: { select: { id: true, name: true } },
    },
  });

  // 到着したら商品ステータスを「在庫あり」に更新
  if (orderStatus === "DELIVERED") {
    await prisma.sourcingProduct.update({
      where: { id: order.productId },
      data: { status: "IN_STOCK" },
    });
  }

  return NextResponse.json(order);
}

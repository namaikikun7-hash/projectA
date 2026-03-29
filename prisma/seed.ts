import { PrismaClient, Role, LeadSource } from "@prisma/client";
import pkg from "bcryptjs";
const { hash } = pkg;

const prisma = new PrismaClient();

async function main() {
  // 管理者アカウント
  const adminPassword = await hash("admin1234", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "管理者 太郎",
      email: "admin@example.com",
      password: adminPassword,
      role: Role.ADMIN,
    },
  });

  // 営業スタッフアカウント（3名）
  const staffPassword = await hash("staff1234", 12);
  const staffMembers = await Promise.all([
    prisma.user.upsert({
      where: { email: "yamada@example.com" },
      update: {},
      create: {
        name: "山田 花子",
        email: "yamada@example.com",
        password: staffPassword,
        role: Role.STAFF,
      },
    }),
    prisma.user.upsert({
      where: { email: "tanaka@example.com" },
      update: {},
      create: {
        name: "田中 一郎",
        email: "tanaka@example.com",
        password: staffPassword,
        role: Role.STAFF,
      },
    }),
    prisma.user.upsert({
      where: { email: "suzuki@example.com" },
      update: {},
      create: {
        name: "鈴木 次郎",
        email: "suzuki@example.com",
        password: staffPassword,
        role: Role.STAFF,
      },
    }),
  ]);

  // サンプル顧客
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        name: "佐藤 美咲",
        email: "sato@example.com",
        phone: "090-1234-5678",
        source: LeadSource.INSTAGRAM,
        schoolType: "プログラミングスクール",
        budget: 300000,
        ageGroup: "20代",
        occupation: "会社員",
      },
    }),
    prisma.client.create({
      data: {
        name: "伊藤 健太",
        email: "ito@example.com",
        phone: "080-2345-6789",
        source: LeadSource.GOOGLE_AD,
        schoolType: "デザインスクール",
        budget: 200000,
        ageGroup: "30代",
        occupation: "フリーランス",
      },
    }),
    prisma.client.create({
      data: {
        name: "渡辺 さくら",
        email: "watanabe@example.com",
        phone: "070-3456-7890",
        source: LeadSource.YOUTUBE,
        schoolType: "動画編集スクール",
        budget: 150000,
        ageGroup: "20代",
        occupation: "学生",
      },
    }),
  ]);

  // KPI目標（今月）
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const existingTarget = await prisma.kpiTarget.findFirst({
    where: { staffId: null, period },
  });
  if (!existingTarget) {
    await prisma.kpiTarget.create({
      data: {
        staffId: null,
        period,
        targetMeetings: 60,
        targetContracts: 30,
        targetConversionRate: 50.0,
        targetContractAmount: 6000000,
      },
    });
  }

  console.log("Seed completed!");
  console.log(`Admin: admin@example.com / admin1234`);
  console.log(`Staff: yamada@example.com / staff1234`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

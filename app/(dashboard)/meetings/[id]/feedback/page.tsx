import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { FeedbackFormComponent } from "@/components/meetings/feedback-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function FeedbackPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) redirect("/login");

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.id },
    include: {
      client: { select: { name: true } },
      feedback: true,
    },
  });

  if (!meeting) notFound();

  // STAFF は自分の商談のみ
  if (session.user.role === "STAFF" && meeting.staffId !== session.user.id) {
    redirect("/meetings");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/meetings/${params.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">商談フィードバック</h1>
          <p className="text-muted-foreground">{meeting.client.name} との商談</p>
        </div>
      </div>

      <FeedbackFormComponent
        meetingId={params.id}
        clientName={meeting.client.name}
        defaultValues={
          meeting.feedback
            ? {
                painPoints: meeting.feedback.painPoints ?? undefined,
                budget: meeting.feedback.budget ?? undefined,
                motivation: meeting.feedback.motivation,
                decisionMaker: meeting.feedback.decisionMaker,
                competitors: meeting.feedback.competitors ?? undefined,
                objections: meeting.feedback.objections ?? undefined,
                closingScore: meeting.feedback.closingScore,
                selfScore: meeting.feedback.selfScore,
                nextAction: meeting.feedback.nextAction ?? undefined,
              }
            : undefined
        }
      />
    </div>
  );
}

import { NextResponse } from "next/server";
import { attachGeneratedImages } from "@/lib/image-store";
import { generateProfile } from "@/lib/profile-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const batchSize = 3;

export async function POST() {
  const profiles = Array.from({ length: batchSize }, () => generateProfile());
  const profilesWithImages = await attachGeneratedImages(profiles);

  return NextResponse.json({
    batchSize,
    generatedAt: new Date().toISOString(),
    profiles: profilesWithImages,
  });
}

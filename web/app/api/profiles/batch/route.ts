import { NextResponse } from "next/server";
import { attachCachedImages, attachGeneratedImages, takeCachedGeneratedProfiles } from "@/lib/image-store";
import { generateProfile } from "@/lib/profile-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const batchSize = 3;

export async function POST() {
  const allowCachedReuse = !process.env.OPENAI_API_KEY;
  const cachedProfiles = await takeCachedGeneratedProfiles(batchSize, { allowReuse: allowCachedReuse });
  const remainingSlots = Math.max(0, batchSize - cachedProfiles.length);
  const freshProfiles = Array.from({ length: remainingSlots }, () => generateProfile());
  const cachedImageResult = await attachCachedImages(freshProfiles, {
    allowReuse: allowCachedReuse,
    excludeImageUrls: cachedProfiles.map((profile) => profile.imageUrl),
  });
  const generatedProfiles = cachedImageResult.remainingProfiles.length
    ? await attachGeneratedImages(cachedImageResult.remainingProfiles)
    : [];
  const profilesWithImages = [...cachedProfiles, ...cachedImageResult.profiles, ...generatedProfiles].slice(0, batchSize);

  return NextResponse.json({
    batchSize,
    cacheFirst: true,
    generatedAt: new Date().toISOString(),
    profiles: profilesWithImages,
  });
}

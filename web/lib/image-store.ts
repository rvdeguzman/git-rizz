import { mkdir, readdir, writeFile } from "fs/promises";
import { extname, join } from "path";
import type { ProfileImageStatus, RizzProfile } from "./types";

type ImageCacheState = {
  cursor: number;
};

const globalForImages = globalThis as typeof globalThis & {
  __rizzImageCache?: ImageCacheState;
};

const imageState = globalForImages.__rizzImageCache ?? { cursor: 0 };
globalForImages.__rizzImageCache = imageState;

const imageDir = join(process.cwd(), "public", "generated-profiles");
const publicPrefix = "/generated-profiles";
const imageModel = "gpt-image-2";
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const configuredTimeoutMs = Number(process.env.OPENAI_IMAGE_TIMEOUT_MS);
const openAiTimeoutMs = Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0 ? configuredTimeoutMs : 45_000;

const ensureImageDir = async () => {
  await mkdir(imageDir, { recursive: true });
};

const listCachedImages = async () => {
  await ensureImageDir();

  const files = await readdir(imageDir);

  return files
    .filter((file) => imageExtensions.has(extname(file).toLowerCase()))
    .sort()
    .map((file) => `${publicPrefix}/${file}`);
};

const getCachedImage = (cachedImages: string[]) => {
  if (!cachedImages.length) {
    return undefined;
  }

  const image = cachedImages[imageState.cursor % cachedImages.length];
  imageState.cursor += 1;
  return image;
};

const fallbackAvatar = (profile: Pick<RizzProfile, "id" | "name" | "headline">) => {
  const hue = [...profile.id].reduce((total, char) => total + char.charCodeAt(0), 0) % 360;
  const initials = profile.name.slice(0, 1).toUpperCase();
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1536" viewBox="0 0 1024 1536">
  <rect width="1024" height="1536" fill="hsl(${hue}, 52%, 42%)"/>
  <rect y="760" width="1024" height="776" fill="rgba(0,0,0,.22)"/>
  <circle cx="512" cy="560" r="190" fill="rgba(255,255,255,.24)"/>
  <circle cx="512" cy="500" r="108" fill="rgba(255,255,255,.50)"/>
  <path d="M280 930c42-126 138-196 232-196s190 70 232 196" fill="rgba(255,255,255,.46)"/>
  <text x="512" y="1210" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="128" font-weight="700" fill="white">${initials}</text>
  <text x="512" y="1300" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="38" fill="rgba(255,255,255,.84)">${escapeXml(profile.headline.slice(0, 34))}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const escapeXml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const withImage = (profile: Omit<RizzProfile, "imageUrl" | "imageStatus">, imageUrl: string, imageStatus: ProfileImageStatus): RizzProfile => ({
  ...profile,
  imageUrl,
  imageStatus,
});

const generateProfileImage = async (
  profile: Omit<RizzProfile, "imageUrl" | "imageStatus">
): Promise<RizzProfile> => {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), openAiTimeoutMs);

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    signal: abortController.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: imageModel,
      prompt: profile.imagePrompt,
      n: 1,
      size: "1024x1536",
      quality: "medium",
      output_format: "jpeg",
      background: "opaque",
    }),
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI image generation failed: ${response.status} ${details}`);
  }

  const payload = (await response.json()) as { data?: Array<{ b64_json?: string }> };
  const imageBase64 = payload.data?.[0]?.b64_json;

  if (!imageBase64) {
    throw new Error("OpenAI image generation returned no base64 image.");
  }

  await ensureImageDir();

  const fileName = `${profile.id}.jpg`;
  await writeFile(join(imageDir, fileName), Buffer.from(imageBase64, "base64"));

  return withImage(profile, `${publicPrefix}/${fileName}`, "generated");
};

export const attachGeneratedImages = async (
  profiles: Array<Omit<RizzProfile, "imageUrl" | "imageStatus">>
): Promise<RizzProfile[]> => {
  const cachedImages = await listCachedImages();

  return Promise.all(
    profiles.map(async (profile) => {
      if (!process.env.OPENAI_API_KEY) {
        const cachedImage = getCachedImage(cachedImages);
        return withImage(profile, cachedImage ?? fallbackAvatar(profile), cachedImage ? "cached" : "fallback");
      }

      try {
        return await generateProfileImage(profile);
      } catch (error) {
        console.error(error);
        const cachedImage = getCachedImage(cachedImages);
        return withImage(profile, cachedImage ?? fallbackAvatar(profile), cachedImage ? "cached" : "fallback");
      }
    })
  );
};

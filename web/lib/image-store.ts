import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import { extname, join } from "path";
import type { ProfileImageStatus, RizzProfile } from "./types";

type ImageCacheState = {
  cursor?: number;
  cachedProfileCursor: number;
  imageCursor: number;
  servedProfileIds: Set<string>;
};

const globalForImages = globalThis as typeof globalThis & {
  __rizzImageCache?: ImageCacheState;
};

const imageState =
  globalForImages.__rizzImageCache ??
  ({
    cachedProfileCursor: 0,
    imageCursor: 0,
    servedProfileIds: new Set<string>(),
  } satisfies ImageCacheState);

imageState.imageCursor ??= imageState.cursor ?? 0;
imageState.cachedProfileCursor ??= 0;
imageState.servedProfileIds =
  imageState.servedProfileIds instanceof Set ? imageState.servedProfileIds : new Set<string>();
globalForImages.__rizzImageCache = imageState;

const imageDir = join(process.cwd(), "public", "generated-profiles");
const publicPrefix = "/generated-profiles";
const imageModel = "gpt-image-2";
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const profileMetadataExtension = ".json";
const configuredTimeoutMs = Number(process.env.OPENAI_IMAGE_TIMEOUT_MS);
const openAiTimeoutMs = Number.isFinite(configuredTimeoutMs) && configuredTimeoutMs > 0 ? configuredTimeoutMs : 120_000;

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

const getCachedImage = (cachedImages: string[], allowReuse = true) => {
  if (!cachedImages.length) {
    return undefined;
  }

  if (!allowReuse && imageState.imageCursor >= cachedImages.length) {
    return undefined;
  }

  const image = cachedImages[imageState.imageCursor % cachedImages.length];
  imageState.imageCursor += 1;
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

const isRizzProfile = (value: unknown): value is RizzProfile => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const profile = value as Partial<RizzProfile>;

  return (
    typeof profile.id === "string" &&
    typeof profile.name === "string" &&
    typeof profile.age === "number" &&
    typeof profile.headline === "string" &&
    typeof profile.bio === "string" &&
    typeof profile.promptLabel === "string" &&
    typeof profile.promptAnswer === "string" &&
    Array.isArray(profile.interests) &&
    typeof profile.voice === "string" &&
    typeof profile.personality === "string" &&
    typeof profile.boundary === "string" &&
    typeof profile.openingLine === "string" &&
    typeof profile.imagePrompt === "string" &&
    typeof profile.imageUrl === "string"
  );
};

const readCachedProfile = async (fileName: string): Promise<RizzProfile | undefined> => {
  try {
    const content = await readFile(join(imageDir, fileName), "utf8");
    const profile = JSON.parse(content) as unknown;

    if (!isRizzProfile(profile)) {
      return undefined;
    }

    return {
      ...profile,
      imageStatus: "cached",
    };
  } catch {
    return undefined;
  }
};

const saveProfileMetadata = async (profile: RizzProfile) => {
  await writeFile(join(imageDir, `${profile.id}${profileMetadataExtension}`), JSON.stringify(profile, null, 2));
  imageState.servedProfileIds.add(profile.id);
};

const isAbortError = (error: unknown) =>
  error instanceof DOMException
    ? error.name === "AbortError"
    : typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: unknown }).name === "AbortError";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

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

  const profileWithImage = withImage(profile, `${publicPrefix}/${fileName}`, "generated");
  await saveProfileMetadata(profileWithImage);

  return profileWithImage;
};

export const takeCachedGeneratedProfiles = async (count: number, options?: { allowReuse?: boolean }) => {
  await ensureImageDir();

  const allowReuse = options?.allowReuse ?? false;
  const files = (await readdir(imageDir)).filter((file) => extname(file).toLowerCase() === profileMetadataExtension).sort();

  if (!files.length || count <= 0) {
    return [];
  }

  const availableFiles = allowReuse
    ? files
    : files.filter((file) => !imageState.servedProfileIds.has(file.slice(0, -profileMetadataExtension.length)));

  const selectedFiles: string[] = [];

  if (allowReuse) {
    for (let index = 0; index < count && files.length; index += 1) {
      selectedFiles.push(files[imageState.cachedProfileCursor % files.length]);
      imageState.cachedProfileCursor += 1;
    }
  } else {
    selectedFiles.push(...availableFiles.slice(0, count));
  }

  const cachedProfiles = (await Promise.all(selectedFiles.map(readCachedProfile))).filter((profile): profile is RizzProfile =>
    Boolean(profile)
  );

  cachedProfiles.forEach((profile) => imageState.servedProfileIds.add(profile.id));

  return cachedProfiles;
};

export const attachCachedImages = async (
  profiles: Array<Omit<RizzProfile, "imageUrl" | "imageStatus">>,
  options?: { allowReuse?: boolean; excludeImageUrls?: string[] }
) => {
  const excludedImages = new Set(options?.excludeImageUrls ?? []);
  const cachedImages = (await listCachedImages()).filter((image) => !excludedImages.has(image));
  const profilesWithCachedImages: RizzProfile[] = [];
  const remainingProfiles: Array<Omit<RizzProfile, "imageUrl" | "imageStatus">> = [];

  for (const profile of profiles) {
    const cachedImage = getCachedImage(cachedImages, options?.allowReuse ?? true);

    if (cachedImage) {
      profilesWithCachedImages.push(withImage(profile, cachedImage, "cached"));
    } else {
      remainingProfiles.push(profile);
    }
  }

  return {
    profiles: profilesWithCachedImages,
    remainingProfiles,
  };
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
        if (isAbortError(error)) {
          console.warn(
            `gpt-image-2 timed out after ${Math.round(openAiTimeoutMs / 1000)}s for ${profile.id}; using a cached or fallback image.`
          );
        } else {
          console.warn(`gpt-image-2 failed for ${profile.id}: ${getErrorMessage(error)}; using a cached or fallback image.`);
        }

        const cachedImage = getCachedImage(cachedImages);
        return withImage(profile, cachedImage ?? fallbackAvatar(profile), cachedImage ? "cached" : "fallback");
      }
    })
  );
};

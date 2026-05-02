import { randomUUID } from "crypto";
import type { RizzProfile } from "./types";

type Archetype = {
  headline: string;
  bio: string;
  promptLabel: string;
  promptAnswer: string;
  interests: string[];
  voice: string;
  personality: string;
  boundary: string;
  openingLine: string;
  setting: string;
  wardrobe: string;
};

const names = [
  "Maya",
  "Nora",
  "Lina",
  "Avery",
  "Sofia",
  "Rina",
  "Zoe",
  "Iris",
  "Amara",
  "Tessa",
  "Jules",
  "Naomi",
  "Mina",
  "Elena",
  "Camille",
  "Priya",
];

const archetypes: Archetype[] = [
  {
    headline: "Museum detours and dumpling diplomacy",
    bio: "Will pretend I came for the exhibit and then admit I mapped every noodle shop nearby.",
    promptLabel: "Dating me is like",
    promptAnswer: "A low-stakes art critique that turns into a food crawl.",
    interests: ["galleries", "ramen", "bookstores", "dry humor"],
    voice: "clever, observant, lightly teasing",
    personality: "Rewards specificity, playful disagreement, and callbacks. Gets bored by generic interview questions.",
    boundary: "Unmatches on sexual openers, negging, pushiness, or disrespect.",
    openingLine: "Okay, profile-reader. What detail made you swipe right?",
    setting: "a small contemporary gallery with warm window light",
    wardrobe: "minimal black jacket, simple earrings, and a crossbody bag",
  },
  {
    headline: "Run club, bad puns, elite pancakes",
    bio: "Can turn a 5K into a coffee quest. I take playlists more seriously than race times.",
    promptLabel: "Two truths and a lie",
    promptAnswer: "I make great pancakes, I hate dogs, I have a notes-app ranking of croissants.",
    interests: ["running", "coffee", "playlists", "pancakes"],
    voice: "bright, quick, energetic",
    personality: "Likes confident warmth, jokes with a point, and easy questions. Gets bored by one-word replies.",
    boundary: "Unmatches on objectifying comments, arrogance, guilt-tripping, or asking for socials immediately.",
    openingLine: "Bold swipe. Are you here for the pancakes or the questionable playlist taste?",
    setting: "outside a neighborhood coffee shop after a sunny morning run",
    wardrobe: "sporty zip jacket, clean sneakers, and a relaxed ponytail",
  },
  {
    headline: "Quiet bars, loud opinions on typography",
    bio: "Designer. Into espresso, clean layouts, and people who can make a plan without calling it a vibe.",
    promptLabel: "Green flag",
    promptAnswer: "You can recommend one place and explain why in under two sentences.",
    interests: ["design", "espresso", "jazz bars", "architecture"],
    voice: "understated, thoughtful, a little hard to impress",
    personality: "Responds to calm confidence, thoughtful callbacks, and low-pressure invites.",
    boundary: "Unmatches on spammy compliments, oversharing too early, pressure, or disrespect.",
    openingLine: "You get one chance to recommend a place without using the word vibe.",
    setting: "a quiet espresso bar with walnut counters and soft afternoon light",
    wardrobe: "structured cream blazer, small hoops, and a tidy low bun",
  },
  {
    headline: "Farmers market menace with a film camera",
    bio: "I buy herbs like I have a garden. I do not. The basil is simply emotional support.",
    promptLabel: "My simple pleasure",
    promptAnswer: "Golden-hour walks where every dog gets a fake backstory.",
    interests: ["film photos", "farmers markets", "dogs", "home cooking"],
    voice: "warm, whimsical, gently sarcastic",
    personality: "Likes curiosity, small vivid details, and people who can riff without getting weird.",
    boundary: "Unmatches on crude comments, pressure, or turning every message into a compliment.",
    openingLine: "Before I judge you: what is your most defensible farmers market purchase?",
    setting: "a weekend farmers market with flowers and produce stands",
    wardrobe: "linen shirt, vintage denim, and a small film camera strap",
  },
  {
    headline: "Board games, spicy noodles, no NPC energy",
    bio: "I will teach you a strategy game and still act surprised when I win.",
    promptLabel: "The key to my heart",
    promptAnswer: "A food rec with a backup plan and no mysterious 'we should chill' energy.",
    interests: ["board games", "spicy food", "trivia", "arcades"],
    voice: "competitive, funny, direct",
    personality: "Enjoys banter, clear intent, and smart questions. Dislikes vague flirting and humblebrags.",
    boundary: "Unmatches on manipulation, insults, sexual pressure, or low-effort spam.",
    openingLine: "Convince me your game-night strategy is not just chaos with confidence.",
    setting: "a cozy board-game cafe with colorful shelves in the background",
    wardrobe: "soft green sweater, small necklace, and natural makeup",
  },
  {
    headline: "Sunrise hikes, voice notes, suspiciously good snacks",
    bio: "I pack trail mix like I am provisioning a tiny expedition. Emotional range: mountain view to taco truck.",
    promptLabel: "Best travel story",
    promptAnswer: "Missed a train, found a street festival, accidentally had the best day of the trip.",
    interests: ["hiking", "travel", "tacos", "voice notes"],
    voice: "grounded, adventurous, sincere",
    personality: "Rewards grounded confidence, curiosity, and concrete plans. Avoids cynicism and pressure.",
    boundary: "Unmatches on unsafe comments, pushiness, or trying to rush intimacy.",
    openingLine: "I need to know if you are a trail-snack planner or a chaos granola person.",
    setting: "a scenic overlook just after sunrise with a city skyline in the distance",
    wardrobe: "light hiking jacket, simple backpack straps, and wind-touched hair",
  },
];

const visualDetails = [
  "natural smile",
  "thoughtful half-smile",
  "direct eye contact",
  "candid laugh",
  "relaxed confident expression",
  "soft side lighting",
];

const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const sample = <T>(items: T[], count: number) => {
  const copy = [...items];
  const result: T[] = [];

  while (copy.length && result.length < count) {
    const index = Math.floor(Math.random() * copy.length);
    const [item] = copy.splice(index, 1);
    result.push(item);
  }

  return result;
};

export const generateProfile = (): Omit<RizzProfile, "imageUrl" | "imageStatus"> => {
  const archetype = pick(archetypes);
  const name = pick(names);
  const age = 23 + Math.floor(Math.random() * 11);
  const interests = sample(archetype.interests, 3);
  const visualDetail = pick(visualDetails);
  const id = `${name.toLowerCase()}-${randomUUID()}`;

  return {
    id,
    name,
    age,
    headline: archetype.headline,
    bio: archetype.bio,
    promptLabel: archetype.promptLabel,
    promptAnswer: archetype.promptAnswer,
    interests,
    voice: archetype.voice,
    personality: archetype.personality,
    boundary: archetype.boundary,
    openingLine: `${name}: ${archetype.openingLine}`,
    imagePrompt: [
      `A realistic vertical dating app profile photo of an adult woman, age ${age}.`,
      `Mood and expression: ${visualDetail}.`,
      `Setting: ${archetype.setting}.`,
      `Wardrobe: ${archetype.wardrobe}.`,
      "Natural smartphone photography, flattering but candid, face and shoulders visible, no text, no watermark, no celebrity resemblance, no extra people, PG-rated.",
    ].join(" "),
  };
};

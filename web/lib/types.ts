export type ProfileImageStatus = "generated" | "cached" | "fallback";

export type RizzProfile = {
  id: string;
  name: string;
  age: number;
  headline: string;
  bio: string;
  promptLabel: string;
  promptAnswer: string;
  interests: string[];
  voice: string;
  personality: string;
  boundary: string;
  openingLine: string;
  imagePrompt: string;
  imageUrl: string;
  imageStatus: ProfileImageStatus;
};

export type ChatRole = "user" | "match" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

export type ChatStatus = "chatting" | "unmatched" | "won";

export type ChatReply = {
  message: ChatMessage;
  status: ChatStatus;
  source: "botpress" | "local";
  coaching?: {
    dateScore: number;
    read: string;
    nextMove: string;
  };
};

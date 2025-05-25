export interface PollData {
  id: string;
  question: string;
  options: string[];
  ttl: number;
  createdAt: number;
  ownerId: string;
  votes: number[]; // Number of votes for each option
}


export interface VoteRequestBody {
  optionIndex: number;
}
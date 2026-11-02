import { TarotExperience } from "@/components/TarotExperience";
import { CosmicExperience } from "@/components/CosmicExperience";

export default async function Home({ searchParams }: { searchParams: Promise<{ experience?: string }> }) {
  const params = await searchParams;
  return params.experience === "legacy" ? <TarotExperience /> : <CosmicExperience />;
}

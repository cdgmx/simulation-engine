import { ResilienceSimulator } from "@/components/resilience/resilience-simulator";
import { GuideRail } from "./guide-rail";

export default function Home() {
	return <ResilienceSimulator guideRail={<GuideRail />} />;
}

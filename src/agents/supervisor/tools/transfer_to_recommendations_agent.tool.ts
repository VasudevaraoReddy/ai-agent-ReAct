import { tool } from "@langchain/core/tools";

/**
* Transfer to the recommendations agent.
*/
const transferToRecommendationsAgent = tool(
  ({
    id
  }: {
    id: string;
  }) => { 
    console.log("Transfer to the recommendations agent");
      return "Successfully transferred to recommendations agent"
  },
  {
    name: "transfer_to_recommendations_agent",
    description: `
    Call this tool when the user wants to get recommendations for a resource.
    `,
  }
);

export default transferToRecommendationsAgent;

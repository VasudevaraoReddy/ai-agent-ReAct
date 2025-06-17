import { tool } from "@langchain/core/tools";

/**
* Transfer to the general agent.
*/
const transferToGeneralAgent = tool(
  () => {
    console.log("Transfer to the general agent");
    return "Successfully transferred to the general agent";
  },
  {
    name: "transfer_to_general_agent",
    description: "Use this tool to transfer to the general agent when the user's request is not related to recommendations or provisioning",
  }
);

export default transferToGeneralAgent;

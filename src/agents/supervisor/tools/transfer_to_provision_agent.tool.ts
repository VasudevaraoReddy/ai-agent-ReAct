import { tool } from "@langchain/core/tools";

/**
* Transfer to the provision agent.
*/
const transferToProvisionAgent = tool(
  () => {
    console.log("Transfer to the provision agent");
    return "Successfully transferred to provision agent"
  },
  {
    name: "transfer_to_provision_agent",
    description: `
    Call this tool when the user wants to provision a resource.
    `,
  }
);

export default transferToProvisionAgent;

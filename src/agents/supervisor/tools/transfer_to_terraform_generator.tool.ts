import { tool } from "@langchain/core/tools";

/**
* Transfer to the Terraform generator agent.
*/
const transferToTerraformGeneratorAgent = tool(
  () => {
    console.log("Transfer to the Terraform generator agent");
    return "Successfully transferred to Terraform generator agent"
  },
  {
    name: "transfer_to_terraform_generator_agent",
    description: `
    Call this tool when the user wants to generate Terraform code for infrastructure provisioning.
    This is useful when the user asks for IaC (Infrastructure as Code), Terraform templates, or 
    wants to automate infrastructure deployment with code.
    `,
  }
);

export default transferToTerraformGeneratorAgent; 
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import OllamaLLM from 'src/utils/ollama.llm';

const generateTerraformTool = tool(
  async (input: { 
    resource_type: string,
    specifications: string 
  }, config?: RunnableConfig) => {
    const { resource_type, specifications } = input;
    const csp = config?.configurable?.csp?.toLowerCase() || 'azure';
    
    try {
      console.log(`Generating Terraform code for ${resource_type} on ${csp}`);
      
      // Use the LLM to generate Terraform code from scratch
      const prompt = `
Generate Terraform code for a ${resource_type} on ${csp.toUpperCase()} cloud provider.
Specifications: ${specifications}

The code should follow Terraform best practices and be split into four files:

1. main.tf - Contains the main Terraform configuration including provider and resource blocks
2. variables.tf - Contains variable declarations
3. outputs.tf - Contains output declarations
4. terraform.tfvars.json - Contains variable values in JSON format

Return your response as a JSON object with the following structure:
{
  "main_tf": "contents of main.tf",
  "variables_tf": "contents of variables.tf",
  "outputs_tf": "contents of outputs.tf",
  "terraform_tfvars_json": "contents of terraform.tfvars.json"
}
`;

      // Call the LLM to generate the Terraform code
      const response = await OllamaLLM.withConfig({ format: 'json' }).invoke(prompt);
      console.log(response);
      const content = response?.content?.toString() || '{}';
      
      try {
        // Parse the LLM response as JSON
        const parsedContent = JSON.parse(content);
        
        // Ensure all required fields are present
        const main_tf = parsedContent.main_tf || '';
        const variables_tf = parsedContent.variables_tf || '';
        const outputs_tf = parsedContent.outputs_tf || '';
        const terraform_tfvars_json = parsedContent.terraform_tfvars_json || '';
        
        return JSON.stringify({
          main_tf,
          variables_tf,
          outputs_tf,
          terraform_tfvars_json,
          resource_type,
          csp
        });
      } catch (parseError) {
        console.error('Error parsing LLM response:', parseError);
        
        // If parsing fails, try to extract code blocks from the response
        const mainMatch = content.match(/```(?:terraform|hcl)?\s*(provider[\s\S]+?)```/);
        const variablesMatch = content.match(/```(?:terraform|hcl)?\s*(variable[\s\S]+?)```/);
        const outputsMatch = content.match(/```(?:terraform|hcl)?\s*(output[\s\S]+?)```/);
        const tfvarsMatch = content.match(/```(?:json)?\s*(\{\s*"[\s\S]+?)```/);
        
        const main_tf = mainMatch ? mainMatch[1] : '';
        const variables_tf = variablesMatch ? variablesMatch[1] : '';
        const outputs_tf = outputsMatch ? outputsMatch[1] : '';
        const terraform_tfvars_json = tfvarsMatch ? tfvarsMatch[1] : '{}';
        
        return JSON.stringify({
          main_tf,
          variables_tf,
          outputs_tf,
          terraform_tfvars_json,
          resource_type,
          csp
        });
      }
    } catch (error) {
      console.error('Error generating Terraform code:', error);
      return JSON.stringify({
        error: 'Failed to generate Terraform code',
        details: error.message
      });
    }
  },
  {
    name: 'generate_terraform',
    description: 'Generate Terraform code for the specified resource type and cloud provider',
    schema: z.object({
      resource_type: z.string().describe('The type of resource to create (e.g., "virtual_machine", "storage_account", etc.)'),
      specifications: z.string().describe('Detailed specifications for the resource to be created')
    }),
  }
);

export default generateTerraformTool; 
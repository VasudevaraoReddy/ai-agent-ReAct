import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import CodeOllamaLLM from 'src/utils/ollama.llm';
import * as fs from 'fs/promises';
import * as path from 'path';

const PROVIDER_CONFIGS = {
  azure: `terraform { required_providers { azurerm = { source = "hashicorp/azurerm", version = "~> 3.0" } } }\nprovider "azurerm" { features {} }`,
  aws: `terraform { required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } } }\nprovider "aws" { region = var.region }`,
  gcp: `terraform { required_providers { google = { source = "hashicorp/google", version = "~> 4.0" } } }\nprovider "google" { project = var.project_id, region = var.region }`,
};

const generateTerraformTool = tool(
  async (
    input: { resource_type: string; specifications: string },
    config?: RunnableConfig,
  ) => {
    const { resource_type, specifications } = input;
    const csp = config?.configurable?.csp?.toLowerCase() || 'azure';

    try {
      const result = await generateTerraformOptimized(
        resource_type,
        specifications,
        csp,
      );
      await saveRecord(result, config);
      return JSON.stringify(result, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: 'Generation failed',
        details: error.message,
      });
    }
  },
  {
    name: 'generate_terraform',
    description: 'Generate optimized Terraform code with duplicate prevention',
    schema: z.object({
      resource_type: z.string().describe('Resource type'),
      specifications: z.string().describe('Resource specifications'),
    }),
  },
);

async function generateTerraformOptimized(
  resourceType: string,
  specs: string,
  csp: string,
) {
  console.log(`Starting Terraform generation for ${resourceType} on ${csp}`);
  const startTime = Date.now();

  // Step 1: Generate main.tf first
  const mainTf = await generateMainTf(resourceType, specs, csp);

  // Step 2: Run variables & outputs in parallel
  const [variablesTf, outputsTf] = await Promise.all([
    generateVariablesTf(mainTf, resourceType, csp),
    generateOutputsTf(mainTf, resourceType, csp),
  ]);

  // Step 3: tfvars based on variables
  const tfvarsJson = generateTfvarsFromVariablesTf(variablesTf);

  const endTime = Date.now();
  console.log(`Terraform generation completed in ${endTime - startTime}ms`);

  return {
    main_tf: mainTf,
    variables_tf: variablesTf,
    outputs_tf: outputsTf,
    terraform_tfvars_json: tfvarsJson,
    resource_type: resourceType,
    csp,
    generation_time_ms: endTime - startTime,
  };
}

async function generateVariablesTf(
  mainTf: string,
  resourceType: string,
  csp: string,
): Promise<string> {
  const prompt = `Generate variables.tf ONLY for the following main.tf code:

${mainTf}

REQUIREMENTS:
- Declare all variables used (e.g., var.name, var.location)
- Include description and type
- Mark passwords/sensitive values properly
- No markdown, no explanation
- Cloud is ${csp}

Return HCL only.`;

  const response = await CodeOllamaLLM.invoke(prompt);
  return cleanTerraformCode(response?.content?.toString() || '');
}

async function generateOutputsTf(
  mainTf: string,
  resourceType: string,
  csp: string,
): Promise<string> {
  const prompt = `Generate outputs.tf ONLY for the following main.tf code:

${mainTf}

REQUIREMENTS:
- Output key attributes (e.g., name, id, ip)
- Include proper descriptions
- No markdown, no explanation
- Cloud is ${csp}

Return HCL only.`;

  const response = await CodeOllamaLLM.invoke(prompt);
  return cleanTerraformCode(response?.content?.toString() || '');
}

function generateTfvarsFromVariablesTf(variablesTf: string): string {
  const tfvars: Record<string, any> = {};
  const matches = variablesTf.match(/variable\s+"(\w+)"/g);

  matches?.forEach((v) => {
    const name = v.match(/"(\w+)"/)?.[1];
    if (name) tfvars[name] = getSampleValue(name);
  });

  return JSON.stringify(tfvars, null, 2);
}

async function generateMainTf(
  resourceType: string,
  specs: string,
  csp: string,
): Promise<string> {
  const prompt = `Generate ONLY the main.tf Terraform configuration for ${resourceType} on ${csp.toUpperCase()}.

CRITICAL REQUIREMENTS:
- Include ${PROVIDER_CONFIGS[csp] || PROVIDER_CONFIGS.azure}
- Use modern Terraform syntax (azurerm_windows_virtual_machine for Windows VMs)
- Use variables with var. prefix for ALL configurable values
- Include complete resource dependencies
- NO variable declarations - only resources
- NO comments or explanations
- NO markdown formatting
- Return ONLY HCL resource blocks

Specifications: ${specs}

Return pure HCL code only:`;

  const response = await CodeOllamaLLM.invoke(prompt);
  return cleanTerraformCode(response?.content?.toString() || '');
}

function cleanTerraformCode(code: string): string {
  return code
    .replace(/```(?:terraform|hcl|tf)?\n?/g, '')
    .replace(/```\n?/g, '')
    .replace(/Here is.*?:|Here's.*?:/gi, '')
    .replace(/This (?:file|code).*?:/gi, '')
    .replace(/^\s*#.*$/gm, '') // Remove comments
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Normalize whitespace
    .trim();
}

function getSampleValue(varName: string): any {
  const lower = varName.toLowerCase();
  if (lower.includes('password')) return 'P@ssw0rd123!';
  if (lower.includes('username')) return 'adminuser';
  if (lower.includes('name') && !lower.includes('group'))
    return `example-${varName}`;
  if (lower.includes('resource_group')) return `rg-example-${Date.now()}`;
  if (lower.includes('location') || lower.includes('region')) return 'East US';
  if (lower.includes('size')) return 'Standard_DS2_v2';
  if (lower.includes('type')) return 't3.micro';
  if (lower.includes('count') || lower.includes('capacity')) return 2;
  if (lower.includes('tags'))
    return { Environment: 'dev', Project: 'terraform' };
  if (lower.includes('ids') || lower.includes('subnets'))
    return ['subnet-12345', 'subnet-67890'];
  return `sample-${varName}`;
}

async function saveRecord(result: any, config?: RunnableConfig): Promise<void> {
  try {
    const record = {
      userid: config?.configurable?.userid || '',
      timestamp: new Date().toISOString(),
      resource_type: result.resource_type,
      csp: result.csp,
      generation_time_ms: result.generation_time_ms,
      terraformFiles: {
        'main.tf': result.main_tf,
        'variables.tf': result.variables_tf,
        'outputs.tf': result.outputs_tf,
        'terraform.tfvars.json': result.terraform_tfvars_json,
      },
    };

    const outputDir = path.resolve(process.cwd(), 'generated');
    const outputPath = path.join(outputDir, 'terraform_records.json');

    await fs.mkdir(outputDir, { recursive: true });

    let records: any[] = [];
    try {
      const existing = await fs.readFile(outputPath, 'utf-8');
      records = JSON.parse(existing);
    } catch {}

    records.push(record);
    await fs.writeFile(outputPath, JSON.stringify(records, null, 2));

    console.log(
      `Record saved successfully. Generation time: ${result.generation_time_ms}ms`,
    );
  } catch (error) {
    console.error('Save failed:', error);
  }
}

export default generateTerraformTool;

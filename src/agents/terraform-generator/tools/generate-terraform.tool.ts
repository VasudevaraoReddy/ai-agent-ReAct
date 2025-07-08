import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RunnableConfig } from '@langchain/core/runnables';
import CodeOllamaLLM from 'src/utils/ollama.llm';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

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
    // Use input parameters, or fall back to config values if provided
    const resource_type = input.resource_type || config?.configurable?.resourceType;
    const specifications = input.specifications || config?.configurable?.specifications;
    
    console.log('Input', { resource_type, specifications });
    const csp = config?.configurable?.csp?.toLowerCase() || 'azure';
    const exampleUrlMap = {
      azure: {
        'api-management':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/api-management/main.tf',
        backup:
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/backup/main.tf',
        'docker-authentication':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/docker-authentication/main.tf',
        'docker-basic':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/docker-basic/main.tf',
        'docker-compose':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/docker-compose/main.tf',
        'docker-kubernetes':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/docker-kubernetes/main.tf',
        'function-azure-RBAC-role-assignment':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/function-azure-RBAC-role-assignment/main.tf',
        'function-basic':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/function-basic/main.tf',
        'function-python':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/function-python/main.tf',
        'linux-authentication':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/linux-authentication/main.tf',
        'linux-basic':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/linux-basic/main.tf',
        'linux-function-app-with-source-control':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/linux-function-app-with-source-control/main.tf',
        'linux-nodejs':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/linux-nodejs/main.tf',
        'linux-php':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/linux-php/main.tf',
        'linux-web-app-zip-deploy':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/linux-web-app-zip-deploy/main.tf',
        'stored-in-keyvault':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service-certificate/stored-in-keyvault/main.tf',
        'windows-authentication':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/windows-authentication/main.tf',
        'windows-basic':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/windows-basic/main.tf',
        'windows-container':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/windows-container/main.tf',
        'windows-java':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/windows-java/main.tf',
        'windows-nodejs':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/app-service/windows-nodejs/main.tf',
        'virtual-machine-windows-basic':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/virtual-machines/windows/basic-password/main.tf',
        'virtual-machine-windows-disk-encryption':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/virtual-machines/windows/azure-disk-encryption/main.tf',
        'virtual-networks-basic':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/virtual-networks/basic/main.tf',
        'virtual-networks-firewall':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/virtual-networks/azure-firewall/main.tf',
        'virtual-networks-multiple-subnets':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/virtual-networks/multiple-subnets/main.tf',
        'virtual-network-gateway-basic':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/virtual-networks/virtual-network-gateway/basic/main.tf',
        'virtual-networks-network-security-group':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/virtual-networks/network-security-group/main.tf',
        'virtual-networks-network-security-group-rule':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/virtual-networks/network-security-group-rule/main.tf',
        'virtual-hub':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/virtual-networks/virtual-hub/main.tf',
        'kubernetes-nodes-on-internal-network':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/kubernetes/nodes-on-internal-network/main.tf',
        'kubernetes-basic-cluster':
          'https://raw.githubusercontent.com/hashicorp/terraform-provider-azurerm/main/examples/kubernetes/basic-cluster/main.tf',
      },
      aws: {},
      gcp: {},
    };

    async function findClosestExampleUrl(
      resourceType: string,
      csp: string,
      map: Record<string, Record<string, string>>,
    ): Promise<any> {
      const candidates = Object.keys(map?.[csp] || {});
      if (candidates.length === 0) return null;

      const prompt = `
      You are helping find the most relevant Terraform example file.

      Available examples for CSP "${csp}" are:
      ${candidates.join('\n')}

      Now given this input resource type: "${resourceType}" with specifications: ${specifications}

      INSTRUCTIONS:
      - Extract the main keywords from the resourceType and specifications.
      - Find the closest matching example keys from the provided list.
      - If there is only **one** closest match, return that match only.
      - If there are multiple relevant matches, return the **top 3 most distinct matches** in an array (max 3).
      - Ensure the matches are distinct and relevant to the resource type.
      - Return ONLY the array of matches, with no explanations or additional text.
      - If no matches are found, return an empty array.

      RETURN FORMAT:
      {
        "matches": ["match1", "match2", "match3"]
      }

      IMPORTANT: Return ONLY valid JSON with the exact format above. Do not include any explanations or text outside the JSON object.
      `;

      const response = await CodeOllamaLLM.invoke(prompt);
      console.log('In finding the closest example:', response);

      try {
        // Parse the result and extract matches
        const responseData = JSON.parse(
          response?.content?.toString()?.trim() || '{"matches": []}'
        );

        // Extract matches if available
        const matches = responseData?.matches || [];

        // Filter out duplicates
        const uniqueMatches = Array.from(new Set(matches));

        const matchedUrls = uniqueMatches
          .map((matchKey: any) => map[csp]?.[matchKey])
          .filter(Boolean);

        // If we have only one match, return it as a single string
        if (matchedUrls.length === 1) {
          return matchedUrls[0]; // Single closest match
        }

        // Otherwise, return up to 3 matches
        return matchedUrls.length > 0 ? matchedUrls.slice(0, 3) : null;
      } catch (error) {
        console.error('Error parsing LLM response:', error);
        console.error('Raw response:', response?.content?.toString());
        return null;
      }
    }

    async function loadTerraformExampleFile(
      resourceType: string,
      csp: string,
    ): Promise<any> {
      let tfUrl = '';

      console.warn(
        `⚠️Using LLM fallback for finding the Matches "${resourceType}".`,
      );

      const closestMatches = await findClosestExampleUrl(
        resourceType,
        csp,
        exampleUrlMap,
      );

      let combinedContent = ''; // To store the combined content

      if (Array.isArray(closestMatches)) {
        // Check if we have more than 1 match (for multiple matches)
        if (closestMatches.length > 1) {
          console.log(
            `Found ${closestMatches.length} matches for "${resourceType}". Fetching content for each...`,
          );

          // Fetch content from each match and append it to combinedContent
          for (const url of closestMatches) {
            const response = await axios.get(url);
            combinedContent += response.data; // Append content
          }

          const doc = new Document({
            pageContent: combinedContent,
            metadata: { source: '' },
          });
          return [doc];
        } else {
          // Only one match found, use it directly
          tfUrl = closestMatches[0];
          const doc = new Document({
            pageContent: combinedContent,
            metadata: { source: tfUrl },
          });

          return [doc];
        }
      } else {
        tfUrl = closestMatches; // Single match found, use it directly
        const doc = new Document({
          pageContent: combinedContent,
          metadata: { source: tfUrl },
        });
        return [doc];
      }
    }

    console.log('🚀 Starting Terraform RAG agent...');

    const docs = await loadTerraformExampleFile(resource_type, csp);

    console.log('✅ Loaded doc length:', docs[0].pageContent.length);

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
    const chunks = await splitter.splitDocuments(docs);

    const fullText = chunks.map((doc) => doc.pageContent).join('\n\n');

    try {
      const result = await generateTerraformOptimized(
        resource_type,
        specifications,
        csp,
        fullText,
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
  fullText: string,
) {
  let attempts = 0;
  const maxAttempts = 3;
  let result: any;
  let score = 0;
  let feedback = '';

  while (attempts < maxAttempts && score < 70) {
    console.log(`Attempt ${attempts + 1}: Generating Terraform code...`);
    console.log(`Starting Terraform generation for ${resourceType} on ${csp}`);
    const startTime = Date.now();

    // Step 1: Generate main.tf first
    const mainTf = await generateMainTf(resourceType, specs, csp, fullText);

    // Step 2: Run variables & outputs in parallel
    const [variablesTf, outputsTf] = await Promise.all([
      generateVariablesTf(mainTf, resourceType, csp),
      generateOutputsTf(mainTf, resourceType, csp),
    ]);

    // Step 3: tfvars based on variables
    const tfvarsJson = generateTfvarsFromVariablesTf(variablesTf);

    const endTime = Date.now();
    console.log(`Terraform generation completed in ${endTime - startTime}ms`);

    result = {
      main_tf: mainTf,
      variables_tf: variablesTf,
      outputs_tf: outputsTf,
      terraform_tfvars_json: tfvarsJson,
      resource_type: resourceType,
      csp,
      generation_time_ms: endTime - startTime,
    };

    const scoring = await scoreGeneratedCode(result, resourceType, csp);
    score = scoring.score;
    feedback = scoring.feedback;

    console.log(
      `Attempt ${attempts + 1}: Score = ${score}, Feedback = ${feedback}`,
    );
    attempts++;
  }

  result.score = score;
  result.feedback = feedback;

  return result;
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
  fulltext: string,
): Promise<string> {
  const prompt = `Generate ONLY the main.tf Terraform configuration for ${resourceType} on ${csp.toUpperCase()}.

CRITICAL REQUIREMENTS:
- Include ${PROVIDER_CONFIGS[csp] || PROVIDER_CONFIGS.azure}
- Include complete resource dependencies
- NO variable declarations - only resources
- NO comments or explanations
- NO markdown formatting
- Return ONLY HCL resource blocks

You can use below refernce content:
${fulltext}

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

async function scoreGeneratedCode(
  result: any,
  resourceType: string,
  csp: string,
): Promise<{ score: number; feedback: string }> {
  const prompt = `You are a Terraform expert reviewing the following generated files for a "${resourceType}" resource on "${csp.toUpperCase()}".

Files:
--- main.tf ---
${result.main_tf}

--- variables.tf ---
${result.variables_tf}

--- outputs.tf ---
${result.outputs_tf}

--- terraform.tfvars.json ---
${result.terraform_tfvars_json}

Evaluate the code quality based on:
1. Correct syntax and Terraform conventions
2. Appropriate use of variables (no hardcoded values)
3. Completeness (should support deployment)
4. Best practices (e.g., sensitive values marked, outputs named properly)
5. Cloud compatibility (based on ${csp})

Give:
- A score out of 100
- Very short feedback on why the score is what it is

Respond in this JSON format:
{ "score": 85, "feedback": "Good use of variables, minor missing output." }

Return ONLY valid JSON with no commentary.`;

  const response = await CodeOllamaLLM.invoke(prompt);
  const cleaned = response?.content?.toString().trim() || '{}';

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return { score: 0, feedback: 'Failed to parse review response' };
  }
}

async function saveRecord(result: any, config?: RunnableConfig): Promise<void> {
  const timestamp = new Date().toISOString();
  try {
    const record = {
      userid: config?.configurable?.userid || '',
      timestamp,
      resource_type: result.resource_type,
      userInput: config?.configurable?.userInput || '',
      modifiedTimestamp: timestamp,
      csp: result.csp,
      generation_time_ms: result.generation_time_ms,
      score: result.score,
      feedback: result.feedback,
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

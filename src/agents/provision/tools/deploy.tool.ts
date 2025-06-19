// src/tools/deploy-tool.ts

import { tool } from '@langchain/core/tools';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  updateJsonInDevOps,
  getTerraformVariables,
} from 'src/apis/azureDevopsService.api';
import { RunnableConfig } from '@langchain/core/runnables';
import getServiceConfigTool from './service-config.tool';
import { ToolMessage } from '@langchain/core/messages';

const deployTool = tool(
  async (input: { service: string }, config?: RunnableConfig) => {
    // CRITICAL VALIDATION: Check if service config and required fields are available
    // const serviceConfigAvailable =
    //   config?.configurable?.service_config_available;
    // const serviceConfig = config?.configurable?.service_config;
    // console.log('In deploy tool', { serviceConfigAvailable });

    // // If service configuration is not available, fetch it first
    // if (
    //   serviceConfigAvailable === 'False' ||
    //   serviceConfigAvailable === undefined
    // ) {
    //   try {
    //     // Tool Invocation
    //     const serviceToolResponse: any = await getServiceConfigTool.invoke(
    //       input,
    //       config,
    //     );
    //     let toolContent: any = {};

    //     if (serviceToolResponse instanceof ToolMessage) {
    //       toolContent = JSON.parse(serviceToolResponse?.content.toString());
    //     }
    //     // If service config wasn't found, return error
    //     if (!toolContent?.found || !toolContent?.serviceConfig) {
    //       return JSON.stringify({
    //         response: `Service configuration for ${input.service} is not available. Cannot proceed with deployment.`,
    //         status: false,
    //         error_code: 'SERVICE_CONFIG_NOT_FOUND',
    //       });
    //     }
    //     return JSON.stringify({
    //       response: `I've found the service configuration for ${input.service}. Please confirm the required configuration values before proceeding with deployment.`,
    //       status: false,
    //       serviceConfig: toolContent?.serviceConfig,
    //       found: toolContent?.found,
    //     });
    //   } catch (error) {
    //     console.error('Error fetching service configuration:', error);
    //     return JSON.stringify({
    //       response: `Error fetching service configuration: Unable to proceed with deployment.`,
    //       status: false,
    //       error_code: 'SERVICE_CONFIG_FETCH_ERROR',
    //     });
    //   }
    // }

    // Extract form data from configuration
    const payload = config?.configurable?.service_form_data;
    const userId = config?.configurable?.userId;
    const isPayloadEmpty = Object.values(payload || {}).some(
      (value) =>
        value === '' ||
        value === null ||
        value === undefined ||
        (Array.isArray(value) && value.length === 0),
    );

    // Validate payload existence
    if (isPayloadEmpty) {
      return JSON.stringify({
        response: `Cannot deploy without configuration data. Required fields are missing. Please provide the required configuration values.`,
        status: false,
        error_code: 'MISSING_REQUIRED_FIELDS',
        serviceConfig: {},
      });
    }

    // Parse payload and validate structure
    const payloadObj = typeof payload === 'string' ? JSON.parse(payload) : payload;
    if (!payloadObj) {
      console.log('INVALID_PAYLOAD');
      return JSON.stringify({
        response: `Invalid payload format. Missing required configuration data.`,
        status: false,
        error_code: 'INVALID_PAYLOAD',
      });
    }

    const { formData, template, serviceDeploymentId } = payloadObj;

    // Validate form data - explicit check for empty object
    if (!formData || Object.keys(formData).length === 0) {
      console.log('EMPTY_FORM_DATA');
      return JSON.stringify({
        response: `No values provided. Required fields are missing. Please provide values for all required fields.`,
        status: false,
        error_code: 'EMPTY_FORM_DATA',
        // Include service configuration to help the agent list the required fields
        serviceConfig: config?.configurable?.serviceConfig,
      });
    }

    try {
      // Uncomment for actual implementation
      const tfVariables: any = await getTerraformVariables();
      if (tfVariables?.length > 0) {
        let modifiedData = Object.keys(formData).map((key) => ({
          variableName: key,
          newValue: formData[key],
        }));
        const newUpdatedFormValues = {};

        modifiedData.forEach(({ variableName, newValue }) => {
          const tfVar = tfVariables.find((obj) =>
            Object.prototype.hasOwnProperty.call(obj, variableName),
          );
          if (tfVar) {
            newUpdatedFormValues[tfVar[variableName]] = newValue;
          } else {
            newUpdatedFormValues[variableName] = newValue;
          }
        });

        const devOpsResponse = await updateJsonInDevOps(
          template,
          newUpdatedFormValues,
          userId,
          'AGENT',
          'Destroy',
        );
        return JSON.stringify({
          response: `Platform has initiated infrastructure provisioning for ${template}`,
          status: true,
          serviceDeploymentId,
          devOpsResponse,
          metadata: {
            service: input.service,
            template: template,
          },
        });
      }
    } catch (error: any) {
      console.error('Deployment error:', error);
      return JSON.stringify({
        response: `Failed to deploy ${template}: ${error.message}`,
        status: false,
        error_code: 'DEPLOYMENT_ERROR',
      });
    }
  },
  {
    name: 'deploy_service',
    description:
      'Call this tool when you have the service configuration and the required fields are provided by the user' +
      'to initiate the deployment of the service',
    schema: z.object({
      service: z
        .string()
        .describe(
          'The service name to provision (e.g. "EC2", "VM", "Compute Engine", "Compute")',
        ),
    }),
  },
);

export default deployTool;

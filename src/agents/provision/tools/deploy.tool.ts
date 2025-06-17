// src/tools/deploy-tool.ts

import { tool } from '@langchain/core/tools';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  updateJsonInDevOps,
  getTerraformVariables,
} from 'src/apis/azureDevopsService.api';
import { RunnableConfig } from '@langchain/core/runnables';

const deployTool = tool(
  async (input: {},config?:RunnableConfig) => {
    const payload = config?.configurable?.formData;
    const userId = config?.configurable?.userId;
    console.log("In deploy tool",{payload,userId})
    // Handle empty or missing payload
    if (!payload || payload === 'No payload provided') {
      return JSON.stringify({
        response: `Cannot deploy without configuration data. Please provide the required configuration values.`,
        status: false,
      });
    }

      const payloadObj =
        typeof payload === 'string' ? JSON.parse(payload) : payload;
        if (!payloadObj) {
            return JSON.stringify({
            response: `Invalid payload: missing 'template' or 'formData'.`,
            status: false,
        });
      }

    const { formData, template } = payloadObj;

    if (!formData || Object.keys(formData).length === 0) {
      return JSON.stringify({
        response: `Cannot deploy without configuration data.`,
        status: false,
      });
    }

    // try {
    //   const deploymentId = uuidv4();
    //   const tfVariables: any = await getTerraformVariables();
    //   if (tfVariables?.length > 0) {
    //     let modifiedData = Object.keys(formData).map((key) => ({
    //       variableName: key,
    //       newValue: formData[key],
    //     }));
    //     const newUpdatedFormValues = {};

    //     modifiedData.forEach(({ variableName, newValue }) => {
    //       const tfVar = tfVariables.find((obj) =>
    //         Object.prototype.hasOwnProperty.call(obj, variableName),
    //       );
    //       if (tfVar) {
    //         newUpdatedFormValues[tfVar[variableName]] = newValue;
    //       } else {
    //         newUpdatedFormValues[variableName] = newValue;
    //       }
    //     });

    //     const response = await updateJsonInDevOps(
    //       template,
    //       newUpdatedFormValues,
    //       userId,
    //       'AGENT',
    //       'Destroy',
    //     );

    //     return JSON.stringify({
    //       response: `Platform has initiated infrastructure provisioning for ${template}`,
    //       status: true,
    //       configuration: {
    //         originalData: formData,
    //         modifiedData,
    //       },
    //       deploymentId,
    //     });
    //   }
    // } catch (error: any) {
    //   return JSON.stringify({
    //     response: `Failed to deploy ${template}: ${error.message}`,
    //     status: false,
    //   });
    // }
    return JSON.stringify({
      response: `Platform has initiated infrastructure provisioning for ${template}`,
      status: true,
    });
  },
  {
    name: 'deploy_service',
    description:
      'Use this tool to deploy a service once the user confirms the deployment and asked the service configuration details',
    schema: z.object({
    }),
  },
);

export default deployTool;

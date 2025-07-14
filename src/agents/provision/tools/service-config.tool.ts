import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import axios from 'axios';
import { RunnableConfig } from '@langchain/core/runnables';
import { v4 as uuidv4 } from 'uuid';

const serviceConfigTool = tool(
  async (input: { service: string }, config?: RunnableConfig) => {
    const { service } = input;
    console.log('In service config tool:', { service });
    const csp = config?.configurable?.csp;

    try {
      if (!service) {
        return JSON.stringify({ serviceConfig: null, found: false });
      }

      const allDataServicesDataResponse = await axios.get(
        'http://10.95.108.11:4000/infra-provision-service/allInfraServices',
      );

      const allInfraServicesDataResponse = await axios.get(
        'http://10.95.108.11:4000/infra-provision-service/allDataServices',
      );

      // const allServicesDataResponse = {
      //   status: 200,
      //   data: [],
      // };
      const allServicesData: any[] =
        allInfraServicesDataResponse.status === 200
          ? [
              ...allDataServicesDataResponse.data,
              ...allInfraServicesDataResponse.data,
            ]
          : [];

      const filteredServices = allServicesData.filter((svc: any) => {
        const cloudMatch = svc?.cloudType?.toLowerCase() === csp.toLowerCase();
        const nameMatch = svc?.title
          ?.toLowerCase()
          .includes(service?.toLowerCase());
        return cloudMatch && nameMatch;
      });

      if (filteredServices.length > 0) {
        console.log('Found');
        const enrichedServices = filteredServices.map((svc) => {
          return {
            ...svc,
            requiredFields: svc?.requiredFields || [],
            serviceDeploymentId: uuidv4(),
          };
        });

        return JSON.stringify({
          response: `I've found the service configuration for ${input.service}. Please fill the details and click Deploy Button`,
          serviceConfig: enrichedServices,
          found: enrichedServices.some((svc) => svc.requiredFields.length > 0),
          serviceName: service,
        });
      } else {
        console.log('Not Found - Redirecting to Terraform Generator');
        return JSON.stringify({
          response: `Service configuration for ${input.service} is not available. I'll generate Terraform code for you instead.`,
          serviceConfig: null,
          found: false,
          serviceName: service,
          use_terraform_generator: true,
          resource_type: service,
          specifications: `Create ${service} infrastructure on ${csp.toUpperCase()}`,
        });
      }
    } catch (error) {
      console.error('Error processing service config request:', error);
      return JSON.stringify({
        response: 'Something went wrong. Please try again later.',
        serviceConfig: null,
        found: false,
        serviceName: service,
      });
    }
  },
  {
    name: 'get_service_config',
    description:
      'Call this tool when you need to fetch the service configuration for the given service. ' +
      'Use this tool as a pre-requisite for the deploy_service tool.',
    schema: z.object({
      service: z
        .string()
        .describe(
          'The service name to provision (e.g. "EC2", "VM", "Compute Engine", "Compute")',
        ),
    }),
  },
);

export default serviceConfigTool;

// import { tool } from '@langchain/core/tools';
// import { z } from 'zod';
// import axios from 'axios';
// import { RunnableConfig } from '@langchain/core/runnables';

// const serviceConfigTool = tool(
//   async (input: { service: string }, config?: RunnableConfig) => {
//     const { service } = input;
//     console.log('In service config tool:', { service });
//     const csp = config?.configurable?.csp;
//     try {
//       // Validate required parameters
//       if (!service) {
//         return JSON.stringify({
//           serviceConfig: null,
//           found: false,
//         });
//       }

//       // const allServicesResponse = await axios.get(
//       //   'http://10.95.108.11:4000/infra-provision-service/allInfraServices',
//       // );

//       // let allServicesData = Array.isArray(allServicesResponse.data)
//       //   ? allServicesResponse.data
//       //   : [];

//       let allServicesData:any[] = [];

//       // allServicesData = [
//       //   {
//       //     id: 'load-balancer-azure',
//       //     name: 'Load Balancer',
//       //     template: 'loadbalancer',
//       //     price: 0,
//       //     cloud: 'azure',
//       //     available: true,
//       //     requiredFields: [
//       //       {
//       //         type: 'input',
//       //         fieldId: 'loadBalancerName',
//       //         fieldName: 'Load Balancer Name',
//       //         fieldValue: '',
//       //         fieldTypeValue: 'String',
//       //         dependent: false,
//       //         dependentON: '',
//       //         dependentFOR: '',
//       //       },
//       //       {
//       //         type: 'input',
//       //         fieldId: 'resourceGroup',
//       //         fieldName: 'Resource Group',
//       //         fieldValue: '',
//       //         fieldTypeValue: 'String',
//       //         dependent: false,
//       //         dependentON: '',
//       //         dependentFOR: '',
//       //       },
//       //       {
//       //         type: 'input',
//       //         fieldId: 'location',
//       //         fieldName: 'Location',
//       //         fieldValue: '',
//       //         fieldTypeValue: 'String',
//       //         dependent: false,
//       //         dependentON: '',
//       //         dependentFOR: '',
//       //       },
//       //     ],
//       //   },
//       // ];

//       // filter obly for csp not service
//       const filteredService = allServicesData && allServicesData.filter((service: any) => {
//         const cloudMatch = service?.cloud?.toLowerCase() === csp.toLowerCase();
//         return cloudMatch;
//       });
//       const enhancedService = {
//         ...filteredService[0],
//         requiredFields:filteredService.length>0  && filteredService[0]?.requiredFields?.map((field:any) => ({
//           ...field,
//         })),
//       };
//       return JSON.stringify({
//         serviceConfig: enhancedService,
//         found: true,
//       }, null, 2);
//     } catch (error) {
//       console.error('Error processing service config request:', error);
//       return JSON.stringify({
//         serviceConfig: null,
//         found: false,
//       }, null, 2);
//     }
//   },
//   {
//     name: 'get_service_config',
//     description:'Call this tool when you need to fetch the service configuration for the given service'+
//     'Use this tool as a pre-requisite for the deploy_service tool',
//     schema: z.object({
//       service: z
//         .string()
//         .describe(
//           'The service name to provision (e.g. "EC2", "VM", "Compute Engine", "Compute")',
//         ),
//     },),
//   },
// );

// export default serviceConfigTool;



import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import axios from 'axios';
import { RunnableConfig } from '@langchain/core/runnables';

const serviceConfigTool = tool(
  async (input: { service: string }, config?: RunnableConfig) => {
    const { service } = input;
    console.log('In service config tool:', { service });
    const csp = config?.configurable?.csp;

    try {
      if (!service) {
        return JSON.stringify({ serviceConfig: null, found: false });
      }

      const allServicesDataResponse = await axios.get('http://localhost:3001/services');

      const allServicesData: any[] = allServicesDataResponse.status === 200
        ? allServicesDataResponse.data
        : [];

      const filteredServices = allServicesData.filter((svc: any) => {
        const matchesCSP = csp && svc?.cloud?.toLowerCase() === csp.toLowerCase();
        const matchesName = svc?.name?.toLowerCase().includes(service.toLowerCase());
        return matchesCSP && matchesName;
      });

      if (filteredServices.length > 0) {
        const enrichedServices = filteredServices.map((svc) => ({
          ...svc,
          requiredFields: svc?.requiredFields || [],
        }));

        return JSON.stringify(
          {
            serviceConfig: enrichedServices,
            found: enrichedServices.some(svc => svc.requiredFields.length > 0),
          },
          null,
          2
        );
      } else {
        return JSON.stringify({ serviceConfig: null, found: false }, null, 2);
      }
    } catch (error) {
      console.error('Error processing service config request:', error);
      return JSON.stringify({ serviceConfig: null, found: false }, null, 2);
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
        .describe('The service name to provision (e.g. "EC2", "VM", "Compute Engine", "Compute")'),
    }),
  }
);

export default serviceConfigTool;

import { tool } from '@langchain/core/tools';

const transferToFinopsAgent = tool(
  () => {
    console.log('Transfer to the Finops agent');
    return 'Successfully transferred to the Finops agent';
  },
  {
    name: 'transfer_to_finops_agent',
    description:
      "Use this tool to transfer to the general agent when the user's request is related to finops, cost, billing",
  },
);

export default transferToFinopsAgent;

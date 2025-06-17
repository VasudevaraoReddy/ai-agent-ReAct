import axios from 'axios';

export const getRecommendations = async ( service: string) => {
  const response = await axios.get(`http://localhost:3001/recommendations/fields?impactedField=${service}`);
  return response;
};

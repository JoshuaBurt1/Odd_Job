export const OPENCAGE_API_KEY = process.env.NEXT_PUBLIC_OPENCAGE_API_KEY || "";

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
  hasPropertyNumber: boolean;
}

export const fetchGeocode = async (query: string): Promise<GeocodeResult | null> => {
  if (!query) return null;
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}&key=${OPENCAGE_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();

  if (data.results && data.results.length > 0) {
    const result = data.results[0];
    return {
      lat: result.geometry.lat,
      lng: result.geometry.lng,
      formatted: result.formatted,
      // Check components for a house number to ensure reliability
      hasPropertyNumber: !!(result.components.house_number || result.components.building)
    };
  }
  return null;
};
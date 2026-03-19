export type ReferenceCityRecord = {
  id: string;
  geonameId: number;
  name: string;
  asciiName: string;
  countryCode: string;
  adminName1: string;
  timezone: string;
  latitude: number;
  longitude: number;
};

export type ReferenceCityResponse = {
  id: string;
  geonameId: number;
  name: string;
  countryCode: string;
  adminName1: string;
  timezone: string;
  latitude: number;
  longitude: number;
  displayName: string;
};
